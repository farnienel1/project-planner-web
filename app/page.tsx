'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'

export default function Home() {
  const router = useRouter()
  const { user, loading } = useAuthStore()

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.push('/dashboard')
      }
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f8fb]">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const features = [
    {
      title: 'Project Management',
      description: 'Track projects from start to finish with timelines, budgets, and progress monitoring.',
      iconBg: 'bg-[#e1f5ee]',
      iconColor: 'text-[#0f6e56]',
      icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
    },
    {
      title: 'Team Management',
      description: 'Manage operatives and assign work efficiently across your construction teams.',
      iconBg: 'bg-[#ebe9f9]',
      iconColor: 'text-[#534ab7]',
      icon: 'M17 20h5v-2a3 3 0 00-5.4-1.9M17 20H7m10 0v-2c0-.7-.1-1.3-.4-1.9M7 20H2v-2a3 3 0 015.4-1.9M7 20v-2c0-.7.1-1.3.4-1.9m0 0a5 5 0 019.3 0M15 7a3 3 0 11-6 0 3 3 0 016 0',
    },
    {
      title: 'Smart Scheduling',
      description: 'Schedule work and detect conflicts to keep projects moving on time.',
      iconBg: 'bg-[#fceaf0]',
      iconColor: 'text-[#993556]',
      icon: 'M8 7V3m8 4V3M4 11h16M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    },
    {
      title: 'Reports & Analytics',
      description: 'Generate insights to optimize performance and resource allocation.',
      iconBg: 'bg-[#e6f0fc]',
      iconColor: 'text-[#2563eb]',
      icon: 'M9 17v-2m3 2v-4m3 4v-6m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.6a1 1 0 01.7.3l4.4 4.4a1 1 0 01.3.7V19a2 2 0 01-2 2z',
    },
    {
      title: 'Secure & Private',
      description: 'Your project data is encrypted and protected end-to-end.',
      iconBg: 'bg-[#fbeed9]',
      iconColor: 'text-[#b45309]',
      icon: 'M9 12l2 2 4-4m5.6-1A12 12 0 0112 21 12 12 0 013.4 9 12 12 0 0012 3a12 12 0 008.6 6',
    },
    {
      title: 'Mobile First',
      description: 'Designed for iOS and fully available from your web browser.',
      iconBg: 'bg-[#f1f3f6]',
      iconColor: 'text-slate-600',
      icon: 'M12 18h.01M8 21h8a1 1 0 001-1V4a1 1 0 00-1-1H8a1 1 0 00-1 1v16a1 1 0 001 1z',
    },
  ]

  return (
    <div className="min-h-screen bg-[#f6f8fb] text-[#0b1220]">
      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-[68px] w-full max-w-[1160px] items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-3 font-extrabold tracking-tight">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </span>
            Project Planner
          </Link>

          <nav className="flex items-center gap-8">
            <a href="#features" className="hidden text-sm font-medium text-slate-600 hover:text-slate-900 sm:block">Features</a>
            <a href="#download" className="hidden text-sm font-medium text-slate-600 hover:text-slate-900 sm:block">Download</a>
            <a href="mailto:support@projectplanner.app" className="hidden text-sm font-medium text-slate-600 hover:text-slate-900 sm:block">Support</a>
            <Link href="/setup" className="hidden rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white sm:inline-flex">
              Set up organisation
            </Link>
            <Link href="/login" className="rounded-full bg-[#0b1220] px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5">
              Sign In
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden bg-gradient-to-b from-white to-[#f6f8fb] py-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(83,74,183,0.14),transparent_40%),radial-gradient(circle_at_20%_0%,rgba(37,99,235,0.14),transparent_35%)]" />
        <div className="relative mx-auto grid w-full max-w-[1160px] gap-12 px-6 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
          <div>
            <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-[#185fa5] shadow-sm">
              <span className="h-2 w-2 rounded-full bg-[#0f6e56]" />
              Built for construction &amp; M&amp;E teams
            </span>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
              Run every project
              <br />
              from site to sign-off.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-slate-600">
              The comprehensive project management tool for construction teams. Track projects,
              manage operatives, and schedule work efficiently on iOS and the web.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/setup" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(37,99,235,0.35)] transition hover:bg-blue-700">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                Set up organisation
              </Link>
              <Link href="/login" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:-translate-y-0.5">
                Sign in
              </Link>
              <a href="#download" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:-translate-y-0.5">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />
                </svg>
                Download iOS App
              </a>
            </div>
          </div>

          <div className="mx-auto w-full max-w-sm rounded-[32px] border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 p-5 text-white">
              <p className="text-[11px] font-bold tracking-widest text-blue-100">TODAY&apos;S OVERVIEW</p>
              <p className="mt-1 text-xl font-extrabold">5 active projects</p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-white/15 p-2 text-center"><p className="text-lg font-bold">5</p><p className="text-[10px] text-blue-100">Projects</p></div>
                <div className="rounded-lg bg-white/15 p-2 text-center"><p className="text-lg font-bold">12</p><p className="text-[10px] text-blue-100">Operatives</p></div>
                <div className="rounded-lg bg-white/15 p-2 text-center"><p className="text-lg font-bold">55</p><p className="text-[10px] text-blue-100">Bookings</p></div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {['Projects', 'Small Works', 'Operatives', 'Schedule', 'Reports', 'Settings'].map((tile) => (
                <div key={tile} className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-center text-[11px] font-semibold text-slate-700">
                  {tile}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#0b1220] py-12 text-white">
        <div className="mx-auto grid w-full max-w-[1160px] grid-cols-2 gap-8 px-6 text-center md:grid-cols-4">
          <div><p className="text-3xl font-extrabold text-blue-200">5+</p><p className="mt-1 text-sm text-slate-300">Active project types</p></div>
          <div><p className="text-3xl font-extrabold text-blue-200">100%</p><p className="mt-1 text-sm text-slate-300">Cloud synced</p></div>
          <div><p className="text-3xl font-extrabold text-blue-200">iOS</p><p className="mt-1 text-sm text-slate-300">+ full web app</p></div>
          <div><p className="text-3xl font-extrabold text-blue-200">24/7</p><p className="mt-1 text-sm text-slate-300">Access anywhere</p></div>
        </div>
      </section>

      <section id="features" className="py-20">
        <div className="mx-auto w-full max-w-[1160px] px-6">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-600">Everything in one place</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Everything you need to manage construction projects
            </h2>
            <p className="mt-4 text-slate-600">
              From first quote to final sign-off, keep projects, people, scheduling, and reporting in one tool.
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
            <h2 className="text-4xl font-extrabold tracking-tight">Download Project Planner</h2>
            <p className="mt-3 text-blue-100">Available on the App Store, or sign in to the web app from any browser.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <a href="https://apps.apple.com/app/project-planner" className="rounded-xl bg-[#0b1220] px-6 py-3 text-sm font-semibold text-white">
                App Store
              </a>
              <Link href="/login" className="rounded-xl border border-white/40 bg-white/15 px-6 py-3 text-sm font-semibold text-white">
                Web App
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white py-10">
        <div className="mx-auto w-full max-w-[1160px] px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="font-semibold text-slate-900">Project Planner</p>
            <div className="flex flex-wrap items-center gap-5 text-sm text-slate-600">
              <a href="mailto:support@projectplanner.app">Support</a>
              <a href="https://projectplanner.us/privacy-policy.html">Privacy Policy</a>
              <a href="https://projectplanner.us/terms-of-service.html">Terms of Service</a>
            </div>
          </div>
          <p className="mt-6 border-t border-slate-100 pt-6 text-center text-xs text-slate-500">
            © 2025 Project Planner. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}




