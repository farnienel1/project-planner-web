'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  CalendarDaysIcon,
  ClockIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  HomeIcon,
  QuestionMarkCircleIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/solid'

type Article = {
  id: string
  title: string
  summary: string
  href?: string
  body: string[]
}

type Topic = {
  id: string
  title: string
  icon: typeof HomeIcon
  intro: string
  articles: Article[]
}

const TOPICS: Topic[] = [
  {
    id: 'getting-started',
    title: 'Getting started',
    icon: HomeIcon,
    intro: 'How the web app and iPhone app share one organisation, and how to sign in safely.',
    articles: [
      {
        id: 'one-org',
        title: 'One organisation, two apps',
        summary: 'Web and iOS read and write the same live records.',
        body: [
          'ProjectPlanner is one platform. The web app and the iOS app use the same organisation, users, bookings, timesheets and catalogues.',
          'Sign in with the email you were invited with. Each person has one login, even if they belong to more than one organisation.',
          'Switch organisation from Settings when you need to move between companies you belong to. The active organisation is the one whose jobs and people you see.',
        ],
      },
      {
        id: 'roles',
        title: 'Roles and what you can see',
        summary: 'Admin, manager, operative and viewer menus.',
        href: '/dashboard/settings',
        body: [
          'Admins see the full company: users, settings, catalogues, timesheets and reports.',
          'Managers see their team, schedule, book labour, and User Timesheets for people who report to them.',
          'Operatives see Home, My Schedule, Daily Overview (if allowed), My Timesheets, qualifications and materials they need on site.',
          'If a menu item is missing, ask an admin to turn on that permission on your user record. Do not share logins.',
        ],
      },
      {
        id: 'first-login',
        title: 'First login and legal pack',
        summary: 'Confirm email, accept policies, set up the company.',
        href: '/dashboard/privacy',
        body: [
          'New organisations accept the SaaS Agreement, Data Processing Agreement, Acceptable Use Policy and Privacy Policy on first login.',
          'The founder confirms their account from the email we send after organisation setup.',
          'You can re-read every policy any time from Legal policies in the account menu.',
        ],
      },
    ],
  },
  {
    id: 'home-schedule',
    title: 'Home, schedule and labour',
    icon: CalendarDaysIcon,
    intro: 'Daily work, booking people onto jobs, and keeping the week clash-free.',
    articles: [
      {
        id: 'home',
        title: 'Home',
        summary: 'Today, Up Next, warnings and quick actions.',
        href: '/dashboard',
        body: [
          'Home shows today in the organisation’s working calendar, then Up Next for the rest of the coverage window.',
          'Warnings (clashes, unbooked people, expiring qualifications, material cut-off) appear here when detection is on.',
          'Quick actions match your role: book labour, open a project, or jump to timesheets.',
        ],
      },
      {
        id: 'daily',
        title: 'Daily overview',
        summary: 'Who is on which job today.',
        href: '/dashboard/daily-overview',
        body: [
          'Daily overview groups people by job and location for the selected day.',
          'Hours follow the organisation working-hours policy, including unpaid breaks and overtime windows.',
        ],
      },
      {
        id: 'my-schedule',
        title: 'My Schedule',
        summary: 'Your own bookings, office, home and site survey.',
        href: '/dashboard/my-schedule',
        body: [
          'Operatives and managers see their own bookings here.',
          'Office, working from home, site survey and custom locations can be turned on in organisation settings.',
        ],
      },
      {
        id: 'book-labour',
        title: 'Book labour',
        summary: 'Put people on a job without double-booking.',
        href: '/dashboard/book-labour',
        body: [
          'Pick a job, a day and a time window, then choose people who are free and qualified.',
          'Clashes and already-booked hours are blocked the same way as on iOS.',
          'Custom hours use the organisation start/end times and overtime rules.',
        ],
      },
      {
        id: 'weekly',
        title: 'Weekly report',
        summary: 'Hours and pay for the selected period.',
        href: '/dashboard/weekly-report',
        body: [
          'The weekly report follows the current payment-run period when invoicing is set to date ranges.',
          'Rates come from each person’s day or hourly rate. PAYE days show hours but no self-employed invoice amount.',
        ],
      },
    ],
  },
  {
    id: 'timesheets',
    title: 'Timesheets',
    icon: ClockIcon,
    intro: 'Sign your own sheet first. Line managers only see it after that.',
    articles: [
      {
        id: 'mine',
        title: 'My Timesheets',
        summary: 'Day-by-day hours, extras, sign, then invoice.',
        href: '/dashboard/timesheets?surface=mine',
        body: [
          'Open the current pay run. Each day shows the job number and name, hours, day rate, and overtime for that day.',
          'Add Price Work and Expenses before you sign. Signing after extras means you must re-sign.',
          'If you have a line manager: “If you don’t agree with the hours shown, contact your line manager…”',
          'If you have no line manager (typical admin/founder): amend the booking schedule yourself, then Continue to sign. You do not need a counter-signature.',
          'Continue to sign is blue. Draw your signature so iOS can show the same image. Generate Invoice stays grey until you have signed, and until your line manager has counter-signed if you have one. It turns green when the timesheet is fully approved.',
        ],
      },
      {
        id: 'team',
        title: 'User Timesheets',
        summary: 'Awaiting sign-off only after the user has signed.',
        href: '/dashboard/timesheets?surface=team&tab=awaiting',
        body: [
          'A timesheet does not appear in Awaiting sign-off until that person has signed their own sheet.',
          'Tap a person to open their timesheet on a new page.',
          'Use ✓ to approve, ✕ to decline, or edit each day, expense and price-work line, then Sign off & finalise with your signature.',
          'Signed off sheets can generate an invoice. Exported sheets stay in Exported.',
        ],
      },
      {
        id: 'calendar',
        title: 'Pay runs and time zones',
        summary: 'The organisation country sets the calendar, not the phone.',
        body: [
          'Payment-run dates, month length and timesheet stamps use the organisation’s origin country (for example United Kingdom → Europe/London).',
          'If you are abroad in a time zone that is a day ahead, the web app still uses the organisation country. It does not follow the iPhone or Android location.',
          'iOS currently still uses the device calendar until that app is updated to the same org-country rule. For UK organisations both already match unless the phone is set to another region.',
        ],
      },
    ],
  },
  {
    id: 'jobs',
    title: 'Jobs, materials and catalogues',
    icon: WrenchScrewdriverIcon,
    intro: 'Projects, small works, job types, qualifications, materials and wholesalers.',
    articles: [
      {
        id: 'projects',
        title: 'Projects and small works',
        summary: 'Job number, site, managers and live status.',
        href: '/dashboard/projects',
        body: [
          'Each live job has a job number, site name, job type, dates and assigned managers.',
          'Tasks, health and safety and materials sit on the job. Hidden people do not see that job on Home.',
        ],
      },
      {
        id: 'job-types',
        title: 'Job types',
        summary: 'CAT A, Decarbonisation and other catalogue names.',
        href: '/dashboard/job-types',
        body: [
          'Job types are the organisation catalogue. Names still sitting on live projects (including custom types such as Decarbonisation) are restored into the list if they were missing.',
          'Do not save an empty list — that would wipe the catalogue.',
        ],
      },
      {
        id: 'quals',
        title: 'Qualifications',
        summary: 'Templates, My Qualifications and Save.',
        href: '/dashboard/my-qualifications',
        body: [
          'Organisation templates are the shared list. People assign those templates on My Qualifications, then set their own expiry date and certificate.',
          'Upload the file, then tap Save. Leaving the page without Save discards unsaved expiry dates and certificates. Operatives use My Qualifications; managers and admins use Qualifications in Navigate.',
        ],
      },
      {
        id: 'materials',
        title: 'Materials and wholesalers',
        summary: 'Send lists, cut-off and order history.',
        href: '/dashboard/materials',
        body: [
          'Build a materials send list against a job, grouped by category, then send it before the company cut-off.',
          'Wholesaler catalogues and order history are under Navigate when your permissions allow them.',
        ],
      },
      {
        id: 'tasks',
        title: 'Tasks',
        summary: 'To do, in progress, overdue and done.',
        href: '/dashboard/tasks',
        body: [
          'Job tasks sit on a project or small works. Assigned people see them on Home and on the job hub.',
          'Statuses match iOS: To do, In progress, Completed. Overdue is a task still open after its due date.',
        ],
      },
      {
        id: 'hs',
        title: 'Health and safety',
        summary: 'RAMS, toolbox talks and site documents.',
        href: '/dashboard/projects',
        body: [
          'Open a job, then Health & safety. Documents and toolbox talks stay with that job so operatives see the pack on site.',
        ],
      },
      {
        id: 'site-audit',
        title: 'Site audit',
        summary: 'General, variations and snags.',
        href: '/dashboard/site-audit',
        body: [
          'Site audit records issues against a job. Operatives only see this if Site audit is turned on for their account.',
        ],
      },
      {
        id: 'site-map',
        title: 'Site map',
        summary: 'Pins for jobs and office.',
        href: '/dashboard/site-map',
        body: [
          'Admins can drop a map pin on a job so the location used for travel and site cards is exact.',
        ],
      },
    ],
  },
  {
    id: 'people',
    title: 'People and settings',
    icon: UserGroupIcon,
    intro: 'Users, line managers, warnings and company details.',
    articles: [
      {
        id: 'users',
        title: 'Users and line managers',
        summary: 'Who countersigns a timesheet.',
        href: '/dashboard/users',
        body: [
          'Each operative or manager can have one or more line managers, or none (typical for the founding admin).',
          'No line manager means their own signature completes the timesheet. A line manager means they sign first, then the manager counter-signs.',
        ],
      },
      {
        id: 'warnings',
        title: 'Warnings',
        summary: 'Clashes, unbooked labour and days ahead.',
        href: '/dashboard/warnings',
        body: [
          'Warning settings control clash detection, unbooked labour and how many days ahead to scan.',
          '“2 days ahead” includes today. Open warning settings from the Warnings page.',
        ],
      },
      {
        id: 'settings',
        title: 'Organisation settings',
        summary: 'Country, working hours, invoicing, leave.',
        href: '/dashboard/settings',
        body: [
          'Company region/country drives bank holidays and the calendar used for pay runs on web.',
          'Working hours set standard paid hours, unpaid break and overtime multipliers.',
          'Invoicing sets payment-run date ranges or a recurring week, plus payout days and the note shown on timesheets.',
        ],
      },
      {
        id: 'leave',
        title: 'Annual leave',
        summary: 'Self-book and the company year.',
        href: '/dashboard/annual-leave',
        body: [
          'Leave years and carry-over are set in Organisation settings. People with self-book permission request leave from Annual leave.',
          'Approved leave days do not count as unbooked labour on Warnings.',
        ],
      },
      {
        id: 'org-schedule',
        title: 'Organisation schedule',
        summary: 'Everyone’s week in one place.',
        href: '/dashboard/daily-overview',
        body: [
          'Managers and admins use Organisation schedule to see who is on which job. Book labour from a day or from a job hub.',
        ],
      },
      {
        id: 'switch-org',
        title: 'Switch organisation',
        summary: 'One login, many companies.',
        href: '/dashboard/change-organisation',
        body: [
          'If you belong to more than one company, Switch organisation in Settings changes the live jobs and people you see. Data is never mixed between organisations.',
        ],
      },
      {
        id: 'notifications',
        title: 'Notifications',
        summary: 'Inbox for bookings, leave and timesheets.',
        href: '/dashboard/notifications',
        body: [
          'The inbox lists company notifications. Timesheet pending sign-off notices appear for line managers after someone signs their sheet on iOS; web stores the same signed timesheet so the manager can open User Timesheets.',
        ],
      },
    ],
  },
  {
    id: 'legal',
    title: 'Legal, privacy and security',
    icon: ShieldCheckIcon,
    intro: 'The policies you accepted at sign-up, and how to get help.',
    articles: [
      {
        id: 'policies',
        title: 'Legal policies',
        summary: 'SaaS, DPA, Acceptable Use and Privacy.',
        href: '/dashboard/privacy',
        body: [
          'Open Legal policies to read the full pack: SaaS Agreement, Data Processing Agreement, Acceptable Use Policy and Privacy Policy.',
          'These are issued by ProjectPlanner Systems Ltd. Contact info@projectplanner.us for privacy requests.',
        ],
      },
      {
        id: 'password',
        title: 'Password',
        summary: 'Reset while signed in.',
        href: '/dashboard/settings/password',
        body: [
          'Use Reset password in account settings to change your password while signed in.',
        ],
      },
      {
        id: 'contact',
        title: 'Contact',
        summary: 'Company admin first, then ProjectPlanner support.',
        body: [
          'For bookings, rates, qualifications or who is on a job, contact your company administrator or line manager.',
          'For product or account issues, email info@projectplanner.us.',
        ],
      },
    ],
  },
]

export function HelpSupportScreen() {
  const [topicId, setTopicId] = useState(TOPICS[0].id)
  const [articleId, setArticleId] = useState<string | null>(TOPICS[0].articles[0].id)
  const topic = TOPICS.find((row) => row.id === topicId) || TOPICS[0]
  const article = useMemo(
    () => topic.articles.find((row) => row.id === articleId) || topic.articles[0],
    [topic, articleId]
  )

  return (
    <div className="space-y-6 pb-10">
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#185FA5] to-[#0F4C81] p-6 text-white shadow-sm">
        <div className="flex items-start gap-3">
          <QuestionMarkCircleIcon className="h-8 w-8 shrink-0 text-white/90" />
          <div>
            <h1 className="text-[28px] font-semibold tracking-tight">Help & support</h1>
            <p className="mt-1 text-[15px] text-white/85">
              Guides for every part of ProjectPlanner. Open a topic, then an article. Where a page exists, jump straight
              into it.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {TOPICS.map((row) => {
          const Icon = row.icon
          const active = row.id === topic.id
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => {
                setTopicId(row.id)
                setArticleId(row.articles[0].id)
              }}
              className={`rounded-2xl p-4 text-left shadow-[0_1px_2px_rgba(0,0,0,0.10)] ${
                active ? 'bg-[#E6F1FB] ring-2 ring-[#185FA5]/30' : 'bg-white'
              }`}
            >
              <Icon className="h-6 w-6 text-[#185FA5]" />
              <p className="mt-2 text-[16px] font-semibold">{row.title}</p>
              <p className="mt-1 text-[13px] text-ios-muted">{row.intro}</p>
            </button>
          )
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="space-y-2">
          {topic.articles.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => setArticleId(row.id)}
              className={`w-full rounded-xl px-4 py-3 text-left ${
                article.id === row.id ? 'bg-white shadow-sm' : 'text-ios-muted hover:bg-white/70'
              }`}
            >
              <p className="text-[15px] font-semibold text-ios-ink">{row.title}</p>
              <p className="text-[12px]">{row.summary}</p>
            </button>
          ))}
        </div>
        <article className="rounded-2xl bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.10)]">
          <div className="flex items-start gap-2">
            <DocumentTextIcon className="mt-0.5 h-5 w-5 text-[#185FA5]" />
            <h2 className="text-[22px] font-semibold">{article.title}</h2>
          </div>
          <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-slate-700">
            {article.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          {article.href ? (
            <Link
              href={article.href}
              className="mt-5 inline-flex rounded-xl bg-[#185FA5] px-4 py-2.5 text-[15px] font-semibold text-white"
            >
              Open this in the app
            </Link>
          ) : null}
        </article>
      </div>

      <div className="rounded-2xl bg-white p-5 text-[14px] text-ios-muted shadow-sm">
        <p className="flex items-center gap-2 font-semibold text-ios-ink">
          <Cog6ToothIcon className="h-5 w-5 text-[#185FA5]" />
          Still stuck?
        </p>
        <p className="mt-2">
          Ask your company administrator for bookings and permissions. Email{' '}
          <a className="font-semibold text-[#185FA5]" href="mailto:info@projectplanner.us">
            info@projectplanner.us
          </a>{' '}
          for product support.
        </p>
      </div>
    </div>
  )
}
