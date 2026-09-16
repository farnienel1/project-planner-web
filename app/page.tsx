'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { MarketingFooter, MarketingHeader } from '@/components/marketing/MarketingChrome'

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
      <div className="flex min-h-screen items-center justify-center bg-[#f6f8fb]">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    )
  }

  const features = [
    {
      title: 'Projects & small works',
      description: 'Job numbers, sites, clients, live status and the same records your team sees on iPhone.',
      iconBg: 'bg-[#e1f5ee]',
      iconColor: 'text-[#0f6e56]',
      icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
    },
    {
      title: 'People',
      description: 'Operatives, managers, permissions and invitations — managed on the web, used on site.',
      iconBg: 'bg-[#ebe9f9]',
      iconColor: 'text-[#534ab7]',
      icon: 'M17 20h5v-2a3 3 0 00-5.4-1.9M17 20H7m10 0v-2c0-.7-.1-1.3-.4-1.9M7 20H2v-2a3 3 0 015.4-1.9M7 20v-2c0-.7.1-1.3.4-1.9m0 0a5 5 0 019.3 0M15 7a3 3 0 11-6 0 3 3 0 016 0',
    },
    {
      title: 'Scheduling',
      description: 'Book labour, catch clashes, and see the day and week across the organisation.',
      iconBg: 'bg-[#fceaf0]',
      iconColor: 'text-[#993556]',
      icon: 'M8 7V3m8 4V3M4 11h16M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    },
    {
      title: 'Timesheets & leave',
      description: 'Payroll hours, manager review and annual leave on a desktop layout, not a phone stack.',
      iconBg: 'bg-[#e6f0fc]',
      iconColor: 'text-[#2563eb]',
      icon: 'M9 17v-2m3 2v-4m3 4v-6m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.6a1 1 0 01.7.3l4.4 4.4a1 1 0 01.3.7V19a2 2 0 01-2 2z',
    },
    {
      title: 'Same Firebase data',
      description: 'Create a job here, it appears on iOS. Book a day on the phone, it appears on the website.',
      iconBg: 'bg-[#fbeed9]',
      iconColor: 'text-[#b45309]',
      icon: 'M9 12l2 2 4-4m5.6-1A12 12 0 0112 21 12 12 0 013.4 9 12 12 0 0012 3a12 12 0 008.6 6',
    },
    {
      title: 'Organisation setup',
      description: 'New companies start on the web: Stripe plans, company details, then invite the team.',
      iconBg: 'bg-[#f1f3f6]',
      iconColor: 'text-slate-600',
      icon: 'M12 18h.01M8 21h8a1 1 0 001-1V4a1 1 0 00-1-1H8a1 1 0 00-1 1v16a1 1 0 001 1z',
    },
  ]

  return (
    <div className="min-h-screen bg-[#f6f8fb] text-[#0b1220]">
      <MarketingHeader active="home" />

      <section className="relative overflow-hidden bg-gradient-to-b from-white to-[#f6f8fb] py-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(83,74,183,0.14),transparent_40%),radial-gradient(circle_at_20%_0%,rgba(37,99,235,0.14),transparent_35%)]" />
        <div className="relative mx-auto grid w-full max-w-[1160px] gap-12 px-6 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
          <div>
            <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-[#185fa5] shadow-sm">
              <span className="h-2 w-2 rounded-full bg-[#0f6e56]" />
              Website for the office · iOS for site
            </span>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
              The Project Planner website
            </h1>
            <p className="mt-5 max-w-xl text-lg text-slate-600">
              A full desktop product for construction and M&amp;E teams — not a stretched iPhone screen.
              Run projects, people, scheduling and reports in the browser. The iOS app stays for the site.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/setup"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(37,99,235,0.35)] transition hover:bg-blue-700"
              >
                Set up organisation
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:-translate-y-0.5"
              >
                Sign in to the web app
              </Link>
              <a
                href="#download"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:-translate-y-0.5"
              >
                iOS app
              </a>
            </div>
          </div>

          <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
              <span className="ml-3 text-xs font-medium text-slate-400">app.projectplanner.us</span>
            </div>
            <div className="grid min-h-[280px] grid-cols-[200px_1fr]">
              <div className="border-r border-slate-100 bg-white p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Main Menu</p>
                <div className="mt-3 space-y-2 text-sm font-medium text-slate-700">
                  {['Home', 'Projects', 'Small works', 'Operatives', 'Timesheets', 'Settings'].map((item) => (
                    <div key={item} className="rounded-lg bg-slate-50 px-3 py-2">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-[#f6f8fb] p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#185FA5]">Today&apos;s overview</p>
                <p className="mt-1 text-xl font-extrabold text-slate-900">Desktop Home</p>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-white p-3 shadow-sm">
                    <p className="text-lg font-bold">5</p>
                    <p className="text-[11px] text-slate-500">Live jobs</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 shadow-sm">
                    <p className="text-lg font-bold">12</p>
                    <p className="text-[11px] text-slate-500">On site</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 shadow-sm">
                    <p className="text-lg font-bold">3</p>
                    <p className="text-[11px] text-slate-500">Tasks due</p>
                  </div>
                </div>
                <p className="mt-4 text-xs text-slate-500">Sidebar + wide content — built for a monitor, not a phone.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#0b1220] py-12 text-white">
        <div className="mx-auto grid w-full max-w-[1160px] grid-cols-2 gap-8 px-6 text-center md:grid-cols-4">
          <div>
            <p className="text-3xl font-extrabold text-blue-200">Web</p>
            <p className="mt-1 text-sm text-slate-300">Office &amp; desktop</p>
          </div>
          <div>
            <p className="text-3xl font-extrabold text-blue-200">iOS</p>
            <p className="mt-1 text-sm text-slate-300">On site</p>
          </div>
          <div>
            <p className="text-3xl font-extrabold text-blue-200">1</p>
            <p className="mt-1 text-sm text-slate-300">Firebase organisation</p>
          </div>
          <div>
            <p className="text-3xl font-extrabold text-blue-200">Live</p>
            <p className="mt-1 text-sm text-slate-300">Bookings sync both ways</p>
          </div>
        </div>
      </section>

      <section id="product" className="py-16">
        <div className="mx-auto w-full max-w-[1160px] px-6">
          <div className="rounded-[28px] border border-slate-200 bg-white p-8 lg:p-12">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-600">Out of login</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight">Public website pages</h2>
            <p className="mt-3 max-w-2xl text-slate-600">
              You do not have to land on the iPhone login. The website has its own pages before anyone signs in.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <Link href="/" className="rounded-2xl border border-slate-200 p-5 hover:border-blue-200 hover:bg-slate-50">
                <p className="font-bold">Home</p>
                <p className="mt-1 text-sm text-slate-600">This marketing site.</p>
              </Link>
              <Link href="/setup" className="rounded-2xl border border-slate-200 p-5 hover:border-blue-200 hover:bg-slate-50">
                <p className="font-bold">Set up organisation</p>
                <p className="mt-1 text-sm text-slate-600">Plans, company details, first users.</p>
              </Link>
              <Link href="/login" className="rounded-2xl border border-slate-200 p-5 hover:border-blue-200 hover:bg-slate-50">
                <p className="font-bold">Sign in</p>
                <p className="mt-1 text-sm text-slate-600">Desktop form on large screens; iOS-style only on a phone.</p>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="pb-20">
        <div className="mx-auto w-full max-w-[1160px] px-6">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-600">Everything in one place</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
              What the website is for
            </h2>
            <p className="mt-4 text-slate-600">
              Same organisation as iOS. Laid out for a laptop: sidebar, tables, and wide Home — not a phone clone.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <article
                key={feature.title}
                className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
              >
                <div className={`mb-5 grid h-12 w-12 place-items-center rounded-xl ${feature.iconBg} ${feature.iconColor}`}>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={feature.icon} />
                  </svg>
                </div>
                <h3 className="text-xl font-bold tracking-tight text-slate-900">{feature.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{feature.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="download" className="pb-20">
        <div className="mx-auto w-full max-w-[1160px] px-6">
          <div className="rounded-[32px] bg-gradient-to-br from-blue-600 to-blue-700 px-8 py-14 text-center text-white shadow-[0_18px_50px_rgba(37,99,235,0.35)]">
            <h2 className="text-4xl font-extrabold tracking-tight">iOS for site, website for the office</h2>
            <p className="mt-3 text-blue-100">
              Download the phone app for operatives. Sign in here when you are at a desk.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <a href="https://apps.apple.com/app/project-planner" className="rounded-xl bg-[#0b1220] px-6 py-3 text-sm font-semibold text-white">
                App Store
              </a>
              <Link href="/login" className="rounded-xl border border-white/40 bg-white/15 px-6 py-3 text-sm font-semibold text-white">
                Sign in on the web
              </Link>
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
