'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { ProjectPlannerLogo } from '@/components/ui/ProjectPlannerLogo'

const features = [
  {
    title: 'Project control',
    description: 'Live status, budgets, and site progress in one place — from first quote to sign-off.',
    icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
  },
  {
    title: 'People & trades',
    description: 'Operatives, managers, and subcontractors with skills, availability, and clash detection.',
    icon: 'M17 20h5v-2a3 3 0 00-5.4-1.9M17 20H7m10 0v-2c0-.7-.1-1.3-.4-1.9M7 20H2v-2a3 3 0 015.4-1.9M7 20v-2c0-.7.1-1.3.4-1.9m0 0a5 5 0 019.3 0M15 7a3 3 0 11-6 0 3 3 0 016 0',
  },
  {
    title: 'Scheduling',
    description: 'Day and week views that surface conflicts before they hit the site.',
    icon: 'M8 7V3m8 4V3M4 11h16M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  },
  {
    title: 'Materials & tasks',
    description: 'Orders, send records, and task boards tied to the same job as the iOS app.',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  },
  {
    title: 'Health & safety',
    description: 'Site audits, toolbox talks, and qualifications without a second system.',
    icon: 'M9 12l2 2 4-4m5.6-1A12 12 0 0112 21 12 12 0 013.4 9 12 12 0 0012 3a12 12 0 008.6 6',
  },
  {
    title: 'Same data as iOS',
    description: 'One Firebase organisation. Changes on web appear on the phone, and the other way around.',
    icon: 'M12 18h.01M8 21h8a1 1 0 001-1V4a1 1 0 00-1-1H8a1 1 0 00-1 1v16a1 1 0 001 1z',
  },
]

const metrics = [
  { value: 'Projects', label: 'Pipeline, small works, live status' },
  { value: 'Schedule', label: 'Bookings, clashes, daily overview' },
  { value: 'People', label: 'Operatives, leave, utilisation' },
  { value: 'Compliance', label: 'Audits, warnings, qualifications' },
]

export default function Home() {
  const router = useRouter()
  const { user, loading } = useAuthStore()

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f7f9]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-[#f6f7f9]/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-[1120px] items-center justify-between px-6">
          <ProjectPlannerLogo href="/" size="sm" />
          <nav className="flex items-center gap-1 sm:gap-2">
            <a href="#product" className="hidden rounded-lg px-3 py-2 text-[13px] font-medium text-slate-500 hover:bg-white hover:text-slate-900 sm:inline">
              Product
            </a>
            <a href="#features" className="hidden rounded-lg px-3 py-2 text-[13px] font-medium text-slate-500 hover:bg-white hover:text-slate-900 sm:inline">
              Features
            </a>
            <Link href="/login" className="rounded-lg px-3 py-2 text-[13px] font-medium text-slate-600 hover:text-slate-900">
              Sign in
            </Link>
            <Link
              href="/setup"
              className="rounded-lg bg-slate-900 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-slate-800"
            >
              Set up organisation
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto w-full max-w-[1120px] px-6 pb-8 pt-16 sm:pt-20">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Construction operations</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.035em] text-slate-900 sm:text-[56px] sm:leading-[1.05]">
            Run the site from one desk.
          </h1>
          <p className="mt-5 max-w-lg text-[16px] leading-7 text-slate-500">
            Project Planner is the desktop companion to the iOS app — projects, people, scheduling, and
            compliance on the same organisation data your team already uses on site.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/setup"
              className="inline-flex h-11 items-center rounded-lg bg-slate-900 px-5 text-[13px] font-medium text-white hover:bg-slate-800"
            >
              Set up organisation
            </Link>
            <Link
              href="/login"
              className="inline-flex h-11 items-center rounded-lg border border-slate-200 bg-white px-5 text-[13px] font-medium text-slate-700 hover:border-slate-300"
            >
              Sign in
            </Link>
          </div>
        </div>

        <div id="product" className="mt-14 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_24px_48px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-slate-300" />
              <span className="h-2 w-2 rounded-full bg-slate-300" />
              <span className="h-2 w-2 rounded-full bg-slate-300" />
            </div>
            <p className="text-[11px] font-medium tracking-wide text-slate-400">Home · live overview</p>
            <span className="w-10" />
          </div>
          <div className="grid gap-0 lg:grid-cols-[220px_1fr]">
            <aside className="hidden border-r border-slate-100 bg-[#fafbfc] px-4 py-5 lg:block">
              <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Workspace</p>
              <div className="mt-3 space-y-0.5">
                {['Home', 'Projects', 'Schedule', 'Operatives', 'Tasks', 'Settings'].map((item, i) => (
                  <div
                    key={item}
                    className={`rounded-lg px-2.5 py-2 text-[13px] ${
                      i === 0 ? 'bg-white font-medium text-slate-900 shadow-sm ring-1 ring-slate-200/80' : 'text-slate-500'
                    }`}
                  >
                    {item}
                  </div>
                ))}
              </div>
            </aside>
            <div className="p-5 sm:p-7">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-slate-900">Home</h2>
                  <p className="mt-1 text-[13px] text-slate-500">Live numbers across delivery, labour, and site work.</p>
                </div>
                <span className="hidden rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-medium text-slate-600 sm:inline">
                  Today
                </span>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'Active projects', value: '12' },
                  { label: 'Open tasks', value: '48' },
                  { label: 'On site today', value: '27' },
                  { label: 'Warnings', value: '3' },
                ].map((card) => (
                  <div key={card.label} className="rounded-xl border border-slate-200 bg-white px-4 py-4">
                    <p className="text-[12px] font-medium text-slate-500">{card.label}</p>
                    <p className="mt-2 text-[28px] font-semibold tracking-tight text-slate-900">{card.value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid gap-3 lg:grid-cols-[1.4fr_0.8fr]">
                <div className="h-36 rounded-xl border border-slate-200 bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f6_100%)] p-4">
                  <p className="text-[12px] font-medium text-slate-500">Live schedule</p>
                  <div className="mt-4 space-y-2">
                    {['Northgate M&E · full day', 'Riverside Block B · AM', 'Plant room works · PM'].map((row) => (
                      <div key={row} className="flex items-center justify-between rounded-lg bg-white/80 px-3 py-2 text-[12px] text-slate-600 ring-1 ring-slate-200/70">
                        <span>{row}</span>
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 px-4 py-4">
                  <p className="text-[12px] font-medium text-slate-500">Open tasks</p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight">14</p>
                  <p className="mt-1 text-[12px] text-slate-400">Across 6 live jobs</p>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full w-2/3 rounded-full bg-slate-900" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200/80 bg-white">
        <div className="mx-auto grid w-full max-w-[1120px] grid-cols-2 gap-8 px-6 py-10 sm:grid-cols-4">
          {metrics.map((item) => (
            <div key={item.value}>
              <p className="text-sm font-semibold tracking-tight text-slate-900">{item.value}</p>
              <p className="mt-1 text-[13px] leading-5 text-slate-500">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="mx-auto w-full max-w-[1120px] px-6 py-20">
        <div className="max-w-xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Platform</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-900">
            Everything the job needs, without the noise.
          </h2>
          <p className="mt-3 text-[15px] leading-7 text-slate-500">
            Built for construction and M&amp;E teams who already run the iOS app. The web portal is the same
            work, laid out for a desk.
          </p>
        </div>
        <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <article key={feature.title} className="bg-white p-7">
              <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                <path strokeLinecap="round" strokeLinejoin="round" d={feature.icon} />
              </svg>
              <h3 className="mt-5 text-[15px] font-semibold tracking-tight text-slate-900">{feature.title}</h3>
              <p className="mt-2 text-[13px] leading-6 text-slate-500">{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1120px] px-6 pb-20">
        <div className="flex flex-col items-start justify-between gap-6 rounded-2xl border border-slate-200 bg-white px-8 py-10 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Ready when the site is.</h2>
            <p className="mt-2 max-w-md text-[14px] leading-6 text-slate-500">
              Create the organisation on desktop, then keep working from the iOS app. Same logins. Same jobs.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/setup"
              className="inline-flex h-11 items-center rounded-lg bg-slate-900 px-5 text-[13px] font-medium text-white hover:bg-slate-800"
            >
              Set up organisation
            </Link>
            <a
              href="https://apps.apple.com/app/project-planner"
              className="inline-flex h-11 items-center rounded-lg border border-slate-200 px-5 text-[13px] font-medium text-slate-700 hover:border-slate-300"
            >
              App Store
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-[1120px] flex-wrap items-center justify-between gap-4 px-6 py-8">
          <p className="text-[13px] font-medium text-slate-900">Project Planner</p>
          <div className="flex flex-wrap items-center gap-5 text-[13px] text-slate-500">
            <a href="mailto:support@projectplanner.app" className="hover:text-slate-900">
              Support
            </a>
            <a href="https://projectplanner.us/privacy-policy.html" className="hover:text-slate-900">
              Privacy
            </a>
            <a href="https://projectplanner.us/terms-of-service.html" className="hover:text-slate-900">
              Terms
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
