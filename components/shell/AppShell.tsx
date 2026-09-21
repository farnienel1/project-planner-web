/**
 * iOS parity source: ContentView.swift, Navigation/MainMenuCatalog.swift, Views/OfflineStatusBanner.swift
 * Spec: docs/ios-parity/02-navigation-map.md, Blueprint §3.1
 */

'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  ArrowRightOnRectangleIcon,
  BellIcon,
  ArrowPathIcon,
  PlusIcon,
  HomeIcon,
  FolderIcon,
  WrenchScrewdriverIcon,
  UsersIcon,
  Cog6ToothIcon,
  EllipsisHorizontalIcon,
} from '@heroicons/react/24/solid'
import { TeamOnboardingPrompt } from '@/components/onboarding/TeamOnboardingPrompt'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { shouldShowTeamOnboardingPrompt } from '@/lib/orgSetup/teamOnboarding'
import {
  getDashboardNavBySection,
  getDashboardNavItems,
  isDashboardNavActive,
  type DashboardNavItem,
} from '@/lib/navigation/dashboardNavigation'
import {
  defaultNavigateConfig,
  parseNavigateConfig,
  readLocalNavigateConfig,
  resolveNavigateRows,
  writeLocalNavigateConfig,
  type NavigateConfig,
} from '@/lib/navigation/navigateCustomization'
import { CustomiseNavigateSheet } from '@/components/shell/CustomiseNavigateSheet'
import { IconChip, type ChipTint } from '@/components/ios/IconChip'
import { AppLogoMark } from '@/components/ui/AppLogoMark'
import { UserAvatar } from '@/components/users/UserAvatar'
import { useNotificationStore } from '@/lib/stores/notificationStore'
import { useProjectStore } from '@/lib/stores/projectStore'
import { db } from '@/lib/firebase/config'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { recoverJobTypesFromWork } from '@/lib/jobTypes/jobTypesStorage'
import {
  applyRoleTestingPreset,
  canManageUsers,
  canManageWorkCatalogue,
  isOperativeMode,
  roleTestingPresetTitle,
  roleTestingStorageKey,
  type RoleTestingPreset,
} from '@/lib/permissions'

const CHIP_FOR_ID: Record<string, ChipTint> = {
  dashboard_home: 'blue',
  dashboard_clients: 'blue',
  dashboard_projects: 'green',
  dashboard_small_works: 'amber',
  dashboard_operatives: 'green',
  dashboard_managers: 'purple',
  dashboard_annual_leave: 'coral',
  dashboard_site_map: 'green',
  dashboard_site_audit: 'blue',
  dashboard_timesheets: 'blue',
  dashboard_daily_overview: 'purple',
  dashboard_weekly_report: 'blue',
  dashboard_schedule: 'rose',
  dashboard_warnings: 'amber',
  dashboard_tasks: 'blue',
  dashboard_qualifications: 'blue',
  dashboard_my_qualifications: 'blue',
  dashboard_job_types: 'green',
  dashboard_wholesalers: 'grey',
  dashboard_materials: 'blue',
  dashboard_sub_contractors: 'grey',
  dashboard_add_user: 'purple',
  dashboard_manage_users: 'blue',
  dashboard_settings: 'grey',
  dashboard_help: 'grey',
  dashboard_privacy: 'grey',
  dashboard_reset_password: 'coral',
}

function NavRow({ item, pathname, onClick }: { item: DashboardNavItem; pathname: string; onClick?: () => void }) {
  const active = isDashboardNavActive(pathname, item.href)
  const tint = CHIP_FOR_ID[item.id] || 'grey'
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-[15px] transition hover:border-ios-search-border ${
        active ? 'bg-[#185FA5]/[0.18] font-semibold text-[#185FA5]' : 'font-medium text-ios-ink hover:bg-black/[0.03]'
      }`}
    >
      <IconChip tint={tint} size="sm">
        <FolderIcon className="h-4 w-4" />
      </IconChip>
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
    </Link>
  )
}

function ShortcutRow({
  href,
  label,
  pathname,
  onClick,
  tint = 'green',
}: {
  href: string
  label: string
  pathname: string
  onClick?: () => void
  tint?: ChipTint
}) {
  const active = isDashboardNavActive(pathname, href)
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-[15px] transition hover:border-ios-search-border ${
        active ? 'bg-[#185FA5]/[0.18] font-semibold text-[#185FA5]' : 'font-medium text-ios-ink hover:bg-black/[0.03]'
      }`}
    >
      <IconChip tint={tint} size="sm">
        <FolderIcon className="h-4 w-4" />
      </IconChip>
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </Link>
  )
}

function Section({
  title,
  items,
  pathname,
  onClick,
}: {
  title: string
  items: DashboardNavItem[]
  pathname: string
  onClick?: () => void
}) {
  if (items.length === 0) return null
  return (
    <div>
      <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.3px] text-ios-muted">{title}</p>
      <div className="space-y-0.5">
        {items.map((item) => (
          <NavRow key={item.id} item={item} pathname={pathname} onClick={onClick} />
        ))}
      </div>
    </div>
  )
}

function pageTitle(pathname: string, items: DashboardNavItem[]): string {
  if (pathname === '/dashboard') return 'Home'
  if (pathname.startsWith('/dashboard/book-labour')) return 'Book labour'
  const match = items
    .filter((i) => i.href !== '/dashboard')
    .sort((a, b) => b.href.length - a.href.length)
    .find((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))
  return match?.label || 'Project Planner'
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, organization, signOut, recordLastSeenIfDue } = useAuthStore()
  const { users, loadUsers } = useOrgUserStore()
  const unreadCount = useNotificationStore((s) => s.unreadCount)
  const loadNotifications = useNotificationStore((s) => s.loadNotifications)
  const [online, setOnline] = useState(true)
  const [moreOpen, setMoreOpen] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [rolePreset, setRolePreset] = useState<RoleTestingPreset | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [customiseOpen, setCustomiseOpen] = useState(false)
  const [navigateConfig, setNavigateConfig] = useState<NavigateConfig | null>(null)
  const { projects, smallWorks, loadProjects, loadSmallWorks } = useProjectStore()

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    setOnline(typeof navigator === 'undefined' ? true : navigator.onLine)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    try {
      const raw = localStorage.getItem(roleTestingStorageKey(user.id))
      if (raw === 'superAdmin' || raw === 'admin' || raw === 'manager' || raw === 'operative') {
        setRolePreset(raw)
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on user.id
  }, [user?.id])

  useEffect(() => {
    void recordLastSeenIfDue()
    const onVis = () => {
      if (document.visibilityState === 'visible') void recordLastSeenIfDue()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [user?.id, recordLastSeenIfDue])

  useEffect(() => {
    if (!organization?.id || !user?.id) return
    if (
      shouldShowTeamOnboardingPrompt(
        organization.teamOnboarding,
        Boolean(user.permissions.adminAccess || user.isSuperAdmin),
        organization.id
      )
    ) {
      return
    }
    loadNotifications(organization.id, user.id)
  }, [organization?.id, organization?.teamOnboarding, user?.id, user?.permissions.adminAccess, user?.isSuperAdmin, loadNotifications])

  useEffect(() => {
    if (!organization?.id) return
    void recoverJobTypesFromWork(organization.id).catch(() => {})
    loadUsers(organization.id)
    loadProjects(organization.id, true)
    loadSmallWorks(organization.id)
  }, [organization?.id, loadUsers, loadProjects, loadSmallWorks])

  useEffect(() => {
    if (!user?.id) return
    const local = readLocalNavigateConfig(user.id)
    if (local) setNavigateConfig(local)
    if (!db) return
    getDoc(doc(db, 'users', user.id))
      .then((snap) => {
        const remote = parseNavigateConfig(snap.data()?.webNavigateSidebar)
        if (remote) {
          setNavigateConfig(remote)
          writeLocalNavigateConfig(user.id, remote)
        }
      })
      .catch(() => {})
  }, [user?.id])

  const displayUser = useMemo(
    () => (user ? applyRoleTestingPreset(user, rolePreset) : null),
    [user, rolePreset]
  )

  if (!displayUser) return null

  const homeItems = getDashboardNavBySection(displayUser, organization, 'home', users)
  const navigateItems = getDashboardNavBySection(displayUser, organization, 'navigate', users)
  const toolsItems = getDashboardNavBySection(displayUser, organization, 'tools', users)
  const teamItems = getDashboardNavBySection(displayUser, organization, 'team', users)
  const accountItems = getDashboardNavBySection(displayUser, organization, 'account', users)
  const allItems = [...homeItems, ...navigateItems, ...toolsItems, ...teamItems, ...accountItems]
  const title = pageTitle(pathname, allItems)
  const isHome = pathname === '/dashboard'
  const hidePageChrome = isHome || pathname.startsWith('/dashboard/book-labour')
  const ownsPageTitle =
    pathname.startsWith('/dashboard/timesheets') ||
    pathname.startsWith('/dashboard/wholesalers') ||
    pathname.startsWith('/dashboard/qualifications') ||
    pathname.startsWith('/dashboard/my-qualifications') ||
    pathname.startsWith('/dashboard/job-types') ||
    pathname.startsWith('/dashboard/materials') ||
    pathname.startsWith('/dashboard/sub-contractors') ||
    pathname.startsWith('/dashboard/users')

  const persistNavigate = (next: NavigateConfig) => {
    setNavigateConfig(next)
    if (!user?.id) return
    writeLocalNavigateConfig(user.id, next)
    if (!db) return
    void setDoc(doc(db, 'users', user.id), { webNavigateSidebar: next }, { merge: true }).catch(() => {})
  }

  const catalog = getDashboardNavItems(displayUser, organization, users)
  const resolvedNavigate = resolveNavigateRows(navigateConfig, navigateItems, catalog)
  const effectiveNavigateConfig = navigateConfig ?? defaultNavigateConfig(navigateItems)
  const canNewProject = canManageWorkCatalogue(displayUser, 'projects')
  const canNewSmall = canManageWorkCatalogue(displayUser, 'smallWorks')
  const canNewUser = canManageUsers(displayUser) || displayUser.permissions.manager
  const showOperativesTab = !isOperativeMode(displayUser) && navigateItems.some((i) => i.id === 'dashboard_operatives')

  const resetRolePreview = () => {
    setRolePreset(null)
    if (user) localStorage.removeItem(roleTestingStorageKey(user.id))
  }

  const refresh = async () => {
    setRefreshing(true)
    router.refresh()
    window.setTimeout(() => setRefreshing(false), 600)
  }

  const confirmSignOut = async () => {
    if (window.confirm('Are you sure you want to sign out?')) {
      await signOut()
    }
  }

  const sidebar = (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      <div className="space-y-0.5">
        {homeItems.map((item) => (
          <NavRow key={item.id} item={item} pathname={pathname} onClick={() => setMoreOpen(false)} />
        ))}
      </div>
      <div>
        <div className="flex items-center justify-between px-3 pb-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3px] text-ios-muted">Navigate</p>
          <button
            type="button"
            onClick={() => setCustomiseOpen(true)}
            className="text-[11px] font-semibold text-[#185FA5] hover:underline"
          >
            Customise
          </button>
        </div>
        <div className="space-y-0.5">
          {resolvedNavigate.map((row) =>
            row.navItem ? (
              <NavRow
                key={row.key}
                item={row.navItem}
                pathname={pathname}
                onClick={() => setMoreOpen(false)}
              />
            ) : (
              <ShortcutRow
                key={row.key}
                href={row.href}
                label={row.label}
                pathname={pathname}
                tint={row.entry.type === 'smallWorks' ? 'amber' : 'green'}
                onClick={() => setMoreOpen(false)}
              />
            )
          )}
        </div>
      </div>
      <Section title="Tools" items={toolsItems} pathname={pathname} onClick={() => setMoreOpen(false)} />
      {teamItems.length > 0 && (
        <Section title="Team" items={teamItems} pathname={pathname} onClick={() => setMoreOpen(false)} />
      )}
      <Section title="App & account" items={accountItems} pathname={pathname} onClick={() => setMoreOpen(false)} />
    </nav>
  )

  return (
    <div className="min-h-screen bg-ios-canvas font-ios text-ios-ink">
      <TeamOnboardingPrompt />
      {customiseOpen ? (
        <CustomiseNavigateSheet
          config={effectiveNavigateConfig}
          catalog={catalog}
          projects={projects}
          smallWorks={smallWorks}
          onChange={persistNavigate}
          onClose={() => setCustomiseOpen(false)}
        />
      ) : null}
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-ios-border bg-ios-card xl:w-[272px] lg:flex">
          <div className="flex items-center gap-3 border-b border-ios-border px-5 py-5">
            <div className="overflow-hidden rounded-xl">
              <AppLogoMark size={40} radius={12} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">Project Planner</p>
              <p className="truncate text-xs text-ios-muted">{organization?.name || 'Organisation'}</p>
            </div>
          </div>
          {sidebar}
          <div className="border-t border-ios-border p-3">
            <button
              type="button"
              onClick={confirmSignOut}
              className="flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-[15px] font-medium text-[#A32D2D] hover:bg-ios-chip-red"
            >
              <IconChip tint="red" size="sm">
                <ArrowRightOnRectangleIcon className="h-4 w-4" />
              </IconChip>
              Sign out
            </button>
            <p className="px-3 pt-2 text-[11px] text-ios-placeholder">v1.0.0 · Project Planner</p>
            {process.env.NODE_ENV !== 'production' ? (
              <Link href="/dashboard/data-health" className="block px-3 pt-1 text-[11px] text-[#185FA5]">
                Data health
              </Link>
            ) : null}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col pb-20 lg:pb-0">
          {!online ? (
            <div className="bg-[#854F0B] px-4 py-2 text-center text-sm font-medium text-white">
              You&apos;re offline. Changes will not sync until you reconnect.
            </div>
          ) : null}
          {rolePreset ? (
            <div className="flex items-center justify-between gap-3 bg-amber-500 px-4 py-2 text-sm text-white">
              <p>
                <span className="font-semibold">Role preview: {roleTestingPresetTitle(rolePreset)}</span>
                <span className="ml-2 opacity-90">
                  Navigation matches this role. Firebase still uses your real account — some actions may fail if your
                  real permissions differ.
                </span>
              </p>
              <button type="button" onClick={resetRolePreview} className="rounded-full bg-white/20 px-3 py-1 font-semibold">
                Reset
              </button>
            </div>
          ) : null}

          {!hidePageChrome ? (
            <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-ios-border bg-ios-card/95 px-4 backdrop-blur lg:px-8">
              <div className="min-w-0">
                {ownsPageTitle ? (
                  <p className="truncate text-[13px] font-medium text-ios-muted">{organization?.name || 'Project Planner'}</p>
                ) : (
                  <h1 className="truncate text-[20px] font-semibold tracking-tight lg:text-[28px]">{title}</h1>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setNewOpen((v) => !v)}
                    className="inline-flex h-10 items-center gap-1 rounded-full bg-[#185FA5] px-3 text-sm font-semibold text-white"
                  >
                    <PlusIcon className="h-4 w-4" /> New
                  </button>
                  {newOpen ? (
                    <div className="absolute right-0 mt-2 w-48 rounded-2xl border border-ios-border bg-ios-card p-1 shadow-ios-toast">
                      {canNewProject ? (
                        <Link href="/dashboard/projects/new" className="block rounded-xl px-3 py-2 text-sm hover:bg-black/[0.04]" onClick={() => setNewOpen(false)}>
                          Project
                        </Link>
                      ) : null}
                      {canNewSmall ? (
                        <Link href="/dashboard/small-works/new" className="block rounded-xl px-3 py-2 text-sm hover:bg-black/[0.04]" onClick={() => setNewOpen(false)}>
                          Small work
                        </Link>
                      ) : null}
                      {canNewUser ? (
                        <Link href="/dashboard/settings/users/new" className="block rounded-xl px-3 py-2 text-sm hover:bg-black/[0.04]" onClick={() => setNewOpen(false)}>
                          User
                        </Link>
                      ) : null}
                      <Link href="/dashboard/tasks" className="block rounded-xl px-3 py-2 text-sm hover:bg-black/[0.04]" onClick={() => setNewOpen(false)}>
                        Task
                      </Link>
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={refresh}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-[#E6E8ED] bg-white"
                  aria-label="Refresh"
                >
                  <ArrowPathIcon className={`h-5 w-5 text-ios-muted ${refreshing ? 'animate-spin' : ''}`} />
                </button>
                <Link
                  href="/dashboard/notifications"
                  className="relative flex h-11 w-11 items-center justify-center rounded-full border border-[#E6E8ED] bg-white"
                  aria-label="Notifications"
                >
                  <BellIcon className="h-5 w-5 text-ios-muted" />
                  {unreadCount > 0 ? (
                    <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-ios-unread" />
                  ) : null}
                </Link>
                <Link
                  href="/dashboard/settings"
                  className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-[#185FA5] text-xs font-bold text-white"
                  aria-label="Profile"
                >
                  <UserAvatar user={displayUser} size={44} />
                </Link>
              </div>
            </header>
          ) : null}

          <main className="min-w-0 flex-1">
            <div className={`mx-auto w-full max-w-shell ${isHome ? 'px-4 py-4 lg:px-10 lg:py-8' : 'px-4 py-6 lg:px-10 lg:py-8'}`}>
              {children}
            </div>
          </main>
        </div>
      </div>

      <nav className="fixed inset-x-3 bottom-3 z-30 flex items-center justify-around rounded-[18px] border border-ios-border bg-ios-card/95 px-1 py-2 shadow-ios-bar backdrop-blur lg:hidden">
        <Link href="/dashboard" className={`flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] ${pathname === '/dashboard' ? 'text-[#185FA5]' : 'text-ios-muted'}`}>
          <HomeIcon className="h-6 w-6" />
          Home
        </Link>
        <Link href="/dashboard/projects" className={`flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] ${pathname.startsWith('/dashboard/projects') ? 'text-[#185FA5]' : 'text-ios-muted'}`}>
          <FolderIcon className="h-6 w-6" />
          Projects
        </Link>
        <Link href="/dashboard/small-works" className={`flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] ${pathname.startsWith('/dashboard/small-works') ? 'text-[#185FA5]' : 'text-ios-muted'}`}>
          <WrenchScrewdriverIcon className="h-6 w-6" />
          Small Works
        </Link>
        {showOperativesTab ? (
          <Link href="/dashboard/operatives" className={`flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] ${pathname.startsWith('/dashboard/operatives') ? 'text-[#185FA5]' : 'text-ios-muted'}`}>
            <UsersIcon className="h-6 w-6" />
            Operatives
          </Link>
        ) : (
          <Link href="/dashboard/settings" className={`flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] ${pathname.startsWith('/dashboard/settings') ? 'text-[#185FA5]' : 'text-ios-muted'}`}>
            <Cog6ToothIcon className="h-6 w-6" />
            Settings
          </Link>
        )}
        <button type="button" onClick={() => setMoreOpen(true)} className="flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] text-ios-muted">
          <EllipsisHorizontalIcon className="h-6 w-6" />
          More
        </button>
      </nav>

      {moreOpen ? (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setMoreOpen(false)}>
          <div
            className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-ios-canvas pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="text-[22px] font-semibold">Main Menu</h2>
              <button type="button" onClick={() => setMoreOpen(false)} className="rounded-full bg-[#185FA5] px-4 py-1.5 text-sm font-semibold text-white">
                Done
              </button>
            </div>
            {sidebar}
            <div className="px-3">
              <button type="button" onClick={confirmSignOut} className="flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-[#A32D2D]">
                <IconChip tint="red" size="sm">
                  <ArrowRightOnRectangleIcon className="h-4 w-4" />
                </IconChip>
                Sign out
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
