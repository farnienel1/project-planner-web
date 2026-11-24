/**
 * Rulebook 1.85.0 §32 (owner 24 Nov: an onboarding checklist for new companies): a "Getting started" card at the top
 * of Home for admins, and the same list on the setup wizard's last screen, on web and iOS.
 *
 * Six items that tick themselves off from real data — never a stored tick:
 *   1. Company details and logo   — a name, an office address (line 1 or postcode) and `companyLogoURL`;
 *   2. Working hours               — `payrollTimePolicy` saved;
 *   3. PAYE payday and payment runs — `invoicing.paymentRunMode` and the PAYE payday (`payePaydayMissing` false);
 *   4. Invite your team            — at least one person besides the creator, signed up or invited;
 *   5. First project or small works — at least one job;
 *   6. Insurance & accreditations  — optional: at least one document (§31).
 * The card shows "3 of 6 done". It is hidden once every required item (1–5) is done, or when an admin dismissed it
 * (`organizations/{orgId}.onboardingDismissedAt`, one partial update by an admin, `onboardingDismissWriteFields`; the
 * security rules already let an admin write any organisation field). A count the app has not loaded yet is `null`:
 * the item reads not done and the checklist is not `ready`, so the card never flashes in then out.
 *
 * Each item names its destination (`destination`) and, for web, its path (`href`); iOS maps the destination to its
 * own screen. Pure, JSON in / JSON out.
 */

import { payePaydayMissing } from './payePayrun'

export type OnboardingItemKey = 'company' | 'workingHours' | 'payRuns' | 'team' | 'firstJob' | 'accreditations'

export type OnboardingDestination =
  | 'companyDetails'
  | 'workingHours'
  | 'paymentRuns'
  | 'manageUsers'
  | 'projects'
  | 'insuranceAccreditations'

export type OnboardingItem = {
  key: OnboardingItemKey
  title: string
  detail: string
  done: boolean
  optional: boolean
  destination: OnboardingDestination
  /** Web path. */
  href: string
}

export type OnboardingCounts = {
  /** People of the organisation other than its creator (active, pending or invited); null while loading. */
  people?: number | null
  /** Invitations not used yet; null while loading. */
  pendingInvites?: number | null
  /** Projects plus small works; null while loading. */
  jobs?: number | null
  /** Insurance & accreditation documents (§31); null while loading or for a viewer who cannot read them. */
  complianceDocuments?: number | null
}

export type OnboardingChecklist = {
  items: OnboardingItem[]
  doneCount: number
  total: number
  /** "3 of 6 done". */
  progressLabel: string
  /** 0–1, for the progress bar. */
  progress: number
  /** Every required item done. */
  complete: boolean
  /** Every count the required items need has loaded. */
  ready: boolean
  title: string
  subtitle: string
}

export const ONBOARDING_TITLE = 'Getting started'
export const ONBOARDING_SUBTITLE = 'A few steps to set up your company. Each one ticks itself off when it’s done.'
export const ONBOARDING_DISMISS_LABEL = 'Hide'
export const ONBOARDING_DISMISS_CONFIRM = 'Hide the Getting started card? You can still do every step from Settings.'
export const ONBOARDING_OPTIONAL_LABEL = 'Optional'
export const ONBOARDING_DISMISSED_AT_FIELD = 'onboardingDismissedAt'
export const ONBOARDING_DISMISSED_BY_FIELD = 'onboardingDismissedBy'

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function count(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

function hasOfficeAddress(org: Record<string, unknown>): boolean {
  if (text(org.officeAddressLine1) || text(org.officePostcode)) return true
  const legacy = record(org.officeAddress)
  return !!(text(legacy.line1) || text(legacy.addressLine1) || text(legacy.postcode))
}

/** The checklist for one organisation (`organizations/{orgId}` as stored) and the app's counts. */
export function onboardingChecklist(org: unknown, counts: OnboardingCounts | null | undefined): OnboardingChecklist {
  const o = record(org)
  const c = counts ?? {}
  const people = count(c.people)
  const invites = count(c.pendingInvites)
  const jobs = count(c.jobs)
  const documents = count(c.complianceDocuments)
  const invoicing = record(o.invoicing)
  const policy = record(o.payrollTimePolicy)
  const items: OnboardingItem[] = [
    {
      key: 'company',
      title: 'Add your company details and logo',
      detail: 'Name, office address and logo — shown on reports and emails.',
      done: !!text(o.name) && hasOfficeAddress(o) && !!text(o.companyLogoURL),
      optional: false,
      destination: 'companyDetails',
      href: '/dashboard/settings/company-details',
    },
    {
      key: 'workingHours',
      title: 'Set your working hours',
      detail: 'The working day, lunch break and overtime rates used for pay.',
      done: Object.keys(policy).length > 0,
      optional: false,
      destination: 'workingHours',
      href: '/dashboard/settings/working-hours',
    },
    {
      key: 'payRuns',
      title: 'Set the PAYE payday and payment runs',
      detail: 'When timesheets close and people are paid.',
      done: !!text(invoicing.paymentRunMode) && !payePaydayMissing(o),
      optional: false,
      destination: 'paymentRuns',
      href: '/dashboard/settings/payment-runs',
    },
    {
      key: 'team',
      title: 'Invite your team',
      detail: 'Add your managers and operatives.',
      done: (people ?? 0) + (invites ?? 0) > 0,
      optional: false,
      destination: 'manageUsers',
      href: '/dashboard/settings/users',
    },
    {
      key: 'firstJob',
      title: 'Add your first project or small works',
      detail: 'Then book people onto it.',
      done: (jobs ?? 0) > 0,
      optional: false,
      destination: 'projects',
      href: '/dashboard/projects',
    },
    {
      key: 'accreditations',
      title: 'Add insurance & accreditations',
      detail: 'Keep your certificates ready to share. We remind you before they expire.',
      done: (documents ?? 0) > 0,
      optional: true,
      destination: 'insuranceAccreditations',
      href: '/dashboard/settings/insurance-accreditations',
    },
  ]
  const doneCount = items.filter((item) => item.done).length
  const total = items.length
  const complete = items.every((item) => item.optional || item.done)
  // "Invite your team" is ready once either count is known and says done, or both are known.
  const teamKnown = (people != null && people > 0) || (invites != null && invites > 0) || (people != null && invites != null)
  const ready = teamKnown && jobs != null
  return {
    items,
    doneCount,
    total,
    progressLabel: `${doneCount} of ${total} done`,
    progress: total ? doneCount / total : 0,
    complete,
    ready,
    title: ONBOARDING_TITLE,
    subtitle: ONBOARDING_SUBTITLE,
  }
}

/** True once an admin hid the card for this organisation. */
export function onboardingDismissed(org: unknown): boolean {
  const value = record(org)[ONBOARDING_DISMISSED_AT_FIELD]
  return value != null && value !== false && value !== ''
}

/**
 * Whether Home shows the card: admins (and the super admin) only, once the counts have loaded, while a required item
 * is open and nobody has hidden it.
 */
export function onboardingCardVisible(input: { checklist: OnboardingChecklist; viewerIsAdmin: boolean; org: unknown }): boolean {
  return input.viewerIsAdmin === true && input.checklist.ready && !input.checklist.complete && !onboardingDismissed(input.org)
}

/**
 * The partial update that hides the card (`organizations/{orgId}`): who hid it. The app adds
 * `onboardingDismissedAt` as its SDK server timestamp and the write metadata (`writeMetadataFields`).
 */
export function onboardingDismissWriteFields(userId: unknown): Record<string, unknown> | null {
  const uid = text(userId)
  return uid ? { [ONBOARDING_DISMISSED_BY_FIELD]: uid } : null
}
