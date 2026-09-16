import Link from 'next/link'
import { ProjectPlannerLogo } from '@/components/ui/ProjectPlannerLogo'

export function MarketingHeader({ active }: { active?: 'home' | 'login' | 'setup' }) {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-[68px] w-full max-w-[1160px] items-center justify-between px-6">
        <ProjectPlannerLogo href="/" size="sm" />
        <nav className="flex items-center gap-3 sm:gap-6">
          <Link
            href="/#features"
            className="hidden text-sm font-medium text-slate-600 hover:text-slate-900 sm:block"
          >
            Features
          </Link>
          <Link
            href="/#product"
            className="hidden text-sm font-medium text-slate-600 hover:text-slate-900 md:block"
          >
            Web app
          </Link>
          <Link
            href="/#download"
            className="hidden text-sm font-medium text-slate-600 hover:text-slate-900 sm:block"
          >
            iOS app
          </Link>
          <Link
            href="/setup"
            className={`hidden rounded-full border px-4 py-2 text-sm font-semibold transition sm:inline-flex ${
              active === 'setup'
                ? 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-slate-300 text-slate-700 hover:bg-white'
            }`}
          >
            Set up organisation
          </Link>
          <Link
            href="/login"
            className={`rounded-full px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 ${
              active === 'login' ? 'bg-[#185FA5]' : 'bg-[#0b1220]'
            }`}
          >
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  )
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white py-10">
      <div className="mx-auto w-full max-w-[1160px] px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="font-semibold text-slate-900">Project Planner</p>
          <div className="flex flex-wrap items-center gap-5 text-sm text-slate-600">
            <Link href="/">Home</Link>
            <Link href="/login">Sign in</Link>
            <Link href="/setup">Set up organisation</Link>
            <a href="https://projectplanner.us/privacy-policy.html">Privacy</a>
            <a href="https://projectplanner.us/terms-of-service.html">Terms</a>
            <a href="mailto:support@projectplanner.app">Support</a>
          </div>
        </div>
        <p className="mt-6 border-t border-slate-100 pt-6 text-center text-xs text-slate-500">
          © 2026 Project Planner. The website and iOS app share the same organisation data.
        </p>
      </div>
    </footer>
  )
}
