'use strict'

/**
 * The fixed email templates the `sendEmail` function renders. An app sends a template name and its data; the
 * subject, the HTML and every link are built here, so a caller can never send its own HTML from
 * info@projectplanner.us. See docs/EMAIL_FUNCTION.md.
 *
 * Each template names:
 *   - `minRole`     who may send it: 'member' (any active member of the organisation) or 'staff' (admin / manager)
 *   - `recipients`  the recipient rule (recipients.js): 'invitation', 'member' or 'wholesaler_or_self'
 *   - `maxRecipients`
 *   - `attachments` the file kinds it may carry ([] = none)
 *   - `callerEnvelope` true: an app caller may ask for `data.fromCaller` / `data.ccCaller` (handler.js
 *                   `callerEnvelopeFields`); every other app template ignores them
 *   - `render(input)` → { subject, html, text? } for one recipient
 */

const canonical = require('../loadCanonical')
const { escapeHtml, sanitizeHeader, clamp } = require('./text')
const { WELCOME_EMAIL_HTML_TEMPLATE, WELCOME_EMAIL_TEXT_TEMPLATE } = require('./welcomeEmailPack')
const material = require('./materialRequestEmail')
const {
  EMAIL_LIGHT,
  emailButton,
  emailDocument,
  emailHeading,
  emailLink,
  emailLinkPanel,
  emailList,
  emailNote,
  emailStrong,
  emailText,
  emailFooter,
} = require('./emailTheme')

/** Links in emails point at the production web app; never at a caller-supplied host. */
const APP_BASE_URL = 'https://www.projectplanner.us'

/** Download links in a timesheet export may only point at this project's Firebase Storage. */
const ALLOWED_DOWNLOAD_URL_PREFIXES = [
  'https://firebasestorage.googleapis.com/',
  'https://storage.googleapis.com/',
]

class TemplateDataError extends Error {
  constructor(message) {
    super(message)
    this.name = 'TemplateDataError'
  }
}

function requireText(value, max, label) {
  const text = clamp(value, max)
  if (!text) throw new TemplateDataError(`${label} is required`)
  return text
}

/** Same UUID test web uses for invitation ids (lib/security/validation.ts). */
function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || '').trim())
}

function setupPasswordUrl(invitationId) {
  return `${APP_BASE_URL}/setup-password.html?token=${encodeURIComponent(invitationId)}`
}

const PACK_TOKEN = /\{\{(FirstName|CompanyName|SetupLink|RecipientEmail)\}\}/g

function fillPackTokens(template, tokens) {
  return template.replace(PACK_TOKEN, (_, key) => tokens[key] ?? '')
}

/** "Tuesday, 3 November 2026 at 08:30" in the organisation zone (web used date-fns in the server zone). */
function sentLabel(date, timeZone) {
  const parts = {}
  for (const part of new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)) {
    parts[part.type] = part.value
  }
  return `${parts.weekday}, ${parts.day} ${parts.month} ${parts.year} at ${parts.hour}:${parts.minute}`
}

function plainTextAsSimpleHTML(text) {
  return material.plainTextAsSimpleHTML(text)
}

// ---------------------------------------------------------------------------------------------------------------
// Renderers. `input` is { data, org, orgName, caller, recipient, now, attachments } — see handler.js.

function renderInviteSetup(input) {
  const invitation = input.recipient.invitation || {}
  const firstName = clamp(invitation.firstName, 100) || 'there'
  const url = setupPasswordUrl(input.recipient.invitationId)
  const tokens = {
    FirstName: escapeHtml(firstName),
    CompanyName: escapeHtml(input.orgName),
    SetupLink: escapeHtml(url),
    RecipientEmail: escapeHtml(input.recipient.email),
  }
  return {
    subject: sanitizeHeader(`Welcome to Project Planner — ${input.orgName}`, 180),
    html: fillPackTokens(WELCOME_EMAIL_HTML_TEMPLATE, tokens).trim(),
    text: fillPackTokens(WELCOME_EMAIL_TEXT_TEMPLATE, {
      FirstName: firstName,
      CompanyName: input.orgName,
      SetupLink: url,
      RecipientEmail: input.recipient.email,
    }).trim(),
  }
}

/** iOS `ResendEmailService.createPasswordResetLinkEmailBody`, rendered here. */
function renderPasswordResetLink(input) {
  const invitation = input.recipient.invitation || {}
  const firstName = escapeHtml(clamp(invitation.firstName, 100) || 'there')
  const url = escapeHtml(setupPasswordUrl(input.recipient.invitationId))
  const html = emailDocument({
    title: 'Reset your password',
    body: [
      emailText('Project Planner', 'brand', 'margin:0 0 2px 0;'),
      emailText('Project Management for Construction Teams', 'small', 'margin:0 0 24px 0;'),
      emailHeading('Reset your password'),
      emailText(`Hello ${firstName},`),
      emailText(
        'We received a request to reset the password for your Project Planner account. Click the button below to choose a new password. No verification code is required.'
      ),
      emailButton(url, 'Reset password'),
      emailText("If the button doesn't work, copy and paste this link into your browser:", 'muted', 'margin:0 0 8px 0;'),
      emailLinkPanel(url, url),
      emailNote(
        `<strong class="pp-note-ink" style="color:${EMAIL_LIGHT.noteInk};font-weight:700;">Security note:</strong> This link expires in 7 days. If you didn't request a password reset, you can safely ignore this email and your password will remain unchanged.`
      ),
      emailFooter(
        'This email was sent by Project Planner. If you have questions, contact your organisation administrator.<br>© Project Planner · Your password was not changed unless you used the link above.'
      ),
    ].join('\n'),
  })
  return { subject: 'Reset Your Project Planner Password', html }
}

/** Web `managerExportEmailHTML` (lib/timesheets/timesheetExport.ts) / iOS `managerExportEmailHTML`. */
function managerExportEmailHTML({ recipientName, weekTitle, paymentRunStamp, organizationName, attachmentNames, downloadLinks, timesheetCount }) {
  // The web copy does not escape single quotes; keep its output identical.
  const esc = (value) => escapeHtml(value).replace(/&#39;/g, "'")
  const list =
    downloadLinks.length === 0
      ? attachmentNames.map((name) => esc(name))
      : downloadLinks.map((link) => emailLink(esc(link.url), esc(link.fileName)))
  const noun = timesheetCount === 1 ? 'is' : 'are'
  const pdfWord = timesheetCount === 1 ? '' : 's'
  const attachNote =
    downloadLinks.length === 0
      ? `${timesheetCount} signed-off timesheet PDF${pdfWord} for payment run ${emailStrong(esc(paymentRunStamp), 'ink')} (${esc(weekTitle)}) from ${emailStrong(esc(organizationName), 'ink')} ${noun} attached for your records.`
      : `${timesheetCount} signed-off timesheet PDF${pdfWord} for payment run ${emailStrong(esc(paymentRunStamp), 'ink')} (${esc(weekTitle)}) from ${emailStrong(esc(organizationName), 'ink')} ${noun} attached, with backup download links below.`
  return emailDocument({
    title: 'Signed timesheets for filing',
    maxWidth: 720,
    body: [
      emailHeading('Signed timesheets for filing'),
      emailText(`Hello ${esc(recipientName)},`),
      emailText(attachNote),
      emailText(`Each file is named: <em>User Name timesheet for payment run date ${esc(paymentRunStamp)}</em>.`),
      emailList(list),
      emailText(
        'These timesheets were counter-signed and exported from Operative Timesheets → Signed off.',
        'muted',
        'margin:0;'
      ),
    ].join('\n'),
  })
}

function parseDownloadLinks(raw) {
  if (!Array.isArray(raw)) return []
  const links = []
  for (const row of raw.slice(0, 80)) {
    const fileName = clamp(row && row.fileName, 200)
    const url = clamp(row && row.url, 2000)
    if (!fileName || !url) continue
    if (!ALLOWED_DOWNLOAD_URL_PREFIXES.some((prefix) => url.startsWith(prefix))) {
      throw new TemplateDataError('Download links must point at Firebase Storage')
    }
    links.push({ fileName, url })
  }
  return links
}

function renderTimesheetExport(input) {
  const weekTitle = requireText(input.data.weekTitle, 120, 'weekTitle')
  const paymentRunStamp = requireText(input.data.paymentRunStamp, 80, 'paymentRunStamp')
  const downloadLinks = parseDownloadLinks(input.data.downloadLinks)
  const attachmentNames = input.attachments.map((row) => row.filename)
  if (attachmentNames.length === 0 && downloadLinks.length === 0) {
    throw new TemplateDataError('At least one timesheet file is required')
  }
  const count = Number(input.data.timesheetCount)
  const timesheetCount = Number.isFinite(count)
    ? Math.max(1, Math.min(Math.round(count), 80))
    : Math.max(1, attachmentNames.length || downloadLinks.length)
  const recipientUser = input.recipient.user || {}
  const recipientName = clamp(recipientUser.firstName, 120) || 'there'
  return {
    subject: sanitizeHeader(`Signed timesheets for filing — ${paymentRunStamp} — ${input.orgName}`, 180),
    html: managerExportEmailHTML({
      recipientName,
      weekTitle,
      paymentRunStamp,
      organizationName: input.orgName,
      attachmentNames: attachmentNames.length > 0 ? attachmentNames : downloadLinks.map((link) => link.fileName),
      downloadLinks,
      timesheetCount,
    }),
  }
}

function parseMaterialLines(rows) {
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > 250) {
    throw new TemplateDataError('Between 1 and 250 material lines are required')
  }
  return rows.map((row) => {
    const name = clamp(row && row.material, 200)
    if (!name) throw new TemplateDataError('Every material line needs a name')
    const quantity = typeof row.quantity === 'number' && Number.isFinite(row.quantity) ? row.quantity : 1
    return {
      material: name,
      quantity,
      unit: clamp(row.unit, 40) || 'Number',
      brand: clamp(row.brand, 120) || undefined,
      productCode: clamp(row.productCode, 80) || undefined,
      notes: clamp(row.notes, 500) || undefined,
      lengthDisplay: clamp(row.lengthDisplay, 80) || undefined,
    }
  })
}

/** Only digits, spaces and + ( ) - survive in a phone number shown as a tel: link. */
function phoneText(value) {
  return clamp(value, 40).replace(/[^0-9+()\- ]/g, '').trim()
}

function renderMaterialRequest(input) {
  const requestType = input.data.requestType
  if (requestType !== 'quote' && requestType !== 'order') {
    throw new TemplateDataError('requestType must be quote or order')
  }
  const isQuote = requestType === 'quote'
  const timeZone = canonical.organizationTimeZone(input.org.countryCode)
  let deliveryRequiredLabel
  if (canonical.materialOrderIncludesDeliveryRequired(requestType)) {
    const parsed = Date.parse(String(input.data.deliveryRequiredAt || ''))
    const at = Number.isFinite(parsed)
      ? new Date(parsed)
      : canonical.defaultMaterialDeliveryRequiredAt(input.now.toISOString(), timeZone)
    deliveryRequiredLabel = canonical.formatMaterialDeliveryRequired(at, timeZone)
  }
  const caller = input.caller
  const context = {
    supplierName: '',
    userName: caller.displayName,
    userEmail: caller.email,
    userPhone: phoneText(caller.phone || input.data.senderPhone),
    userCompany: input.orgName,
    jobNumber: requireText(input.data.jobNumber, 80, 'jobNumber'),
    siteName: clamp(input.data.siteName, 200),
    deliveryAddress: clamp(input.data.siteAddress, 400),
    companyLogoURL: /^https:\/\//i.test(String(input.org.companyLogoURL || '')) ? clamp(input.org.companyLogoURL, 500) : '',
    materials: parseMaterialLines(input.data.materials),
    sentLabel: sentLabel(input.now, timeZone),
    deliveryRequiredLabel,
  }
  const built = material.buildMaterialRequestEmail({
    context,
    isQuote,
    sendAsPlainText: Boolean(input.data.sendAsPlainText),
    // A wholesaler is greeted by their contact name; the sender's own copy uses the first wholesaler's.
    contactName: input.recipient.contactName || input.firstContactName || '',
  })
  const subject = input.recipient.isSelf ? `Copy: ${built.subject}` : built.subject
  return { subject: sanitizeHeader(subject, 180), html: built.html }
}

function renderLeaveCancelled(input) {
  const dateText = requireText(input.data.dateText, 80, 'dateText')
  const recipientUser = input.recipient.user || {}
  const firstName = clamp(recipientUser.firstName, 100)
  const greeting = firstName ? `Hello ${firstName}` : 'Hello'
  const plain = `${greeting},\n\n${input.caller.displayName} has cancelled your annual leave request for ${dateText}.\n\nThis was sent from Project Planner.`
  return { subject: 'Annual leave cancelled', html: plainTextAsSimpleHTML(plain), text: plain }
}

/** Web server only (server key): HTML the web server already rendered and checked. */
function renderWebRendered(input) {
  const subject = sanitizeHeader(requireText(input.data.subject, 300, 'subject'), 200)
  const html = typeof input.data.html === 'string' ? input.data.html : ''
  if (!html.trim()) throw new TemplateDataError('html is required')
  if (html.length > 1_000_000) throw new TemplateDataError('html is too long')
  const text = typeof input.data.text === 'string' && input.data.text.trim() ? input.data.text.slice(0, 200_000) : undefined
  return { subject, html, text }
}

const TEMPLATES = Object.freeze({
  invite_setup: {
    minRole: 'staff',
    recipients: 'invitation',
    maxRecipients: 1,
    attachments: [],
    render: renderInviteSetup,
  },
  password_reset_link: {
    minRole: 'staff',
    recipients: 'invitation',
    maxRecipients: 1,
    attachments: [],
    render: renderPasswordResetLink,
  },
  timesheet_export: {
    minRole: 'staff',
    recipients: 'member',
    maxRecipients: 5,
    attachments: ['pdf', 'xlsx', 'csv'],
    render: renderTimesheetExport,
  },
  material_request: {
    // Rulebook 1.15.0 `canSendMaterialOrders`: admins and managers only, never an operative.
    minRole: 'material_sender',
    recipients: 'wholesaler_or_self',
    maxRecipients: 41,
    attachments: [],
    replyToCaller: true,
    // iOS sends one message per wholesaler: From "<user> via Project Planner", CC and Reply-To the user (as web does
    // through `web_rendered`). The sender's separate "Copy:" message is dropped when they are CC'd.
    callerEnvelope: true,
    render: renderMaterialRequest,
  },
  leave_cancelled: {
    minRole: 'staff',
    recipients: 'member',
    maxRecipients: 1,
    attachments: [],
    render: renderLeaveCancelled,
  },
})

/** Only a caller holding the web server key may use these (never an app). */
const SERVER_TEMPLATES = Object.freeze({
  web_rendered: {
    minRole: null,
    recipients: 'server',
    maxRecipients: 1,
    attachments: ['pdf', 'xlsx', 'csv'],
    render: renderWebRendered,
  },
})

module.exports = {
  APP_BASE_URL,
  ALLOWED_DOWNLOAD_URL_PREFIXES,
  SERVER_TEMPLATES,
  TEMPLATES,
  TemplateDataError,
  isUuid,
  managerExportEmailHTML,
  sentLabel,
  setupPasswordUrl,
}
