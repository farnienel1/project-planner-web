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
 * name or address — except with `data.fromCaller`, which is `"<the signed-in caller's own profile name> via Project
 * Planner" <info@projectplanner.us>`, and `data.ccCaller`, which copies that caller (CC) on the same message, for web
 * server mail and for app templates that opt in (`callerEnvelope`, `callerEnvelopeFields`); PDF / XLSX / CSV attachments only, 10 MB in total; one message per recipient; rate limited per
 * sender (rateLimit.js).
 *
 * Dependencies are injected (index.js wires Firebase and Resend) so the rules are tested without either.
 */

const crypto = require('crypto')
const canonical = require('../loadCanonical')
const { AttachmentError, parseAttachments } = require('./attachments')
const { RecipientError, resolveRecipients } = require('./recipients')
const { SERVER_LIMITS, USER_LIMITS } = require('./rateLimit')
const {
  RequestIdError,
  parseRequestId,
  replayResponse,
  requestContentHash,
  requestDedupeKey,
  requestRecipients,
  sentRecordFields,
} = require('./requestDedupe')
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

/**
 * Both sides are trimmed first: a secret set from a file (`firebase functions:secrets:set ... --data-file`) or pasted
 * into Netlify often carries a trailing newline or space, which used to fail every web email with "Server key is not
 * valid". Whitespace is never part of a key. A blank key after trimming never matches.
 */
function sameSecret(given, expected) {
  const left = given == null ? '' : String(given).trim()
  const right = expected == null ? '' : String(expected).trim()
  if (!left || !right) return false
  const a = crypto.createHash('sha256').update(left).digest()
  const b = crypto.createHash('sha256').update(right).digest()
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
    // Caller envelope for app callers (`callerEnvelopeFields`): only the users document name and the ID token email.
    profileName: name,
    tokenEmail: normalizeEmail(decoded.email),
    phone: clamp(profile.mobileNumber || profile.phone, 40),
  }
}

function fromHeader(orgName) {
  const display = sanitizeDisplayName(orgName) || DEFAULT_FROM_NAME
  return `"${display}" <${FROM_ADDRESS}>`
}

/**
 * Web server mail sent on behalf of the signed-in user (material quote / order): `"<their name> via Project Planner"`
 * from the verified FROM_ADDRESS. The name is the caller's own profile name (from their verified ID token and users
 * document), never a name the request gives; the address is never theirs (SPF / DKIM / DMARC).
 */
function callerFromHeader(caller) {
  const name = sanitizeDisplayName(caller && caller.displayName, 60)
  // Rulebook 1.24.0 `materialRequestEmailEnvelope` builds the "<name> via Project Planner" display name.
  const { fromName } = canonical.materialRequestEmailEnvelope({ caller: { name, email: caller && caller.email } })
  return fromName ? `"${fromName}" <${FROM_ADDRESS}>` : ''
}

/**
 * Who the message is "from" and who is copied, when the caller asks for it (`data.fromCaller` / `data.ccCaller`):
 *   - web server mail (server key): as before — the signed-in caller's profile name (`callerFromHeader`) and their
 *     email in CC;
 *   - an app caller, only on a template that opts in (`callerEnvelope: true`, e.g. `material_request`): From
 *     `"<users document firstName surname> via Project Planner" <info@projectplanner.us>`, Reply-To and CC the ID
 *     token's email. A name or address in the request body is never read.
 * Every other app template ignores both flags.
 * @returns {{ from: string, cc: string[], replyTo: string }} '' / [] when not applied
 */
function callerEnvelopeFields({ serverMode, template, data, caller }) {
  const none = { from: '', cc: [], replyTo: '' }
  if (!caller) return none
  // Rulebook 1.24.0 `materialRequestEmailEnvelope`: the From name, CC and Reply-To of the verified caller.
  if (serverMode) {
    const email = isValidEmail(caller.email) ? caller.email : ''
    const envelope = canonical.materialRequestEmailEnvelope({ caller: { email } })
    return {
      from: data.fromCaller === true ? callerFromHeader(caller) : '',
      cc: data.ccCaller === true ? [...envelope.cc] : [],
      replyTo: '',
    }
  }
  if (!template || template.callerEnvelope !== true) return none
  const email = isValidEmail(caller.tokenEmail) ? caller.tokenEmail : ''
  const envelope = canonical.materialRequestEmailEnvelope({ caller: { email } })
  const wantsFrom = data.fromCaller === true
  const wantsCc = data.ccCaller === true
  return {
    from: wantsFrom ? callerFromHeader({ displayName: caller.profileName, email }) : '',
    cc: wantsCc ? [...envelope.cc] : [],
    replyTo: wantsFrom || wantsCc ? envelope.replyTo : '',
  }
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
 * @param {{ claim: Function, complete: Function, release: Function }} [deps.requestDedupe]  idempotency store
 *        (requestDedupe.js `createAdminRequestDedupe`); without it a `requestId` is ignored
 * @param {() => Date} [deps.now]
 */
function createSendEmailHandler(deps) {
  const now = deps.now || (() => new Date())
  const logger = deps.logger

  // Rulebook 1.24.0 / 1.27.0 (§16, §17, owner decision 2): a request that names a job (`data.jobId`) — the job must be
  // a project or small works of this organisation, the caller must see it (`canSeeJob`, the same rule as every job
  // list), and the sent job number must be the stored one (`materialRequestJobCheck`). Without `jobId` nothing is
  // checked (older app builds).
  async function checkRequestJob(data, orgId, callerJob) {
    const rawJobId = data.jobId
    if (rawJobId == null || rawJobId === '') return
    const jobId = typeof rawJobId === 'string' ? rawJobId.trim() : ''
    if (!jobId || jobId.length > 128 || !/^[A-Za-z0-9_-]+$/.test(jobId)) throw new HttpError(400, 'jobId is not valid')
    const found = await deps.reader.getJob(orgId, jobId)
    const managers =
      found && callerJob.email && typeof deps.reader.managersByEmail === 'function'
        ? await deps.reader.managersByEmail(orgId, callerJob.email)
        : []
    const viewer = canonical.materialRequestJobViewer({
      userId: callerJob.uid,
      email: callerJob.email,
      level: callerJob.level,
      isSuperAdmin: callerJob.isSuperAdmin,
      permissionSource: callerJob.permissionSource,
      formerUserIds: callerJob.formerUserIds,
      sameEmailUserIds: callerJob.sameEmailUserIds,
    })
    const result = canonical.materialRequestJobCheck({
      viewer,
      job: found ? found.data : null,
      kind: found ? found.kind : null,
      managers: managers.map((row) => ({ id: row.id, email: row.data ? row.data.email : null })),
      jobNumber: data.jobNumber,
    })
    if (!result.ok) throw new HttpError(result.status, result.message)
  }

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
    // What the job check (`materialRequestJobViewer`) needs about an app caller; null in server mode.
    let callerJob = null
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
        const userInOrg = user && typeof user.organizationId === 'string' && level && level.source === 'users'
        callerJob = {
          uid: decoded.uid,
          email: caller.tokenEmail || '',
          level: caller.level,
          isSuperAdmin: Boolean(level && level.isSuperAdmin),
          permissionSource: userInOrg ? user : { permissions: (membership && membership.permissions) || {} },
          formerUserIds: user && Array.isArray(user.formerUserIds) ? user.formerUserIds : [],
          sameEmailUserIds: user && Array.isArray(user.sameEmailUserIds) ? user.sameEmailUserIds : [],
        }
        if (template.minRole === 'staff' && caller.level !== 'admin' && caller.level !== 'manager') {
          throw new HttpError(403, 'Only admins and managers can send this email')
        }
        if (template.minRole === 'material_sender' && !canonical.canSendMaterialOrders({ level: caller.level })) {
          throw new HttpError(403, canonical.MATERIAL_ORDER_SEND_REFUSED_MESSAGE)
        }
      }
    }

    // Web server mail may ask for the signed-in caller as the display name (`fromCaller`) and as CC (`ccCaller`): one
    // message, the recipient in To and the sender in CC. App callers get the same on templates that opt in
    // (`callerEnvelope`). Only the verified caller's own name and address are used.
    const envelope = callerEnvelopeFields({ serverMode, template, data, caller })
    const cc = envelope.cc
    const ccFor = (email) => (cc.length && !cc.includes(normalizeEmail(email)) ? cc : [])
    const from = envelope.from || fromHeader(orgName)
    const rateKey = caller ? caller.uid : 'server'

    // Idempotency (requestDedupe.js, docs/EMAIL_FUNCTION.md "Request id"). The caller has passed the membership and
    // level checks above. A request that names itself with `requestId` claims its key now; a repeat (an iPhone
    // replaying a queued order after a crash or a timeout) gets the first answer back without sending again, without
    // counting the rate limit and without re-running the checks below that can change between sends (job number,
    // wholesaler contacts) — nothing new is sent. A claim is released whenever nothing was sent. Without `requestId`
    // nothing changes (older builds).
    const requestId = parseRequestId(body.requestId)
    const keyRecipients = requestRecipients(body.to)
    let dedupeKey = ''
    if (requestId && deps.requestDedupe) {
      dedupeKey = requestDedupeKey({
        callerKey: rateKey,
        orgId,
        template: templateName,
        requestId,
        recipients: keyRecipients,
        contentHash: requestContentHash({ data, attachments: body.attachments }),
      })
      const claim = await deps.requestDedupe.claim(dedupeKey, {
        orgId,
        uid: caller ? caller.uid : null,
        template: templateName,
        jobId: data.jobId,
        recipientCount: keyRecipients.length,
      }, now().getTime())
      if (claim.action === 'replay') {
        logger.info('sendEmail: repeated request, not sent again', { template: templateName, orgId: orgId || null })
        return replayResponse(claim.record, { keyRecipients, ccFor, from })
      }
      if (claim.action === 'inProgress') {
        throw new HttpError(409, 'This email is already being sent. Wait a minute, then check your sent items.', {
          inProgress: true,
        })
      }
    }
    // A claim is released when nothing was sent, so a retry sends; a failed release is only logged.
    const releaseClaim = async () => {
      if (!dedupeKey) return
      try {
        await deps.requestDedupe.release(dedupeKey)
      } catch (error) {
        logger.error('sendEmail: could not release a request claim', { error: String(error && error.message) })
      }
    }

    let delivered = null
    try {
      delivered = await deliver({ dedupeKey })
    } catch (error) {
      await releaseClaim()
      throw error
    }
    if (dedupeKey) {
      try {
        await deps.requestDedupe.complete(dedupeKey, sentRecordFields({ ...delivered, keyRecipients }, now().getTime()))
      } catch (error) {
        // The messages went: the caller still gets its success. The claim stays `pending` and goes stale.
        logger.error('sendEmail: could not record a sent request', { error: String(error && error.message) })
      }
    }
    return delivered.response

    // Every check that can change between two sends of one request, then the rate limit and the messages. Throws
    // when nothing was sent.
    async function deliver({ dedupeKey: key }) {
      // Rulebook 1.24.0 / 1.27.0 (§16): a template that names a job (`jobCheck`) and a request that sends `data.jobId`
      // (`checkRequestJob`). A request without `jobId` is still accepted (older iOS builds send only the job number).
      if (template.jobCheck === true && !serverMode) await checkRequestJob(data, orgId, callerJob || {})

      const attachments = parseAttachments(body.attachments, template.attachments)
      const resolved = await resolveRecipients(template, body.to, {
        orgId,
        org,
        data,
        caller: caller || {},
        reader: deps.reader,
      })
      // The caller is already copied on every message: their own "Copy:" message (`isSelf`) is dropped, so they get
      // one email per recipient, not two. Recipient checks (`materialOrderRecipientCheck`) ran on the full list above.
      const recipients = !serverMode && cc.length ? resolved.filter((row) => !row.isSelf) : resolved
      if (recipients.length === 0) throw new HttpError(400, 'At least one recipient other than yourself is required')

      const sentAt = now()
      const firstContactName = (recipients.find((row) => row.contactName) || {}).contactName || ''
      const rendered = recipients.map((recipient) =>
        template.render({ data, org: org || {}, orgName, caller: caller || {}, recipient, now: sentAt, attachments, firstContactName })
      )

      const limited = await deps.consumeRateLimit(rateKey, recipients.length, caller ? USER_LIMITS : SERVER_LIMITS)
      if (!limited.allowed) {
        throw new HttpError(429, 'Too many emails. Try again later.', { retryAfterSec: limited.retryAfterSec })
      }

      let replyTo = FROM_ADDRESS
      if (template.replyToCaller && caller && isValidEmail(caller.email)) replyTo = caller.email
      if (envelope.replyTo) replyTo = envelope.replyTo
      if (serverMode && isValidEmail(data.replyTo)) replyTo = normalizeEmail(data.replyTo)
      const extraHeaders = serverMode ? serverHeaders(data.headers) : undefined

      const results = []
      const failed = []
      const failures = []
      for (let index = 0; index < recipients.length; index += 1) {
        const message = {
          from,
          to: [recipients[index].email],
          subject: rendered[index].subject,
          html: rendered[index].html,
          reply_to: replyTo,
        }
        const messageCc = ccFor(recipients[index].email)
        if (messageCc.length) message.cc = messageCc
        if (rendered[index].text) message.text = rendered[index].text
        if (extraHeaders) message.headers = extraHeaders
        if (attachments.length) {
          message.attachments = attachments.map((row) => ({ filename: row.filename, content: row.content, content_type: row.contentType }))
        }
        // With a request id, Resend gets its own idempotency key per message (`<dedupe key>-<index>`), so a message it
        // already accepted is not sent again even if this call dies before it records the send.
        const options = key ? { idempotencyKey: `${key}-${index}` } : undefined
        try {
          const sent = await deps.sendMessage(message, options)
          results.push({ to: recipients[index].email, id: (sent && sent.id) || null, cc: message.cc || [] })
        } catch (error) {
          if (error && error.alreadyAccepted) {
            // Resend already has this message under its idempotency key: it went, do not count it as failed.
            results.push({ to: recipients[index].email, id: null, cc: message.cc || [] })
            continue
          }
          logger.error('sendEmail: provider refused a message', { template: templateName, orgId, error: String(error && error.message) })
          failed.push(recipients[index].email)
          failures.push({ to: recipients[index].email, error: String((error && error.message) || error).slice(0, 300) })
        }
      }

      logger.info('sendEmail', {
        template: templateName,
        orgId: orgId || null,
        uid: caller ? caller.uid : null,
        mode: serverMode ? 'server' : 'app',
        recipients: recipients.length,
        sent: results.length,
        ids: results.map((row) => row.id),
        cc: cc.length,
        attachments: attachments.length,
      })

      if (results.length === 0) {
        const reason = failures[0] ? `: ${failures[0].error}` : ''
        throw new HttpError(502, `The email provider did not accept the message${reason}`, { failed })
      }
      return {
        results,
        failed,
        response: { sent: failed.length === 0, sentCount: results.length, failed, results, from, ccSupported: true },
      }
    }
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
      } else if (error instanceof RecipientError || error instanceof AttachmentError || error instanceof RequestIdError) {
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

/** Resend's idempotency header (`Idempotency-Key`, at most 256 characters, kept by Resend for about 24 hours). */
const RESEND_IDEMPOTENCY_HEADER = 'Idempotency-Key'
const RESEND_IDEMPOTENCY_KEY_MAX = 256

/**
 * One message to Resend's REST API. With `options.idempotencyKey` the request carries Resend's `Idempotency-Key`
 * header; a 409 from Resend that names the idempotency key means it already accepted that message, and is thrown with
 * `alreadyAccepted: true` so the handler counts it as sent rather than failed.
 */
function resendSender(apiKey, fetchImpl = fetch) {
  return async function sendMessage(message, options = {}) {
    const key = typeof apiKey === 'function' ? apiKey() : apiKey
    if (!key) throw new Error('RESEND_API_KEY is not set')
    const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
    const idempotencyKey = options && typeof options.idempotencyKey === 'string' ? options.idempotencyKey.trim() : ''
    if (idempotencyKey && idempotencyKey.length <= RESEND_IDEMPOTENCY_KEY_MAX) headers[RESEND_IDEMPOTENCY_HEADER] = idempotencyKey
    const response = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers,
      body: JSON.stringify(message),
    })
    const text = await response.text()
    if (!response.ok) {
      const error = new Error(`Resend ${response.status}: ${text.slice(0, 300)}`)
      if (headers[RESEND_IDEMPOTENCY_HEADER] && response.status === 409 && /idempot/i.test(text)) error.alreadyAccepted = true
      throw error
    }
    try {
      return JSON.parse(text)
    } catch {
      return {}
    }
  }
}

module.exports = {
  ALLOWED_SERVER_HEADERS,
  callerEnvelopeFields,
  callerFromHeader,
  APP_CHECK_HEADER,
  FROM_ADDRESS,
  RESEND_IDEMPOTENCY_HEADER,
  SERVER_KEY_HEADER,
  createSendEmailHandler,
  fromHeader,
  sameSecret,
  resendSender,
}
