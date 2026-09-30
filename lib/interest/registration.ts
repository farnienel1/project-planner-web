export const INTEREST_STATUSES = ['new', 'contacted', 'demoBooked', 'trialStarted', 'won', 'lost'] as const

export type InterestStatus = (typeof INTEREST_STATUSES)[number]

export const INTEREST_STATUS_LABEL: Record<InterestStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  demoBooked: 'Demo booked',
  trialStarted: 'Trial started',
  won: 'Won',
  lost: 'Lost',
}

/** Fields a public create is allowed to write. `createdAt` is added as a server timestamp. */
export const INTEREST_CREATE_FIELDS = [
  'firstName',
  'lastName',
  'company',
  'email',
  'phone',
  'role',
  'teamSize',
  'sectors',
  'currentTools',
  'message',
  'consent',
  'status',
  'source',
  'campaign',
  'referrer',
  'pagePath',
  'userAgent',
  'createdAt',
] as const

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export type InterestFieldErrors = Partial<Record<'firstName' | 'lastName' | 'company' | 'email' | 'consent', string>>

export type InterestDraft = {
  firstName: string
  lastName: string
  company: string
  email: string
  phone: string
  role: string
  teamSize: string
  sectors: string[]
  currentTools: string
  message: string
  consent: true
  status: 'new'
  source: string
  campaign: string
  referrer: string
  pagePath: string
  userAgent: string
}

export type InterestBuildResult =
  | { ok: true; silent: true }
  | { ok: false; errors: InterestFieldErrors }
  | { ok: true; silent: false; draft: InterestDraft }

function clip(value: string, max: number): string {
  return value.trim().slice(0, max)
}

export function buildInterestDraft(input: {
  firstName: string
  lastName: string
  company: string
  email: string
  phone: string
  role: string
  teamSize: string
  sectors: string[]
  currentTools: string
  message: string
  consent: boolean
  honeypot: string
  source: string
  campaign: string
  referrer: string
  pagePath: string
  userAgent: string
}): InterestBuildResult {
  const errors: InterestFieldErrors = {}
  const firstName = clip(input.firstName, 99)
  const lastName = clip(input.lastName, 99)
  const company = clip(input.company, 199)
  const email = clip(input.email, 199).toLowerCase()
  if (!firstName) errors.firstName = 'Please add your first name.'
  if (!lastName) errors.lastName = 'Please add your last name.'
  if (!company) errors.company = 'Please add your company name.'
  if (!EMAIL.test(email)) errors.email = 'Please add a valid email address.'
  if (!input.consent) errors.consent = "Please tick the box so we're allowed to reply."
  if (Object.keys(errors).length) return { ok: false, errors }
  if (input.honeypot.trim()) return { ok: true, silent: true }
  return {
    ok: true,
    silent: false,
    draft: {
      firstName,
      lastName,
      company,
      email,
      phone: clip(input.phone, 39),
      role: clip(input.role, 79),
      teamSize: clip(input.teamSize, 39),
      sectors: input.sectors.map((sector) => clip(sector, 39)).filter(Boolean).slice(0, 11),
      currentTools: clip(input.currentTools, 79),
      message: clip(input.message, 2000),
      consent: true,
      status: 'new',
      source: clip(input.source, 79) || 'direct',
      campaign: clip(input.campaign, 119),
      referrer: clip(input.referrer, 499),
      pagePath: clip(input.pagePath, 199),
      userAgent: clip(input.userAgent, 999),
    },
  }
}
