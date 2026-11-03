'use strict'

/**
 * `sendEmail` HTTPS handler (docs/EMAIL_FUNCTION.md). Replaces the open `sendProjectPlannerEmail`, which sent any
 * HTML to any address from info@projectplanner.us for whoever found its URL.
 *
 * Two kinds of caller:
 *   - An app (iOS): `Authorization: Bearer <Firebase ID token>` (verified, revocation checked) and, when the app has
 *     it, `X-Firebase-AppCheck` (verified when present; only logged when absent, so it can be enforced later). The
 *     caller must be an active member of `orgId` (`organizationMemberActive`) at the level the template needs
 *     (`organizationLevelFor`). Only the fixed templates in templates.js, rendered here; recipients follow the
 *     template's rule (recipients.js).
 *   - The web server (Netlify API routes): `X-Project-Planner-Server-Key: <EMAIL_SERVER_KEY>` plus, when the route
 *     has a signed-in user, that user's ID token. Template `web_rendered` only: HTML the web route rendered after its
 *     own checks (`requireOrgAccess`, MFA, Stripe signature, public-form guard). The key lives only on Netlify and in
 *     Secret Manager, never in an app.
 *
 * Every message: from `"<organisation name>" <info@projectplanner.us>` (or "Project Planner"), never a caller-chosen
 * name or address; PDF / XLSX / CSV attachments only, 10 MB in total; one message per recipient; rate limited per
 * sender (rateLimit.js).
 *
 * Dependencies are injected (index.js wires Firebase and Resend) so the rules are tested without either.
 */

const crypto = require('crypto')
const canonical = require('../loadCanonical')
const { AttachmentError, parseAttachments } = require('./attachments')
const { RecipientError, resolveRecipients } = require('./recipients')
const { SERVER_LIMITS, USER_LIMITS } = require('./rateLimit')
const { SERVER_TEMPLATES, TEMPLATES, TemplateDataError } = require('./templates')
const { clamp, isValidEmail, normalizeEmail, sanitizeDisplayName } = require('./text')

const FROM_ADDRESS = 'info@projectplanner.us'
const DEFAULT_FROM_NAME = 'Project Planner'
const SERVER_KEY_HEADER = 'x-project-planner-server-key'
const APP_CHECK_HEADER = 'x-firebase-appcheck'
/** Only these extra headers may be passed by the web server (marketing acknowledgement unsubscribe). */
const ALLOWED_SERVER_HEADERS = ['List-Unsubscribe', 'List-Unsubscribe-Post']

class HttpError extends Error {
  constructor(status, message, extra) {
    super(message)
    this.status = status
    this.extra = extra || {}
  }
}

function header(req, name) {
  if (typeof req.get === 'function') return req.get(name) || ''
  const headers = req.headers || {}
  const value = headers[name] ?? headers[name.toLowerCase()]
  return Array.isArray(value) ? value[0] || '' : value || ''
}

function bearerToken(req) {
  const match = /^Bearer\s+(.+)$/i.exec(String(header(req, 'authorization')).trim())
  return match ? match[1].trim() : ''
}

function sameSecret(given, expected) {
  if (!given || !expected) return false
  const a = crypto.createHash('sha256').update(String(given)).digest()
  const b = crypto.createHash('sha256').update(String(expected)).digest()
  return crypto.timingSafeEqual(a, b)
}

function parseBody(req) {
  let body = req.body
  if (typeof body === 'string' || Buffer.isBuffer(body)) {
    try {
      body = JSON.parse(String(body))
    } catch {
      throw new HttpError(400, 'Body must be JSON')
    }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Body must be a JSON object')
  return body
}

function parseOrgId(value, required) {
  const orgId = typeof value === 'string' ? value.trim() : ''
  if (!orgId) {
    if (required) throw new HttpError(400, 'orgId is required')
    return ''
  }
  if (orgId.length > 128 || !/^[A-Za-z0-9_-]+$/.test(orgId)) throw new HttpError(400, 'orgId is not valid')
  return orgId
}

function callerProfile(decoded, user) {
  const profile = user || {}
  const name = `${clamp(profile.firstName, 100)} ${clamp(profile.surname, 100)}`.trim()
  const email = normalizeEmail(decoded.email) || normalizeEmail(profile.email)
  return {
    uid: decoded.uid,
    email,
    displayName: name || clamp(decoded.name, 120) || email || 'A Project Planner user',
    phone: clamp(profile.mobileNumber || profile.phone, 40),
  }
}

function fromHeader(orgName) {
  const display = sanitizeDisplayName(orgName) || DEFAULT_FROM_NAME
  return `"${display}" <${FROM_ADDRESS}>`
}

function serverHeaders(raw) {
  if (!raw || typeof raw !== 'object') return undefined
  const headers = {}
  for (const name of ALLOWED_SERVER_HEADERS) {
    const value = typeof raw[name] === 'string' ? raw[name].replace(/[\r\n]+/g, ' ').trim().slice(0, 500) : ''
    if (value) headers[name] = value
  }
  return Object.keys(headers).length ? headers : undefined
}

/**
 * @param {object} deps
 * @param {(token: string) => Promise<{ uid: string, email?: string, name?: string }>} deps.verifyIdToken  revocation checked
 * @param {(token: string) => Promise<unknown>} deps.verifyAppCheck  throws when the token is not valid
 * @param {object} deps.reader  getOrganization(orgId), getUser(uid), getMembership(uid, orgId), getInvitation(id),
 *                              usersByEmail(email), listWholesalers(orgId)
 * @param {(key: string, count: number, limits: object) => Promise<object>} deps.consumeRateLimit
 * @param {(message: object) => Promise<{ id?: string }>} deps.sendMessage  one Resend message
 * @param {() => string} deps.serverKey  EMAIL_SERVER_KEY ('' when not set: server mode is then refused)
 * @param {{ info: Function, warn: Function, error: Function }} deps.logger
 * @param {() => Date} [deps.now]
 */
function createSendEmailHandler(deps) {
  const now = deps.now || (() => new Date())
  const logger = deps.logger

  async function handle(req) {
    if (req.method !== 'POST') throw new HttpError(405, 'Use POST')

    const serverKeyGiven = String(header(req, SERVER_KEY_HEADER)).trim()
    const serverMode = serverKeyGiven.length > 0
    if (serverMode && !sameSecret(serverKeyGiven, deps.serverKey())) throw new HttpError(401, 'Server key is not valid')

    const token = bearerToken(req)
    if (!serverMode && !token) throw new HttpError(401, 'Sign in required')
    let decoded = null
    if (token) {
      try {
        decoded = await deps.verifyIdToken(token)
      } catch {
        throw new HttpError(401, 'Sign in again')
      }
      if (!decoded || !decoded.uid) throw new HttpError(401, 'Sign in again')
    }

    if (!serverMode) {
      const appCheck = String(header(req, APP_CHECK_HEADER)).trim()
      if (appCheck) {
        try {
          await deps.verifyAppCheck(appCheck)
        } catch {
          throw new HttpError(401, 'App Check token is not valid')
        }
      } else {
        // Not enforced yet: logged so the owner can see which builds still send none (docs/EMAIL_FUNCTION.md).
        logger.warn('sendEmail: no App Check token', { uid: decoded.uid })
      }
    }

    const body = parseBody(req)
    const templateName = typeof body.template === 'string' ? body.template.trim() : ''
    const registry = serverMode ? SERVER_TEMPLATES : TEMPLATES
    const template = Object.prototype.hasOwnProperty.call(registry, templateName) ? registry[templateName] : null
    if (!template) throw new HttpError(400, `Unknown template ${templateName || '(none)'}`)

    const orgId = parseOrgId(body.orgId, !serverMode)
    const data = body.data && typeof body.data === 'object' && !Array.isArray(body.data) ? body.data : {}

    let org = null
    if (orgId) {
      org = await deps.reader.getOrganization(orgId)
      if (!org && !serverMode) throw new HttpError(404, 'Organisation not found')
    }
    const orgName = org ? canonical.parseOrganizationName(org) || '' : ''

    let caller = null
    if (decoded) {
      const user = await deps.reader.getUser(decoded.uid)
      caller = callerProfile(decoded, user)
      if (!serverMode) {
        const membership = await deps.reader.getMembership(decoded.uid, orgId)
        const active = canonical.organizationMemberActive({ organizationId: orgId, userId: decoded.uid, organization: org, user, membership })
        if (!active || !active.member || !active.active) {
          throw new HttpError(403, 'You are not an active member of this organisation')
        }
        const members = org && org.members && typeof org.members === 'object' ? org.members : {}
        const level = canonical.organizationLevelFor({
          organizationId: orgId,
          userId: decoded.uid,
          creatorUserId: org ? org.creatorUserId : '',
          user,
          membership,
          membersRole: members[decoded.uid],
        })
        caller.level = level ? level.level : 'operative'
        if (template.minRole === 'staff' && caller.level !== 'admin' && caller.level !== 'manager') {
          throw new HttpError(403, 'Only admins and managers can send this email')
        }
      }
    }

    const attachments = parseAttachments(body.attachments, template.attachments)
    const recipients = await resolveRecipients(template, body.to, {
      orgId,
      org,
      data,
      caller: caller || {},
      reader: deps.reader,
    })

    const sentAt = now()
    const firstContactName = (recipients.find((row) => row.contactName) || {}).contactName || ''
    const rendered = recipients.map((recipient) =>
      template.render({ data, org: org || {}, orgName, caller: caller || {}, recipient, now: sentAt, attachments, firstContactName })
    )

    const rateKey = caller ? caller.uid : 'server'
    const limited = await deps.consumeRateLimit(rateKey, recipients.length, caller ? USER_LIMITS : SERVER_LIMITS)
    if (!limited.allowed) {
      throw new HttpError(429, 'Too many emails. Try again later.', { retryAfterSec: limited.retryAfterSec })
    }

    let replyTo = FROM_ADDRESS
    if (template.replyToCaller && caller && isValidEmail(caller.email)) replyTo = caller.email
    if (serverMode && isValidEmail(data.replyTo)) replyTo = normalizeEmail(data.replyTo)
    const from = fromHeader(orgName)
    const extraHeaders = serverMode ? serverHeaders(data.headers) : undefined

    const results = []
    const failed = []
    for (let index = 0; index < recipients.length; index += 1) {
      const message = {
        from,
        to: [recipients[index].email],
        subject: rendered[index].subject,
        html: rendered[index].html,
        reply_to: replyTo,
      }
      if (rendered[index].text) message.text = rendered[index].text
      if (extraHeaders) message.headers = extraHeaders
      if (attachments.length) {
        message.attachments = attachments.map((row) => ({ filename: row.filename, content: row.content, content_type: row.contentType }))
      }
      try {
        const sent = await deps.sendMessage(message)
        results.push({ to: recipients[index].email, id: (sent && sent.id) || null })
      } catch (error) {
        logger.error('sendEmail: provider refused a message', { template: templateName, orgId, error: String(error && error.message) })
        failed.push(recipients[index].email)
      }
    }

    logger.info('sendEmail', {
      template: templateName,
      orgId: orgId || null,
      uid: caller ? caller.uid : null,
      mode: serverMode ? 'server' : 'app',
      recipients: recipients.length,
      sent: results.length,
      attachments: attachments.length,
    })

    if (results.length === 0) throw new HttpError(502, 'The email provider did not accept the message', { failed })
    return { sent: failed.length === 0, sentCount: results.length, failed, results }
  }

  return async function sendEmailHandler(req, res) {
    try {
      const result = await handle(req)
      res.status(200).json(result)
    } catch (error) {
      let status = 500
      let message = 'Could not send the email'
      let extra = {}
      if (error instanceof HttpError) {
        status = error.status
        message = error.message
        extra = error.extra
      } else if (error instanceof RecipientError || error instanceof AttachmentError) {
        status = error.status
        message = error.message
      } else if (error instanceof TemplateDataError) {
        status = 400
        message = error.message
      } else {
        logger.error('sendEmail: unexpected error', { error: String(error && error.stack ? error.stack : error) })
      }
      if (extra.retryAfterSec) res.set('Retry-After', String(extra.retryAfterSec))
      res.status(status).json({ sent: false, error: message, ...extra })
    }
  }
}

/** One message to Resend's REST API. */
function resendSender(apiKey, fetchImpl = fetch) {
  return async function sendMessage(message) {
    const key = typeof apiKey === 'function' ? apiKey() : apiKey
    if (!key) throw new Error('RESEND_API_KEY is not set')
    const response = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    })
    const text = await response.text()
    if (!response.ok) throw new Error(`Resend ${response.status}: ${text.slice(0, 300)}`)
    try {
      return JSON.parse(text)
    } catch {
      return {}
    }
  }
}

module.exports = {
  ALLOWED_SERVER_HEADERS,
  APP_CHECK_HEADER,
  FROM_ADDRESS,
  SERVER_KEY_HEADER,
  createSendEmailHandler,
  fromHeader,
  resendSender,
}
