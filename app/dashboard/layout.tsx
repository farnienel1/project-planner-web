'use client'

import { useEffect } from 'react'
import { TeamOnboardingPrompt } from '@/components/onboarding/TeamOnboardingPrompt'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  getDashboardNavBySection,
  isDashboardNavActive,
  type DashboardNavItem,
} from '@/lib/navigation/dashboardNavigation'

function NavLink({ item, pathname }: { item: DashboardNavItem; pathname: string }) {
  const isActive = isDashboardNavActive(pathname, item.href)
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
        isActive
          ? 'bg-blue-50 font-semibold text-blue-700'
          : 'font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900'
      }`}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ring-black/[0.04] ${item.tileClasses}`}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.iconPath} />
        </svg>
      </span>
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
      <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">{title}</p>
      <div className="space-y-1">
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
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  const homeItems = getDashboardNavBySection(user, organization, 'home')
  const navigateItems = getDashboardNavBySection(user, organization, 'navigate')
  const toolsItems = getDashboardNavBySection(user, organization, 'tools')
  const teamItems = getDashboardNavBySection(user, organization, 'team')
  const accountItems = getDashboardNavBySection(user, organization, 'account')
  const firstInitial = user.firstName?.trim()?.charAt(0) || user.email?.trim()?.charAt(0) || 'U'
  const surnameInitial = user.surname?.trim()?.charAt(0) || ''
  const avatarInitials = `${firstInitial}${surnameInitial}`.toUpperCase()

  return (
    <div className="min-h-screen bg-[#f4f6f9]">
      <TeamOnboardingPrompt />
      <div className="flex min-h-screen">
        <aside className="sticky top-0 flex h-screen w-[260px] shrink-0 flex-col border-r border-slate-200 bg-white">
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 text-sm font-bold text-white">
              PP
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Project Planner</p>
              <p className="text-xs text-slate-500">{organization?.name || 'Organization'}</p>
            </div>
          </div>

          <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
            <div className="space-y-1">
              {homeItems.map((item) => (
                <NavLink key={item.id} item={item} pathname={pathname} />
              ))}
            </div>

            <NavSection title="Navigate" items={navigateItems} pathname={pathname} />
            <NavSection title="Tools" items={toolsItems} pathname={pathname} />
            {teamItems.length > 0 && <NavSection title="Team" items={teamItems} pathname={pathname} />}
            <NavSection title="App & account" items={accountItems} pathname={pathname} />
          </nav>

          <div className="border-t border-slate-100 p-3">
            <div className="mb-2 flex items-center gap-3 rounded-xl px-3 py-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 text-xs font-bold text-white">
                {avatarInitials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-slate-900">{user.firstName || user.email}</p>
                <p className="truncate text-[11px] text-slate-500">{user.email}</p>
              </div>
            </div>
            <button
              onClick={() => signOut()}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600 ring-1 ring-inset ring-black/[0.04]">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </span>
              Sign Out
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-[1120px] px-8 py-8">{children}</div>
        </main>
      </div>
    </div>
  )
}
