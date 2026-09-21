import type { SubscriptionPlanKey } from '@/lib/stripe/plans'

export const SUPPORT_EMAIL = 'info@projectplanner.us'
export const APP_STORE_URL = 'https://apps.apple.com/app/project-planner'
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=us.projectplanner'

export const COMPANY = {
  legalName: 'Projectplanner Systems Ltd',
  number: '17237456',
  jurisdiction: 'England and Wales',
  address: '71–75 Shelton Street, Covent Garden, London WC2H 9JQ',
} as const

export const PRICE_NOTE = 'Prices per month, excluding VAT. One-month free trial on every plan.'

export type MarketingModuleId =
  | 'scheduling'
  | 'warnings'
  | 'timesheets'
  | 'materials'
  | 'hs'
  | 'projects'
  | 'reports'
  | 'people'

export type MarketingModule = {
  id: MarketingModuleId
  hue: string
  icon: string
  name: string
  short: string
  ticks: string[]
  splitTitle?: string
}

export const MODULES: MarketingModule[] = [
  {
    id: 'scheduling',
    hue: 'sched',
    icon: 'cal',
    name: 'Scheduling & bookings',
    short:
      'Book operatives, managers and sub contractors onto jobs in three steps, with clashes flagged before they happen.',
    ticks: [
      'Pick dates, add people, review and confirm',
      'Full day, AM, PM or custom hours',
      'Double-bookings flagged instantly, weekends included',
      'Operatives see their week in My Schedule on their phone',
    ],
    splitTitle: 'Book the right people. Never twice.',
  },
  {
    id: 'warnings',
    hue: 'warn',
    icon: 'alert',
    name: 'Warnings & daily overview',
    short: 'See who is where today, who is unbooked, and every clash, colour-coded by urgency.',
    ticks: [
      'Unbooked labour against your standard paid day',
      'Clash detection with approve-for-report',
      'Look ahead to end of week, end of invoicing period or any number of days',
      'Past, Today, Soon and Upcoming severity',
    ],
    splitTitle: 'Know what needs fixing before 8am.',
  },
  {
    id: 'timesheets',
    hue: 'ts',
    icon: 'clock',
    name: 'Timesheets & payment runs',
    short: 'Bookings become timesheets automatically. Operatives sign, managers counter-sign, you export.',
    ticks: [
      'Your own pay run periods and pay dates',
      'Weekday, Saturday and Sunday overtime rules',
      'Expenses and price work alongside hours',
      'Awaiting sign-off, signed off and exported views',
    ],
  },
  {
    id: 'materials',
    hue: 'sw',
    icon: 'box',
    name: 'Materials & wholesalers',
    short: 'Order from your catalogue to site by day, with a daily cut-off so nothing arrives late.',
    ticks: [
      'Company material catalogue with CSV import',
      'Orders by day with quote and order history',
      'Wholesalers with primary contacts and send history',
      'Cut-off reminders to every manager, weekends optional',
    ],
  },
  {
    id: 'hs',
    hue: 'hs',
    icon: 'shield',
    name: 'Health & safety',
    short: 'Issue toolbox talks, collect signatures on phones, and keep RAMS with the job.',
    ticks: [
      'A ready-made toolbox talk library by trade, plus your own uploads',
      'Signature tracking with chase reminders and PDF export',
      'RAMS and other H&S documents per project',
      'Site audits with photos: pre-start, snags, variations',
    ],
    splitTitle: 'Every signature, on every phone.',
  },
  {
    id: 'projects',
    hue: 'proj',
    icon: 'folder',
    name: 'Projects & small works',
    short: 'Every job with its programme, client, managers, progress, tasks and location in one place.',
    ticks: [
      'Job types like CAT A, CAT B, new build, decarbonisation',
      'Tasks with owners, priorities and approvals',
      'Control who can see each job',
      'Site pin with Apple Maps and Google Maps links',
    ],
  },
  {
    id: 'reports',
    hue: 'rep',
    icon: 'report',
    name: 'Weekly reports',
    short: 'One click turns the week into a printable report: hours by project, warnings, leave and subs.',
    ticks: [
      'This week, last week, invoicing period or custom range',
      'Hours by person and day, per project',
      'Warnings summary with approved clashes',
      'Sub contractors, annual leave and manager schedules',
    ],
  },
  {
    id: 'people',
    hue: 'user',
    icon: 'users',
    name: 'People, roles & leave',
    short:
      'Admins, managers and operatives each see exactly what they need, with qualifications and leave tracked.',
    ticks: [
      'Admin, manager and operative roles',
      'Day rates, trades and line managers',
      'Annual leave with bank holidays and carry-over rules',
      'Qualifications like SMSTS, SSSTS and NVQs against each person',
    ],
  },
]

export type MarketingPlan = {
  key: SubscriptionPlanKey
  name: string
  desc: string
  price: number
  users: string
  userLimit: number
  popular?: boolean
  features: string[]
}

export const MARKETING_PLANS: MarketingPlan[] = [
  {
    key: 'starter',
    name: 'Starter',
    desc: 'For solo operators and very small teams.',
    price: 29,
    users: 'Up to 5 users',
    userLimit: 5,
    features: [
      'Core project management',
      'Projects & small works',
      'Operative scheduling',
      'iOS, Android & web access',
    ],
  },
  {
    key: 'team',
    name: 'Team',
    desc: 'For small teams starting to scale.',
    price: 69,
    users: 'Up to 15 users',
    userLimit: 15,
    features: [
      'Everything in Starter',
      'More operatives & managers',
      'Materials catalogue',
      'Annual leave',
    ],
  },
  {
    key: 'professional',
    name: 'Professional',
    desc: 'For growing contractors who need the full toolkit.',
    price: 149,
    users: 'Up to 40 users',
    userLimit: 40,
    popular: true,
    features: [
      'Everything in Team',
      'Larger operative roster',
      'Site audits & health & safety',
      'Wholesalers & order history',
    ],
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    desc: 'For larger organisations with advanced needs.',
    price: 299,
    users: '40+ users',
    userLimit: 1_000_000_000,
    features: [
      'Everything in Professional',
      'Highest limits',
      'Sub-contractor scheduling',
      'Priority support',
    ],
  },
]

const PLAN_ORDER: SubscriptionPlanKey[] = ['starter', 'team', 'professional', 'enterprise']

const MODULE_FROM_PLAN: Record<MarketingModuleId, SubscriptionPlanKey> = {
  scheduling: 'starter',
  projects: 'starter',
  warnings: 'starter',
  timesheets: 'starter',
  reports: 'starter',
  people: 'starter',
  materials: 'team',
  hs: 'professional',
}

export function planHasModule(planKey: SubscriptionPlanKey, moduleId: MarketingModuleId): boolean {
  return PLAN_ORDER.indexOf(planKey) >= PLAN_ORDER.indexOf(MODULE_FROM_PLAN[moduleId])
}

export function planHasExtra(planKey: SubscriptionPlanKey, from: SubscriptionPlanKey): boolean {
  return PLAN_ORDER.indexOf(planKey) >= PLAN_ORDER.indexOf(from)
}

export function suggestPlanForUsers(userCount: number): MarketingPlan {
  return (
    MARKETING_PLANS.find((plan) => userCount <= plan.userLimit) || MARKETING_PLANS[MARKETING_PLANS.length - 1]
  )
}

export function setupPathForPlan(planKey?: SubscriptionPlanKey): string {
  return planKey ? `/setup?plan=${planKey}` : '/setup'
}

export function gbp(amount: number): string {
  return amount.toLocaleString('en-GB')
}

export const NAV_LINKS = [
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/download', label: 'Download' },
  { href: '/about', label: 'About' },
  { href: '/support', label: 'Support' },
] as const

export const PAGE_META: Record<string, { title: string; description: string }> = {
  home: {
    title: 'Project Planner',
    description:
      'Scheduling, timesheets, materials and health & safety for contractors. One platform on iOS, Android and web.',
  },
  features: {
    title: 'Features | Project Planner',
    description: 'Eight modules for MEP and construction subcontractors: scheduling, timesheets, materials and H&S.',
  },
  pricing: {
    title: 'Pricing | Project Planner',
    description: 'Flat-rate plans from £29 a month. One-month free trial. No per-user surprises.',
  },
  download: {
    title: 'Download | Project Planner',
    description: 'Get Project Planner on iPhone, Android and the web. One account across every device.',
  },
  about: {
    title: 'About | Project Planner',
    description: 'Built inside a working London MEP contractor for subcontractors who run jobs, people and paperwork.',
  },
  support: {
    title: 'Support | Project Planner',
    description: 'Help setting up Project Planner, inviting your team, and getting a reply from a real person.',
  },
  privacy: {
    title: 'Privacy Policy | Project Planner',
    description: 'How Projectplanner Systems Ltd handles personal information.',
  },
  terms: {
    title: 'Terms of Service | Project Planner',
    description: 'The customer terms that govern use of the Project Planner platform.',
  },
}

export const RATES_FAQ: [string, string][] = [
  [
    'Is there really a free month?',
    'Yes. Set up your organisation, add your team and use every feature on your plan for a month. You choose a plan during setup and payment starts after the trial.',
  ],
  [
    'What counts as a user?',
    'Anyone who signs in: admins, managers and operatives. Sub contractor operatives you book do not need their own login.',
  ],
  [
    'Can I change plans later?',
    'Yes, any time from Settings. Upgrades apply straight away; downgrades apply from your next billing date.',
  ],
  [
    'Do prices include VAT?',
    'No. Prices are shown excluding VAT, which is added at checkout for UK customers.',
  ],
  [
    'What happens if we go over our user limit?',
    'We warn admins before you reach it, across web, iOS and Android, so you can upgrade before anyone is locked out.',
  ],
]

export const SUPPORT_FAQ: [string, string][] = [
  [
    'How do I set up my company?',
    'Use Set up organisation on a computer. It takes about ten minutes and you can skip extras and add them later from Settings.',
  ],
  [
    'How do my operatives get access?',
    'Add them from Manage Users. They get an email invite, download the app on iPhone or Android, and sign in with that email.',
  ],
  [
    'I forgot my password',
    'On the sign-in screen choose Forgot password and we will email a reset link.',
  ],
  [
    'What roles are there?',
    'Admins see everything. Managers run jobs, book labour and sign off timesheets. Operatives see their own schedule, timesheets and H&S.',
  ],
  [
    'Can I import my materials list?',
    'Yes. The material catalogue accepts a CSV import, and you can add or edit items any time.',
  ],
  [
    'How do overtime and bank holidays work?',
    'You set your standard day, break and multipliers for weekdays, Saturday and Sunday during setup. Bank holidays follow the region you choose.',
  ],
  [
    'Is my data safe?',
    'Data is encrypted in transit and at rest, access is controlled by role, and you can export your data at any time. See our Privacy Policy.',
  ],
]
