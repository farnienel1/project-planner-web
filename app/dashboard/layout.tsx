'use client'

import { useEffect } from 'react'
import { TeamOnboardingPrompt } from '@/components/onboarding/TeamOnboardingPrompt'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  getDashboardNavBySection,
  getDashboardNavItems,
  isDashboardNavActive,
  type DashboardNavItem,
} from '@/lib/navigation/dashboardNavigation'
import { DashboardJumpSearch } from '@/components/dashboard/DashboardJumpSearch'
import { ProjectPlannerLogo } from '@/components/ui/ProjectPlannerLogo'

function NavLink({ item, pathname }: { item: DashboardNavItem; pathname: string }) {
  const isActive = isDashboardNavActive(pathname, item.href)
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition ${
        isActive
          ? 'bg-white font-medium text-slate-900 shadow-sm ring-1 ring-slate-200/80'
          : 'font-medium text-slate-500 hover:bg-white/70 hover:text-slate-900'
      }`}
    >
      <svg
        className={`h-4 w-4 shrink-0 ${isActive ? 'text-slate-800' : 'text-slate-400'}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.7}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d={item.iconPath} />
      </svg>
      <span>{item.label}</span>
    </Link>
  )
}

function NavSection({
  title,
  items,
  pathname,
}: {
  title: string
  items: DashboardNavItem[]
  pathname: string
}) {
  if (items.length === 0) return null
  return (
    <div>
      <p className="px-2.5 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{title}</p>
      <div className="space-y-0.5">
        {items.map((item) => (
          <NavLink key={item.id} item={item} pathname={pathname} />
        ))}
      </div>
    </div>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, organization, loading, signOut } = useAuthStore()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f7f9]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  const allNav = getDashboardNavItems(user, organization)
  const homeItems = getDashboardNavBySection(user, organization, 'home')
  const navigateItems = getDashboardNavBySection(user, organization, 'navigate')
  const toolsItems = getDashboardNavBySection(user, organization, 'tools')
  const teamItems = getDashboardNavBySection(user, organization, 'team')
  const accountItems = getDashboardNavBySection(user, organization, 'account')
  const firstInitial = user.firstName?.trim()?.charAt(0) || user.email?.trim()?.charAt(0) || 'U'
  const surnameInitial = user.surname?.trim()?.charAt(0) || ''
  const avatarInitials = `${firstInitial}${surnameInitial}`.toUpperCase()
  const displayName = [user.firstName, user.surname].filter(Boolean).join(' ') || user.email

  return (
    <div className="min-h-screen bg-[#f6f7f9]">
      <TeamOnboardingPrompt />
      <div className="flex min-h-screen">
        <aside className="sticky top-0 flex h-screen w-[232px] shrink-0 flex-col border-r border-slate-200/80 bg-[#fafbfc]">
          <div className="flex items-center px-4 py-5">
            <ProjectPlannerLogo href="/dashboard" size="sm" />
          </div>
          <p className="truncate px-6 pb-3 text-[11px] text-slate-400">{organization?.name || 'Organisation'}</p>

          <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-4">
            <div className="space-y-0.5">
              {homeItems.map((item) => (
                <NavLink key={item.id} item={item} pathname={pathname} />
              ))}
            </div>

            <NavSection title="Workspace" items={navigateItems} pathname={pathname} />
            <NavSection title="Tools" items={toolsItems} pathname={pathname} />
            {teamItems.length > 0 && <NavSection title="Team" items={teamItems} pathname={pathname} />}
            <NavSection title="Account" items={accountItems} pathname={pathname} />
          </nav>

          <div className="border-t border-slate-200/80 p-3">
            <button
              onClick={() => signOut()}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-slate-500 transition hover:bg-white hover:text-slate-900"
            >
              <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Sign out
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-slate-200/80 bg-[#f6f7f9]/90 px-6 backdrop-blur lg:px-8">
            <DashboardJumpSearch items={allNav} />
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard/warnings"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-800"
                aria-label="Warnings"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
              </Link>
              <div className="flex items-center gap-2.5 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-[10px] font-semibold text-white">
                  {avatarInitials}
                </div>
                <p className="hidden max-w-[140px] truncate text-[12px] font-medium text-slate-700 sm:block">
                  {displayName}
                </p>
              </div>
            </div>
          </header>
          <main className="min-w-0 flex-1">
            <div className="mx-auto w-full max-w-[1200px] px-6 py-8 lg:px-8">{children}</div>
          </main>
        </div>
      </div>
    </div>
  )
}
