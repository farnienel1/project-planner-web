import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { AppLogoMark } from '@/components/ui/AppLogoMark'
import { RegisterInterestForm } from '@/components/marketing/RegisterInterestForm'

export const metadata: Metadata = {
  title: 'Register your interest — Project Planner',
  description:
    'Project Planner runs labour, timesheets, materials and H&S for UK MEP subcontractors. Register your interest and we will set your company up on a one month free trial.',
  openGraph: {
    title: 'Project Planner — built by an MEP contractor, for subcontractors',
    description: 'Every job. Every operative. Every hour. Register your interest for a month free.',
    type: 'website',
    url: 'https://projectplanner.us/register-interest',
  },
  alternates: { canonical: 'https://projectplanner.us/register-interest' },
}

const POINTS = [
  ['Know where everyone is, every day', 'Book labour onto jobs and see clashes before they cost you a day.'],
  ['Timesheets that fill themselves in', 'Hours come from the bookings. Signed on the phone, approved, exported.'],
  ['Nothing falls off the job', 'Variations, small works and materials captured while the work is happening.'],
] as const

const STORY = [
  ['01', 'The Monday morning problem', 'Where is everyone this week? The answer lived on a whiteboard, in four spreadsheets and a WhatsApp group with thirty people in it. Two hours gone before the week had started, and still someone turned up to the wrong site.'],
  ['02', 'The Friday afternoon problem', "Chasing timesheets from people who are still on the tools. Then typing them up. Then finding the hours don't match what was booked, and nobody can remember which is right."],
  ['03', 'The end-of-month problem', "A variation nobody wrote down. The work was done, the materials went in, the lads remember doing it — but there's no record, no photo and no hours. So it never gets paid."],
  ['04', 'So we built the thing we wanted', "Everything off the whiteboard and into one place, designed around trades, RAMS, variations and fit-outs rather than a generic project tool with construction words pasted over it. Other subcontractors started asking if they could use it. That's why this page exists."],
] as const

const FLOW = [
  ['1', 'The office books the work', 'Operatives onto jobs, day by day — full days, halves or custom hours. Clashes and unbooked people are flagged straight away.'],
  ['2', 'Site records what happened', "Tasks ticked off, materials ordered, variations logged with hours, materials and photos. All from the phone, all while it's fresh."],
  ['3', 'The numbers come out the other end', 'Timesheets pre-filled from the bookings, signed and approved, then exported for payroll or invoicing. No re-typing, no arguments.'],
] as const

const MODULES = [
  ['Projects & small works', 'Your pipeline and your reactive jobs, kept apart so a two-hour call-out never clutters a live fit-out.'],
  ['Scheduling & daily overview', 'Who is where, today and next week, with clashes and unbooked labour flagged before they bite.'],
  ['Timesheets & pay runs', 'Signed by the operative, approved by the manager, exported for payroll or invoicing.'],
  ['Variations & materials', 'Labour, materials and photos captured on site, so the QS prices a full picture instead of a memory.'],
  ['Annual leave & overtime', 'Allowances, half days, approvals and UK bank holidays — built in rather than bolted on.'],
  ['H&S and warnings', 'RAMS, site audits, expiring qualifications and a warnings page that tells you what to fix first.'],
] as const

const FAQ = [
  ['When does it launch?', "We're finishing the last pieces now and opening to registered companies first. Register and we'll tell you the date before it goes public — you'll hear it from us, not from an advert."],
  ['What does registering commit me to?', "Nothing at all. No card, no contract. You're telling us you want to see it, and we'll come back to you when there's something worth showing."],
  ['Is it built for MEP specifically?', "Yes. It was built inside a working MEP contractor for its own jobs — trades, RAMS, variations, CAT A and CAT B, decarbonisation, maintenance. That's why it fits rather than nearly fits."],
  ['Do my operatives need training?', "They get the phone app and use three screens: their schedule, their tasks and their timesheet. If it needed training we'd have built it wrong."],
  ['What happens to our spreadsheets?', "Send them over before your setup call and we'll bring across your people, jobs and leave balances, so you start with your own data rather than an empty system."],
  ['Where is our data?', "In the UK/EU on Google Cloud, with role-based access so operatives only see their own work. The privacy policy is linked below and we'll answer anything else on the call."],
] as const

export default function RegisterInterestPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--bg)]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1180px] items-center gap-3 px-4 py-3 sm:px-6">
          <AppLogoMark size={36} radius={10} />
          <b className="font-[family-name:var(--head)] text-[17px]">Project Planner</b>
          <span className="flex-1" />
          <a href="#form" className="rounded-[14px] bg-[var(--blue)] px-4 py-2.5 text-sm font-bold text-white">
            Register interest
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-[1180px] px-4 sm:px-6">
        <section className="grid items-start gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)] lg:gap-12 lg:py-14">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-[var(--proj-t)] px-3.5 py-1.5 text-[13px] font-bold text-[var(--proj)]">
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              Launching soon · built by an MEP contractor
            </span>
            <h1 className="mt-4 font-[family-name:var(--head)] text-[clamp(34px,5vw,52px)] font-extrabold leading-[1.12] tracking-tight">
              The job management app for <span className="text-[var(--blue)]">MEP subcontractors.</span>
            </h1>
            <p className="mt-4 max-w-[52ch] text-lg text-[var(--ink2)]">
              Labour, timesheets, materials, variations and H&amp;S in one place — on site, in the office and in your pocket. We&rsquo;re finishing it now. Register your interest and you&rsquo;ll be among the first in when it opens.
            </p>
            <div className="mt-6 space-y-3">
              {POINTS.map(([title, copy]) => (
                <div key={title}>
                  <b className="block font-[family-name:var(--head)] text-[15.5px]">{title}</b>
                  <span className="text-[14.5px] text-[var(--ink2)]">{copy}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {['iOS, Android & web', 'UK-built, UK support', 'Free trial when we launch', 'No card to register'].map((item) => (
                <span key={item} className="rounded-full border border-[var(--line)] bg-[var(--card)] px-3.5 py-2 text-[13.5px] font-semibold text-[var(--ink2)] shadow-[var(--sh)]">
                  {item}
                </span>
              ))}
            </div>
          </div>
          <div className="lg:sticky lg:top-24">
            <RegisterInterestForm />
          </div>
        </section>

        <Section title="Why we built it" lede="Project Planner started inside a working MEP contractor, because nothing on the market fitted how we actually run jobs.">
          <div className="grid gap-3 md:grid-cols-2">
            {STORY.map(([num, title, copy]) => (
              <article key={num} className="flex gap-3 rounded-[22px] border border-[var(--line)] bg-[var(--card)] p-5 shadow-[var(--sh)]">
                <span className="h-fit rounded-[10px] bg-[var(--blue-t)] px-2.5 py-1.5 font-[family-name:var(--head)] text-[13px] font-extrabold text-[var(--blue)]">{num}</span>
                <div>
                  <b className="block font-[family-name:var(--head)] text-[16.5px]">{title}</b>
                  <p className="mt-1.5 text-[14.5px] text-[var(--ink2)]">{copy}</p>
                </div>
              </article>
            ))}
          </div>
        </Section>

        <Section title="How it works" lede="Three places, one set of information. Book it once and it flows through everything else.">
          <div className="grid gap-3 md:grid-cols-3">
            {FLOW.map(([num, title, copy]) => (
              <article key={num} className="rounded-[22px] border border-[var(--line)] border-t-4 border-t-[var(--blue)] bg-[var(--card)] p-5 shadow-[var(--sh)]">
                <span className="mb-3 grid h-9 w-9 place-items-center rounded-[13px] bg-[var(--blue-t)] font-[family-name:var(--head)] text-[17px] font-extrabold text-[var(--blue)]">{num}</span>
                <b className="block font-[family-name:var(--head)] text-[17px]">{title}</b>
                <p className="mt-1.5 text-[14.5px] text-[var(--ink2)]">{copy}</p>
              </article>
            ))}
          </div>
        </Section>

        <Section title="What's in it" lede="One app, not six subscriptions stitched together.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map(([title, copy]) => (
              <article key={title} className="rounded-[22px] border border-[var(--line)] bg-[var(--card)] p-5 shadow-[var(--sh)]">
                <b className="block font-[family-name:var(--head)] text-[16.5px]">{title}</b>
                <p className="mt-1.5 text-[14.5px] text-[var(--ink2)]">{copy}</p>
              </article>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-4 rounded-3xl border border-[var(--line)] bg-[var(--card)] p-5 shadow-[var(--sh)]">
            <div className="min-w-[240px] flex-1">
              <b className="block font-[family-name:var(--head)] text-[17px]">What it will cost</b>
              <p className="mt-1.5 max-w-[60ch] text-[15px] text-[var(--ink2)]">
                One price for the whole company — unlimited users, every module, all three platforms. From <strong className="text-[var(--ink)]">£149 a month</strong>, with a free trial when you start. No per-seat maths and no setup fee.
              </p>
            </div>
            <a href="#form" className="rounded-[14px] bg-[var(--blue)] px-4 py-2.5 text-sm font-bold text-white">
              Register your interest
            </a>
          </div>
        </Section>

        <Section title="Questions we get asked">
          <div className="max-w-[760px] space-y-2.5">
            {FAQ.map(([question, answer]) => (
              <details key={question} className="rounded-[18px] border border-[var(--line)] bg-[var(--card)]">
                <summary className="cursor-pointer list-none px-4 py-4 font-[family-name:var(--head)] text-base font-bold">{question}</summary>
                <p className="px-4 pb-4 text-[14.5px] text-[var(--ink2)]">{answer}</p>
              </details>
            ))}
          </div>
        </Section>
      </main>
      <footer className="mt-14 border-t border-[var(--line)] px-4 py-7 text-[13.5px] text-[var(--ink3)] sm:px-6">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-3">
          <span>© {new Date().getFullYear()} Projectplanner Systems Ltd</span>
          <span className="flex-1" />
          <Link href="/privacy" className="text-[var(--ink2)]">
            Privacy
          </Link>
          <a href="mailto:info@projectplanner.us" className="text-[var(--ink2)]">
            info@projectplanner.us
          </a>
        </div>
      </footer>
    </div>
  )
}

function Section({ title, lede, children }: { title: string; lede?: string; children: ReactNode }) {
  return (
    <section className="pb-4 pt-12">
      <h2 className="font-[family-name:var(--head)] text-[clamp(26px,3.4vw,34px)] font-extrabold tracking-tight">{title}</h2>
      {lede ? <p className="mb-6 mt-3 max-w-[62ch] text-lg text-[var(--ink2)]">{lede}</p> : <div className="mb-6" />}
      {children}
    </section>
  )
}
