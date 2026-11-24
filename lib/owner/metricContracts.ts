/**
 * Owner console metric contracts (PLAN §2, spec §1.5 "no invented numbers"): what each figure counts, from where, over
 * which window, how it refreshes and whether test data is in it. Every figure the console shows has one, shown behind
 * its ⓘ, so a test can check no card is missing its definition.
 *
 * Only the figures built so far are listed; each later PR adds its own.
 */

export type MetricContract = {
  /** The card's label. */
  label: string
  /** What is counted and from where (shown behind the ⓘ). */
  definition: string
  /** How often it is read again. */
  refresh: string
  /** What the "vs previous period" line can say today. */
  comparison: string
}

export const COMMAND_CENTRE_METRICS = {
  activeOrganisations: {
    label: 'Active organisations',
    definition:
      'Organisations that are not scheduled for deletion or erased (rulebook organizationDeletionState) with at least one person whose last-seen time (lastSeenAt, web or iPhone) falls in the period (owner decision D1). A person counts for every organisation they belong to: their home organisation and any organisation that lists them as a member. Test organisations (isInternal / isTest) are left out unless Include test data is on; the platform-owner profile is never counted.',
    refresh: 'Read on the server when the page opens, then every 3 minutes while the page is open (the server keeps the organisations and people for up to 200 seconds); Refresh reads again.',
    comparison:
      'No comparison yet: last-seen keeps only the latest visit, so the previous period cannot be worked out. It starts once the daily record is kept (PR 6).',
  },
  activePeople: {
    label: 'Active people',
    definition:
      'People (one per email across every organisation, rulebook rosterPeople) whose last-seen time (lastSeenAt, web or iPhone) falls in the period (owner decision D1). Any segment counts: someone seen in the period and deactivated since is still counted. People whose every users document is flagged isInternal, or whose every organisation is a test one, are left out unless Include test data is on.',
    refresh: 'Read on the server when the page opens, then every 3 minutes while the page is open (the server keeps the organisations and people for up to 200 seconds); Refresh reads again.',
    comparison:
      'No comparison yet: last-seen keeps only the latest visit, so the previous period cannot be worked out. It starts once the daily record is kept (PR 6).',
  },
  mrr: {
    label: 'MRR',
    definition:
      'Monthly recurring revenue now: the sum of billing.mrrPence (written by the Stripe webhook) of organisations whose billing.status is active, or past_due while still within the 7-day grace (rulebook hasAccess). Trials are left out. A paying organisation with no mrrPence (missing or 0) is listed as "MRR missing" and never filled in from the list price. A company that is scheduled for deletion, or cancelling at the end of its paid period, still counts while it is paying. Test organisations are left out unless Include test data is on. It is today\'s figure whatever period is chosen.',
    refresh: 'Read on the server when the page opens, then every 3 minutes while the page is open (the server keeps the organisations and people for up to 200 seconds); Refresh reads again.',
    comparison: 'No comparison yet: past MRR is not stored. It starts once the daily record is kept (PR 6).',
  },
  newPeople: {
    label: 'New people',
    definition:
      'People (one per email, rulebook rosterPeople) whose earliest users document was created in the period. Invite placeholders that have not signed up yet count too and are marked Pending. Test people are left out unless Include test data is on.',
    refresh: 'Read on the server when the page opens, then every 3 minutes while the page is open; Refresh reads again.',
    comparison: 'Compared with the same stretch of the previous period (by the same creation times).',
  },
  newOrganisations: {
    label: 'New organisations',
    definition:
      'Organisation documents created in the period, without the platform-owner profile. Test organisations are left out unless Include test data is on.',
    refresh: 'Read on the server when the page opens, then every 3 minutes while the page is open; Refresh reads again.',
    comparison: 'Compared with the same stretch of the previous period (by the same creation times).',
  },
} as const satisfies Record<string, MetricContract>

export type CommandCentreMetricKey = keyof typeof COMMAND_CENTRE_METRICS

/** The rules behind each "needs attention" reason (shown in the list's ⓘ). */
export const ATTENTION_REASON_DEFINITIONS = {
  scheduled: 'Scheduled for deletion (organizations/{id}.deletion, rulebook organizationDeletionState): the days left before it is erased.',
  paymentFailed: 'billing.status is past_due or unpaid. "In grace" while the apps are still open (rulebook hasAccess, 7 days after the failed payment).',
  lapsed: 'Any other billing status that closes the apps (rulebook hasAccess is false): canceled, incomplete, paused and so on.',
  trialEnding: 'billing.status is trialing and billing.trialEnd is in the next 7 days (or has already passed while the status still says trialing).',
  cancelling: 'billing.cancelAtPeriodEnd is set: the subscription stops at the end of the paid period.',
  unfinished: 'Setup unfinished: the organisation has no name stored, or still has the unfinished-setup label.',
  quiet: 'Quiet: nobody in the organisation has been seen (lastSeenAt) for 14 days or more, and the organisation is at least 14 days old. Organisations scheduled for deletion or with setup unfinished are listed under those reasons instead.',
} as const

export type AttentionReasonKind = keyof typeof ATTENTION_REASON_DEFINITIONS

export const LIVE_FEED_DEFINITION =
  'The newest 25 of: people created (sign-ups and invite placeholders), organisations created, and owner actions from the audit log (adminAuditLog; one line per action, its latest step). Signed timesheets are not in the feed yet: they come with the rollups (PR 6). Test organisations and people are left out unless Include test data is on; owner actions are always shown. Read again every 3 minutes while the page is open.'
