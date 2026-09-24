'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  CalendarDaysIcon,
  ClockIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  HomeIcon,
  QuestionMarkCircleIcon,
  MagnifyingGlassIcon,
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
    intro: 'How to sign in safely, what each role can see, and how the organisation calendar works.',
    articles: [
      {
        id: 'sign-in',
        title: 'Signing in',
        summary: 'Use the email you were invited with.',
        body: [
          'Sign in with the email you were invited with. Each person has one login, even if they belong to more than one organisation.',
          'Switch organisation from Settings when you need to move between companies you belong to. The active organisation is the one whose jobs and people you see.',
          'The separate Developer login on the sign-in page is only for the Project Planner owner. Organisation accounts never get an analytics console.',
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
        id: 'hub',
        title: 'Timesheets',
        summary: 'The main page for your sheet and your team’s sheets.',
        href: '/dashboard/timesheets',
        body: [
          'The Timesheets item in the left menu always opens this main page.',
          'My timesheets is your own pay run. User timesheets is where a line manager counter-signs after the operative has signed.',
          'On My timesheets or User timesheets, the Timesheets button at the top returns to this main page.',
        ],
      },
      {
        id: 'mine',
        title: 'My Timesheets',
        summary: 'Day-by-day hours, extras, sign, then invoice.',
        href: '/dashboard/timesheets/mine',
        body: [
          'Open the current pay run. Each day shows the job number and name, hours, day rate, and overtime for that day.',
          'Add Price Work and Expenses before you sign. Signing after extras means you must re-sign.',
          'If you have a line manager: “If you don’t agree with the hours shown, contact your line manager…”',
          'If you have no line manager (typical admin/founder): amend the booking schedule yourself, then Continue to sign. You do not need a counter-signature.',
          'Continue to sign is blue. Type your name to sign in handwriting, or draw in the box — you can do both. The web saves that as the same signature image iOS already shows. Generate Invoice stays grey until you have signed, and until your line manager has counter-signed if you have one. It turns green when the timesheet is fully approved.',
          'Generate Invoice builds a PDF that matches the iOS invoice (company, name, period, day-by-day job, hours and rates). Share invoice opens the device share sheet when the browser allows it, otherwise downloads the PDF. Generating an invoice does not export the sheet; line managers export PDFs from Signed off.',
        ],
      },
      {
        id: 'team',
        title: 'User Timesheets',
        summary: 'Awaiting sign-off only after the user has signed.',
        href: '/dashboard/timesheets/team?tab=awaiting',
        body: [
          'A timesheet does not appear in Awaiting sign-off until that person has signed their own sheet.',
          'Tap a person to open their timesheet on a new page.',
          'Use ✓ to approve, ✕ to decline, or ⚙ Edit Hours on each day (start, finish and break). Expenses and price work open an amount editor. Then Sign off & finalise with your signature.',
          'After you sign off, the person sees a Line manager adjustments card with struck original amounts and the amounts that will be paid.',
          'On Signed off, Email and export attaches the PDF timesheets to your email for filing, with backup download links. Generating an invoice does not export the sheet.',
        ],
      },
      {
        id: 'calendar',
        title: 'Pay runs and time zones',
        summary: 'The organisation country sets the calendar, not the phone.',
        body: [
          'Payment-run dates, month length and timesheet stamps use the organisation’s origin country (for example United Kingdom → Europe/London, Ireland → Europe/Dublin, Australia → Australia/Sydney). Every region offered at organisation setup is mapped.',
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
        id: 'small-works',
        title: 'Small works',
        summary: 'Reactive jobs in their own list.',
        href: '/dashboard/small-works',
        body: [
          'Small works are the same job record as a project, in a separate list. Create them from Small works or from New.',
          'Job type still comes from the organisation catalogue. Hours booked here fill timesheets the same way as projects.',
        ],
      },
      {
        id: 'job-types',
        title: 'Job types',
        summary: 'CAT A, Decarbonisation and other catalogue names.',
        href: '/dashboard/job-types',
        body: [
          'Job types are the organisation catalogue. CAT A, CAT B, Small Works, Maintenance and Decarbonisation are always restored if missing. Other custom names still sitting on live jobs are merged back in when you open the app.',
          'If a custom type only lived in the old list and was never saved on a job, add it once with Add Job Type. Do not save an empty list.',
        ],
      },
      {
        id: 'quals',
        title: 'Qualifications',
        summary: 'Templates, My Qualifications and Save.',
        href: '/dashboard/my-qualifications',
        body: [
          'Organisation templates are the shared list under Qualifications. People assign those templates on My Qualifications, then set their own expiry date and certificate.',
          'Upload the file, then tap Save. Leaving the page without Save discards unsaved expiry dates and certificates. Operatives use My Qualifications; managers and admins use Qualifications in Navigate.',
        ],
      },
      {
        id: 'org-quals',
        title: 'Organisation qualifications',
        summary: 'The shared template list.',
        href: '/dashboard/qualifications',
        body: [
          'Managers and admins add qualification names here. Those names appear when someone taps Add qualifications on My Qualifications.',
          'Deleting a template does not remove certificates already saved on an operative record.',
        ],
      },
      {
        id: 'wholesalers',
        title: 'Wholesalers',
        summary: 'Supplier contacts and order history.',
        href: '/dashboard/wholesalers',
        body: [
          'Store wholesaler companies and contacts, then send a materials list from a job before the cut-off.',
          'Order history stays on this page so you can see what was sent from web or iOS.',
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
          'Issue a toolbox talk opens the library. Upload a talk opens the library and the custom-talk sheet. Upload RAMS and Add H&S document open those tabs with their upload buttons. You can store more than one RAMS copy.',
          'Tracking shows the signed percentage for each issued talk. Open a talk to view the TBT, sign it, and download it. Signed talks stay available to read again.',
          'Schedule a toolbox talk with a date, time, talk categories, and recipients grouped by trade. Signing a talk or timesheet: type your name (handwriting in the box) or draw — both save as the same signature image iOS already shows.',
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
        href: '/dashboard/settings/users',
        body: [
          'Open Manage users (or Users) from Team. Each operative or manager can have one or more line managers, or none (typical for the founding admin).',
          'No line manager means their own signature completes the timesheet. A line manager means they sign first, then the manager counter-signs.',
          'Add user invites a person with the same email they will use on iOS. Do not create a second login for the same email.',
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
        id: 'clients',
        title: 'Clients',
        summary: 'Who the job is for.',
        href: '/dashboard/clients',
        body: [
          'Clients sit on projects and small works. Add the company name and contacts once, then pick them when you create a job.',
          'The same client list is shared with iOS. Deleting a client does not delete the jobs that already used it.',
        ],
      },
      {
        id: 'operatives',
        title: 'Operatives and managers',
        summary: 'The people catalogues behind bookings.',
        href: '/dashboard/operatives',
        body: [
          'Operatives and managers are organisation catalogues. Book labour, timesheets and qualifications match a person by email to their catalogue record.',
          'Keep the email on the user account the same as the operative or manager record so hours, rates and certificates stay linked.',
        ],
      },
      {
        id: 'managers',
        title: 'Managers',
        summary: 'The managers catalogue.',
        href: '/dashboard/managers',
        body: [
          'The managers list is the catalogue used when you assign a job manager or book a manager onto site.',
          'A manager user account still needs this catalogue email to match, the same as operatives.',
        ],
      },
      {
        id: 'subcontractors',
        title: 'Sub-contractors',
        summary: 'Companies you book onto jobs.',
        href: '/dashboard/sub-contractors',
        body: [
          'Add a sub-contractor company and contacts, then book them onto a job from the job hub.',
          'Sub-contractor bookings are separate from operative timesheets. They do not appear in User Timesheets.',
        ],
      },
      {
        id: 'quotes',
        title: 'Quotes and orders',
        summary: 'Send a materials list to a wholesaler.',
        href: '/dashboard/materials',
        body: [
          'Build the send list on a job, grouped by category. Send it to the wholesaler before the company cut-off.',
          'Order history stays under Wholesalers. The same send is visible on iOS.',
        ],
      },
      {
        id: 'dashboard',
        title: 'Home tiles',
        summary: 'Customise the dashboard layout.',
        href: '/dashboard/edit',
        body: [
          'Admins and managers can rearrange Home tiles. The layout is stored per user for the active organisation.',
          'Warnings, Up Next and quick actions still follow your role even if you hide a tile.',
        ],
      },
      {
        id: 'overview',
        title: 'Overview and reports',
        summary: 'Company hours, logos and weekly totals.',
        href: '/dashboard/weekly-report',
        body: [
          'Weekly report totals hours and pay for the current payment-run period in the organisation country calendar.',
          'Company logo on Home and reports comes from Organisation settings. Book labour from Home or from a job hub.',
        ],
      },
      {
        id: 'notifications',
        title: 'Notifications',
        summary: 'Inbox for bookings, leave and timesheets.',
        href: '/dashboard/notifications',
        body: [
          'The inbox lists company notifications. When someone signs a timesheet that needs a counter-signature, their line managers get “Timesheet needs sign-off” and can open that sheet. When a line manager signs off, the person is notified and other line managers get a peer update.',
        ],
      },
      {
        id: 'ideas',
        title: 'Feedback board',
        summary: 'Shared board across every organisation.',
        href: '/dashboard/ideas',
        body: [
          'Open Feedback from Tools. This is one shared board for every company using Project Planner — not a private list for your organisation. You can see, vote on and comment on feedback from other companies, and they can see yours.',
          'The top-rated request is featured so the most useful feedback is obvious. Search existing suggestions first — similar feedback is shown before you submit a new one.',
          'Vote once per request. Comments stay on the request. Public status is Under review, Planned, In progress, Released or Not planned. There is no organisation analytics console; the product owner reviews Feedback privately.',
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
  const [query, setQuery] = useState('')
  const articleRef = useRef<HTMLDivElement>(null)
  const topic = TOPICS.find((row) => row.id === topicId) || TOPICS[0]
  const needle = query.trim().toLowerCase()
  const article = useMemo(
    () => topic.articles.find((row) => row.id === articleId) || topic.articles[0],
    [topic, articleId]
  )
  const searchHits = useMemo(() => {
    if (!needle) return []
    const hits: Array<{ topic: Topic; article: Article }> = []
    for (const row of TOPICS) {
      for (const item of row.articles) {
        const haystack = [item.title, item.summary, ...item.body].join(' ').toLowerCase()
        if (haystack.includes(needle)) hits.push({ topic: row, article: item })
      }
    }
    return hits
  }, [needle])

  const scrollToArticle = () => {
    window.setTimeout(() => {
      articleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
  }

  const openArticle = (nextTopicId: string, nextArticleId: string) => {
    setTopicId(nextTopicId)
    setArticleId(nextArticleId)
    setQuery('')
    scrollToArticle()
  }

  return (
    <div className="stack pb-10" data-hue="proj">
      <section className="hero">
        <div className="relative z-[1] max-w-2xl">
          <div className="flex items-start gap-3">
            <QuestionMarkCircleIcon className="h-8 w-8 shrink-0" />
            <div className="min-w-0 flex-1">
              <h1 className="big" style={{ fontSize: 28 }}>Help & support</h1>
              <p className="mt-1.5 opacity-85">Guides, answers and a real person when you need one.</p>
              <label className="search mt-4" style={{ maxWidth: 'none' }}>
                <MagnifyingGlassIcon className="h-[18px] w-[18px]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search timesheets, jobs, bookings…"
                  className="pp-in"
                  style={{ height: 54 }}
                  aria-label="Search help"
                />
              </label>
            </div>
          </div>
        </div>
      </section>

      {needle ? (
        <div className="space-y-2">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-[var(--ink3)]">
            {searchHits.length} result{searchHits.length === 1 ? '' : 's'}
          </p>
          {searchHits.length === 0 ? (
            <p className="rounded-2xl bg-white p-5 text-[15px] text-[var(--ink3)] shadow-sm">
              No guides match that search. Try “sign”, “invoice”, “job types” or “qualifications”.
            </p>
          ) : (
            searchHits.map((hit) => (
              <button
                key={`${hit.topic.id}-${hit.article.id}`}
                type="button"
                onClick={() => openArticle(hit.topic.id, hit.article.id)}
                className="w-full rounded-2xl bg-white p-4 text-left shadow-[0_1px_2px_rgba(0,0,0,0.10)]"
              >
                <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--blue)]">{hit.topic.title}</p>
                <p className="mt-1 text-[16px] font-semibold">{hit.article.title}</p>
                <p className="mt-1 text-[13px] text-[var(--ink3)]">{hit.article.summary}</p>
              </button>
            ))
          )}
        </div>
      ) : (
        <>
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
                    scrollToArticle()
                  }}
                  className={`card pad click text-left ${active ? 'ring-2 ring-[var(--blue)]' : ''}`}
                >
                  <Icon className="h-6 w-6 text-[var(--blue)]" />
                  <p className="mt-2 text-[16px] font-semibold">{row.title}</p>
                  <p className="mt-1 text-[13px] text-[var(--ink3)]">{row.intro}</p>
                </button>
              )
            })}
          </div>

          <div ref={articleRef} className="grid gap-6 lg:grid-cols-[280px_1fr] scroll-mt-24">
            <div className="space-y-2">
              {topic.articles.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setArticleId(row.id)}
                  className={`w-full rounded-xl px-4 py-3 text-left ${
                    article.id === row.id ? 'bg-white shadow-sm' : 'text-[var(--ink3)] hover:bg-white/70'
                  }`}
                >
                  <p className="text-[15px] font-semibold text-[var(--ink)]">{row.title}</p>
                  <p className="text-[12px]">{row.summary}</p>
                </button>
              ))}
            </div>
            <article className="rounded-2xl bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.10)]">
              <div className="flex items-start gap-2">
                <DocumentTextIcon className="mt-0.5 h-5 w-5 text-[var(--blue)]" />
                <h2 className="text-[22px] font-semibold">{article.title}</h2>
              </div>
              <ol className="mt-4 list-decimal space-y-3 pl-5 text-[15px] leading-relaxed text-slate-700">
                {article.body.map((paragraph) => (
                  <li key={paragraph}>{paragraph}</li>
                ))}
              </ol>
              {article.href ? (
                <Link
                  href={article.href}
                  className="mt-5 btn primary"
                >
                  Open this in the app
                </Link>
              ) : null}
            </article>
          </div>
        </>
      )}

      <div className="rounded-2xl bg-white p-5 text-[14px] text-[var(--ink3)] shadow-sm">
        <p className="flex items-center gap-2 font-semibold text-[var(--ink)]">
          <Cog6ToothIcon className="h-5 w-5 text-[var(--blue)]" />
          Still stuck?
        </p>
        <p className="mt-2">
          Ask your company administrator for bookings and permissions. Email{' '}
          <a className="font-semibold text-[var(--blue)]" href="mailto:info@projectplanner.us">
            info@projectplanner.us
          </a>{' '}
          for product support.
        </p>
      </div>
    </div>
  )
}
