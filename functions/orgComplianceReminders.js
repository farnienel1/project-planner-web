'use strict'

const {
  emailButton,
  emailDocument,
  emailFooter,
  emailHeading,
  emailLink,
  emailText,
  EMAIL_FONT,
  EMAIL_LIGHT,
} = require('./email/emailTheme')
const { escapeHtml } = require('./email/text')

/**
 * Rulebook 1.85.0 §31 (owner decision 24 Nov): once a day, email the admins of each organisation about its insurance &
 * accreditation documents 2 months, 1 month and 7 days before they expire — only thresholds that were still ahead
 * when the expiry was set, never twice for the same document, expiry and threshold.
 *
 * Every decision is the packed rulebook's:
 *   - what is due and the ledger: `orgComplianceRemindersDue`, `orgComplianceReminderLedgerAfter`,
 *     `orgComplianceReminderLedgerFields`, `parseOrgComplianceReminderLedger`, over `parseOrgComplianceDocuments`;
 *   - today: `orgComplianceTodayKey` in the organisation's zone (`organizationTimeZone`);
 *   - who: `orgComplianceReminderRecipients` over the roster (`timesheetSignOffReminderRosterMember`, §1 anchored people);
 *   - what it says: `orgComplianceReminderEmail`.
 * This file only reads, renders the branded email (the account-email theme, `email/emailTheme.js`), sends it through
 * the email function's Resend sender and writes the ledger `organizations/{orgId}/orgCompliance/reminders` (server
 * only; the security rules match only `orgCompliance/documents`).
 *
 * Kill switch: no email is sent unless `platformConfig/app.orgComplianceRemindersEnabled` is true
 * (`orgComplianceRemindersEnabled`). Off: a dry run that logs, per organisation, what would be sent and to how many, and
 * records only the set-day facts in the ledger (never a send).
 *
 * Reads per run: one collection-group query of every `orgCompliance` document (the documents and the ledgers); for an
 * organisation with something due, its organisation document, its users (one query) and the anchored members' users
 * documents and memberships. Organisations with no compliance documents cost nothing.
 *
 * At most once: the reminders are claimed in the ledger before any email goes, and released only when no admin's email
 * was accepted. Failures are logged by HTTP status only. Resend's idempotency key (organisation, person, day and the
 * documents and thresholds listed) stops a retry of the same email the same day from sending twice.
 */

const APP_BASE_URL = 'https://www.projectplanner.us'
const FROM = '"Project Planner" <info@projectplanner.us>'

function trimmed(value) {
  return String(value ?? '').trim()
}

/** Plain values for the rulebook (Timestamps as epoch ms). */
function plain(data) {
  if (data == null || typeof data !== 'object') return data
  if (typeof data.toMillis === 'function') return data.toMillis()
  if (data instanceof Date) return data.getTime()
  if (Array.isArray(data)) return data.map(plain)
  const out = {}
  for (const [key, value] of Object.entries(data)) out[key] = plain(value)
  return out
}

/** The provider's HTTP status from a send error ("Resend 500: …" → 500); never the response body. */
function providerStatus(error) {
  const match = /Resend (\d{3})/.exec(String((error && error.message) || ''))
  return match ? Number(match[1]) : (error && error.status) || 'error'
}

/** The branded HTML and plain text of the rulebook's email words. */
function renderOrgComplianceReminderEmail(words, recipient) {
  const url = `${APP_BASE_URL}${words.path}`
  const greeting = recipient && recipient.firstName ? `Hello ${escapeHtml(recipient.firstName)},` : 'Hello,'
  const rows = words.rows
    .map(
      (row) => `<tr>
<td class="pp-rule" style="padding:12px 0;border-top:1px solid ${EMAIL_LIGHT.rule};font-family:${EMAIL_FONT};">
<p class="pp-heading" style="margin:0;font-size:15px;line-height:22px;font-weight:700;color:${EMAIL_LIGHT.heading};">${escapeHtml(row.title)}</p>
<p class="pp-small" style="margin:2px 0 0 0;font-size:13px;line-height:19px;color:${EMAIL_LIGHT.small};">${escapeHtml(row.kind)}</p>
<p class="pp-ink" style="margin:4px 0 0 0;font-size:14px;line-height:20px;color:${EMAIL_LIGHT.ink};">${escapeHtml(row.whenText)} · ${escapeHtml(row.expiryText)}</p>
</td></tr>`
    )
    .join('\n')
  const html = emailDocument({
    title: words.heading,
    preheader: words.subject,
    body: [
      emailText('Project Planner', 'brand', 'margin:0 0 2px 0;'),
      emailText('Project Management for Construction Teams', 'small', 'margin:0 0 24px 0;'),
      emailHeading(escapeHtml(words.heading)),
      emailText(greeting),
      emailText(escapeHtml(words.intro)),
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px 0;">${rows}</table>`,
      emailButton(url, escapeHtml(words.buttonLabel)),
      emailText("If the button doesn't work, open " + emailLink(url, url), 'muted'),
      emailFooter(`${escapeHtml(words.footer)}<br>© Project Planner`),
    ].join('\n'),
  })
  const text = [
    recipient && recipient.firstName ? `Hello ${recipient.firstName},` : 'Hello,',
    '',
    words.intro,
    '',
    ...words.rows.map((row) => `- ${row.title} (${row.kind}): ${row.whenText} · ${row.expiryText}`),
    '',
    `${words.buttonLabel}: ${url}`,
    '',
    words.footer,
  ].join('\n')
  return { subject: words.subject, html, text }
}

/**
 * `store`:
 *   remindersEnabled() → boolean                      (platformConfig/app.orgComplianceRemindersEnabled)
 *   complianceDocuments() → [{ orgId, documents?, ledger? }]   (every orgCompliance documents / reminders pair)
 *   organization(orgId) → data | null
 *   users(orgId), usersByIds?(ids), memberships?(orgId, ids)  (as the sign-off reminder store)
 *   writeLedger(orgId, fields) → void                   (organizations/{orgId}/orgCompliance/reminders, set)
 * `sendEmail(message, { idempotencyKey })` → resolves when Resend accepted it.
 */
function createOrgComplianceReminders({ store, canonical, sendEmail, logger = console, now = () => Date.now() }) {
  async function rosterOf(orgId, org) {
    const creatorUserId = trimmed(org.creatorUserId)
    const members = org.members && typeof org.members === 'object' && !Array.isArray(org.members) ? org.members : {}
    const userRows = await store.users(orgId)
    const have = new Set(userRows.map((row) => trimmed(row.id).toLowerCase()))
    const anchoredIds = [...new Set([...Object.keys(members), creatorUserId].map(trimmed).filter(Boolean))].filter((id) => !have.has(id.toLowerCase()))
    const anchoredRows = anchoredIds.length && typeof store.usersByIds === 'function' ? await store.usersByIds(anchoredIds) : []
    const memberships =
      anchoredRows.length && typeof store.memberships === 'function' ? await store.memberships(orgId, anchoredRows.map((row) => row.id)) : {}
    const membersRoleOf = (id) => {
      const key = Object.keys(members).find((row) => row.toLowerCase() === trimmed(id).toLowerCase())
      return key == null ? undefined : members[key]
    }
    return [...userRows, ...anchoredRows]
      .map((row) => {
        const data = plain(row.data || {})
        const member = canonical.timesheetSignOffReminderRosterMember(row.id, data, {
          organizationId: orgId,
          creatorUserId,
          membersRole: membersRoleOf(row.id),
          membership: memberships[row.id] ? plain(memberships[row.id]) : null,
        })
        return member ? { ...member, firstName: trimmed(data.firstName) } : null
      })
      .filter(Boolean)
  }

  async function runForOrganization(row, nowMs, enabled) {
    const orgId = trimmed(row.orgId)
    const org = plain((await store.organization(orgId)) || null)
    if (!org) return { orgId, skipped: 'no organisation' }
    if (canonical.organizationDeletionState(org, nowMs).state !== 'active') return { orgId, skipped: 'scheduled for deletion' }
    if (org.billing && !canonical.hasAccess(org.billing, nowMs)) return { orgId, skipped: 'subscription lapsed' }
    const timeZone = canonical.organizationTimeZone(org.countryCode)
    const todayKey = canonical.orgComplianceTodayKey(nowMs, timeZone)
    const documents = canonical.parseOrgComplianceDocuments(plain(row.documents || null), { organizationId: orgId })
    const stored = canonical.parseOrgComplianceReminderLedger(plain(row.ledger || null))
    const storedJSON = JSON.stringify(canonical.orgComplianceReminderLedgerFields(stored))
    const result = canonical.orgComplianceRemindersDue({ documents, todayKey, timeZone, sent: stored })
    const due = result.due
    // Write the ledger only when it changed (a quiet day writes nothing).
    const writeIfChanged = async (ledger) => {
      const fields = canonical.orgComplianceReminderLedgerFields(ledger)
      if (JSON.stringify(fields) === storedJSON) return false
      await store.writeLedger(orgId, fields)
      return true
    }
    const recipients = due.length ? canonical.orgComplianceReminderRecipients(await rosterOf(orgId, org)) : []
    const words = canonical.orgComplianceReminderEmail({ organizationName: trimmed(org.name), reminders: due })
    if (!enabled) {
      // Switch off: no email, but the set-day facts are recorded (review of #447), so an edit of another field between
      // the deploy and switching on never moves the day an expiry was set.
      await writeIfChanged(result.ledger)
      if (due.length) {
        logger.info('org compliance reminders (dry run, switch off): would send', {
          orgId,
          todayKey,
          recipients: recipients.length,
          reminders: due.map((r) => ({ entryId: r.entryId, threshold: r.threshold, expiresOn: r.expiresOn })),
        })
      }
      return { orgId, dryRun: true, due: due.length, recipients: recipients.length }
    }
    if (!words || recipients.length === 0) {
      await writeIfChanged(result.ledger)
      if (due.length) logger.warn('org compliance reminders: due but no admin with an email', { orgId, due: due.length })
      return { orgId, due: due.length, recipients: 0, delivered: 0, failed: 0 }
    }
    // At most once: claim the reminders in the ledger BEFORE sending (a failed write sends nothing; a crash after it
    // loses that day's email rather than sending it twice), then release the claim only when no email was accepted.
    const claimed = canonical.orgComplianceReminderLedgerAfter({ ledger: result.ledger, sent: due, todayKey })
    await store.writeLedger(orgId, canonical.orgComplianceReminderLedgerFields(claimed))
    const tag = canonical.orgComplianceReminderBatchTag(due)
    let delivered = 0
    const failed = []
    for (const recipient of recipients) {
      const rendered = renderOrgComplianceReminderEmail(words, recipient)
      try {
        // The key names what this email lists: a same-day re-run with other documents is a new email, so a 409
        // "already used" can only be this exact email, already accepted.
        await sendEmail(
          { from: FROM, to: [recipient.email], subject: rendered.subject, html: rendered.html, text: rendered.text },
          { idempotencyKey: `orgComplianceReminder:${orgId}:${recipient.userId}:${todayKey}:${tag}` }
        )
        delivered += 1
      } catch (error) {
        if (error && error.alreadyAccepted) delivered += 1
        else failed.push({ userId: recipient.userId, status: providerStatus(error) })
      }
    }
    if (failed.length) logger.warn('org compliance reminders: some emails failed', { orgId, failed })
    if (delivered === 0) {
      // Nothing went out: release the claim so the next run tries again (same band only).
      await store.writeLedger(orgId, canonical.orgComplianceReminderLedgerFields(result.ledger))
    }
    return { orgId, due: due.length, recipients: recipients.length, delivered, failed: failed.length }
  }

  async function run() {
    const nowMs = now()
    const enabled = (await store.remindersEnabled()) === true
    const rows = (await store.complianceDocuments()).filter((row) => trimmed(row.orgId))
    const report = []
    for (const row of rows) {
      try {
        report.push(await runForOrganization(row, nowMs, enabled))
      } catch (error) {
        logger.error('org compliance reminders failed', { orgId: row.orgId, message: (error && error.message) || String(error) })
        report.push({ orgId: row.orgId, error: (error && error.message) || String(error) })
      }
    }
    logger.info('org compliance reminders', {
      enabled,
      organizations: report.length,
      due: report.reduce((sum, r) => sum + (r.due || 0), 0),
      delivered: report.reduce((sum, r) => sum + (r.delivered || 0), 0),
      failed: report.filter((r) => r.error || r.failed).map((r) => r.orgId),
    })
    return report
  }

  return { run, runForOrganization }
}

/** The admin-SDK store; users / usersByIds / memberships are the sign-off reminder store's. */
function createAdminOrgComplianceReminderStore(db, rosterStore) {
  return {
    remindersEnabled: async () => {
      const snap = await db.doc('platformConfig/app').get()
      return snap.exists && snap.get('orgComplianceRemindersEnabled') === true
    },
    complianceDocuments: async () => {
      const snap = await db.collectionGroup('orgCompliance').get()
      const byOrg = new Map()
      for (const doc of snap.docs) {
        const orgRef = doc.ref.parent.parent
        if (!orgRef || orgRef.parent.id !== 'organizations') continue
        const row = byOrg.get(orgRef.id) || { orgId: orgRef.id }
        if (doc.id === 'documents') row.documents = doc.data()
        if (doc.id === 'reminders') row.ledger = doc.data()
        byOrg.set(orgRef.id, row)
      }
      return [...byOrg.values()].filter((row) => row.documents)
    },
    organization: async (orgId) => {
      const snap = await db.doc(`organizations/${orgId}`).get()
      return snap.exists ? snap.data() : null
    },
    users: rosterStore.users,
    usersByIds: rosterStore.usersByIds,
    memberships: rosterStore.memberships,
    writeLedger: async (orgId, fields) => {
      const { FieldValue } = require('firebase-admin/firestore')
      await db.doc(`organizations/${orgId}/orgCompliance/reminders`).set({ ...fields, updatedAt: FieldValue.serverTimestamp() })
    },
  }
}

module.exports = { createOrgComplianceReminders, createAdminOrgComplianceReminderStore, renderOrgComplianceReminderEmail }
