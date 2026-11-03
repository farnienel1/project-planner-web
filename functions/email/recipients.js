'use strict'

/**
 * Recipient rules for `sendEmail` (see templates.js for which template uses which). A caller never chooses a free
 * address:
 *   - 'invitation'          the email stored on `invitations/{data.invitationId}`, an unused invitation of this
 *                           organisation (invite set-up, password reset link).
 *   - 'member'              an active member of the organisation (`organizationMemberActive`), found by their users
 *                           document email (timesheet export, leave cancelled).
 *   - 'wholesaler_or_self'  a contact email on one of the organisation's `wholesalers` documents
 *                           (`parseWholesalerDocument`), the caller's own email for their copy, and at most 3 typed
 *                           addresses not saved on a wholesaler (`materialOrderRecipientCheck`, rulebook 1.15.0)
 *                           (material request).
 *   - 'server'              web server mail only (server key): the web route already decided the address.
 *
 * `reader` is the Firestore access, injected so the rules are tested without Firebase:
 *   getInvitation(id) → data | null
 *   usersByEmail(email) → [{ id, data }]
 *   getMembership(uid, orgId) → data | null
 *   listWholesalers(orgId) → [{ id, data }]
 */

const canonical = require('../loadCanonical')
const { isValidEmail, normalizeEmail } = require('./text')
const { isUuid } = require('./templates')

class RecipientError extends Error {
  constructor(message, status = 403) {
    super(message)
    this.name = 'RecipientError'
    this.status = status
  }
}

function normalizedRecipientList(to, maxRecipients) {
  const list = Array.isArray(to) ? to : typeof to === 'string' ? [to] : []
  const emails = []
  for (const raw of list) {
    if (!isValidEmail(raw)) throw new RecipientError('Every recipient must be a valid email address', 400)
    const email = normalizeEmail(raw)
    if (!emails.includes(email)) emails.push(email)
  }
  if (emails.length === 0) throw new RecipientError('At least one recipient is required', 400)
  if (emails.length > maxRecipients) throw new RecipientError(`At most ${maxRecipients} recipients`, 400)
  return emails
}

async function invitationRecipients(emails, ctx) {
  const invitationId = String(ctx.data.invitationId || '').trim()
  if (!isUuid(invitationId)) throw new RecipientError('invitationId is required', 400)
  const invitation = await ctx.reader.getInvitation(invitationId)
  if (!invitation) throw new RecipientError('Invitation not found', 404)
  const invitationOrg = String(invitation.organizationId || '').trim().toLowerCase()
  if (invitationOrg !== ctx.orgId.toLowerCase()) throw new RecipientError('Invitation does not belong to this organisation')
  if (invitation.isUsed === true) throw new RecipientError('Invitation has already been used')
  const invitationEmail = normalizeEmail(invitation.email)
  if (emails.length !== 1 || emails[0] !== invitationEmail) {
    throw new RecipientError("The recipient must be the invitation's email")
  }
  return [{ email: invitationEmail, invitationId, invitation }]
}

async function memberByEmail(email, ctx) {
  const rows = await ctx.reader.usersByEmail(email, ctx.orgId)
  for (const row of rows) {
    const membership = await ctx.reader.getMembership(row.id, ctx.orgId)
    const result = canonical.organizationMemberActive({
      organizationId: ctx.orgId,
      userId: row.id,
      organization: ctx.org,
      user: row.data,
      membership,
    })
    if (result && result.member && result.active) return { id: row.id, data: row.data }
  }
  return null
}

async function memberRecipients(emails, ctx) {
  const recipients = []
  for (const email of emails) {
    const member = await memberByEmail(email, ctx)
    if (!member) throw new RecipientError(`${email} is not an active member of this organisation`)
    recipients.push({ email, userId: member.id, user: member.data })
  }
  return recipients
}

async function wholesalerOrSelfRecipients(emails, ctx) {
  const contacts = new Map()
  for (const row of await ctx.reader.listWholesalers(ctx.orgId)) {
    const firm = canonical.parseWholesalerDocument(row.id, row.data)
    if (!firm) continue
    for (const contact of firm.contacts) {
      const email = normalizeEmail(contact.email)
      if (email && !contacts.has(email)) contacts.set(email, { wholesalerId: firm.id, contactName: contact.name || '' })
    }
  }
  // Rulebook 1.15.0 `materialOrderRecipientCheck`: saved wholesaler contacts, the sender's copy, and at most
  // `MATERIAL_ORDER_TYPED_RECIPIENTS_MAX` (3) typed addresses not saved on a wholesaler.
  const check = canonical.materialOrderRecipientCheck({
    recipients: emails,
    savedContactEmails: [...contacts.keys()],
    senderEmail: ctx.caller.email,
  })
  if (!check.ok) throw new RecipientError(check.message, 400)
  const typed = new Set(check.typed)
  const self = normalizeEmail(ctx.caller.email)
  const recipients = []
  for (const email of emails) {
    const contact = contacts.get(email)
    if (contact) recipients.push({ email, ...contact })
    else if (typed.has(email)) recipients.push({ email, isTyped: true, contactName: '' })
    else if (self && email === self) recipients.push({ email, isSelf: true })
  }
  return recipients
}

async function serverRecipients(emails) {
  return emails.map((email) => ({ email }))
}

const RULES = Object.freeze({
  invitation: invitationRecipients,
  member: memberRecipients,
  wholesaler_or_self: wholesalerOrSelfRecipients,
  server: serverRecipients,
})

/** @returns {Promise<object[]>} one entry per recipient, each sent as its own message */
async function resolveRecipients(template, to, ctx) {
  const rule = RULES[template.recipients]
  if (!rule) throw new RecipientError('Unknown recipient rule', 500)
  const emails = normalizedRecipientList(to, template.maxRecipients)
  return rule(emails, ctx)
}

module.exports = { RecipientError, normalizedRecipientList, resolveRecipients }
