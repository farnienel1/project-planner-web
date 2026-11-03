/**
 * iOS parity source: ContentView.swift, Navigation/MainMenuCatalog.swift, Views/OfflineStatusBanner.swift
 * Spec: docs/ios-parity/02-navigation-map.md, Blueprint §3.1
 */

'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  ArrowRightOnRectangleIcon,
  BellIcon,
  ArrowPathIcon,
  PlusIcon,
  FolderIcon,
  Bars3Icon,
  MagnifyingGlassIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/solid'
import '@/app/brand-shell.css'
import { TeamOnboardingPrompt } from '@/components/onboarding/TeamOnboardingPrompt'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import {
  dashboardPageTitle,
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
import { AppLogoMark } from '@/components/ui/AppLogoMark'
import { AccountMenu } from '@/components/shell/AccountMenu'
import { CommandPalette } from '@/components/shell/CommandPalette'
import { NotificationsPopover } from '@/components/shell/NotificationsPopover'
import { ToastProvider, useToast } from '@/components/ui/ToastProvider'
import { Button, IconChip } from '@/components/ui'
import { useNotificationStore } from '@/lib/stores/notificationStore'
import {
  DEFAULT_USER_NOTIFICATION_PREFERENCES,
  notificationShowsInInbox,
  unreadNotificationBadgeCount,
} from '@/lib/canonical'
import { loadUserNotificationPreferences } from '@/lib/settings/notificationPreferences'
import { hueForCreateId, hueForNavId } from '@/lib/ui/sectionHue'
import {
  TIMESHEETS_HUB_PATH,
  TIMESHEETS_MINE_PATH,
  TIMESHEETS_TEAM_PATH,
  timesheetLinkShouldHardReset,
} from '@/lib/timesheets/timesheetRoutes'
import type { PaletteItem } from '@/lib/ui/commandPalette'
import { useProjectStore } from '@/lib/stores/projectStore'
import { deliverDueTimesheetSubmissionReminders } from '@/lib/timesheets/deliverTimesheetSubmissionReminders'
import { refreshAllOrgData } from '@/lib/stores/refreshOrgData'
import { db } from '@/lib/firebase/config'
import { runWhenIdle } from '@/lib/analytics/runWhenIdle'
import { hasGrantedAnalyticsConsent, subscribeAnalyticsConsent } from '@/lib/analytics/analyticsConsent'
import { doc, setDoc } from 'firebase/firestore'
import { recoverJobTypesFromWork } from '@/lib/jobTypes/jobTypesStorage'
import { canBookWork, hasAdminAccess } from '@/lib/permissions'
import { createMenuItems } from '@/lib/navigation/createMenu'
import { cn } from '@/lib/ui/cn'
import { UserAvatar } from '@/components/users/UserAvatar'
import { inboxOwnerIds } from '@/lib/staff/rulebookPeople'

function NavGlyph({ path, className }: { path: string; className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  )
}

function NavRow({
  item,
  pathname,
  onClick,
  compact,
}: {
  item: DashboardNavItem
  pathname: string
  onClick?: () => void
  compact?: boolean
}) {
  const active = isDashboardNavActive(pathname, item.href)
  return (
    <Link
      href={item.href}
      onClick={(event) => {
        onClick?.()
        if (
          item.href === TIMESHEETS_HUB_PATH &&
          timesheetLinkShouldHardReset(window.location.pathname, window.location.search, item.href)
        ) {
          event.preventDefault()
          window.location.assign(TIMESHEETS_HUB_PATH)
        }
      }}
      title={item.label}
      aria-current={active ? 'page' : undefined}
      className={cn('sb-item', active && 'on', item.section === 'home' && 'home', compact && 'compact')}
    >
      <NavGlyph path={item.iconPath} className="sb-ico" />
      <span className={cn('min-w-0 flex-1 truncate', compact && 'hidden')}>{item.label}</span>
      {compact ? null : <ChevronRightIcon className="sb-chev" aria-hidden />}
    </Link>
  )
}

function ShortcutRow({
  href,
  label,
  pathname,
  onClick,
  compact,
}: {
  href: string
  label: string
  pathname: string
  onClick?: () => void
  compact?: boolean
}) {
  const active = isDashboardNavActive(pathname, href)
  return (
    <Link
      href={href}
      onClick={onClick}
      title={label}
      aria-current={active ? 'page' : undefined}
      className={cn('sb-item', active && 'on', compact && 'compact')}
    >
      <FolderIcon className="sb-ico" aria-hidden />
      <span className={cn('min-w-0 flex-1 truncate', compact && 'hidden')}>{label}</span>
      {compact ? null : <ChevronRightIcon className="sb-chev" aria-hidden />}
    </Link>
  )
}

function Section({
  title,
  items,
  pathname,
  onClick,
  compact,
}: {
  title: string
  items: DashboardNavItem[]
  pathname: string
  onClick?: () => void
  compact?: boolean
}) {
  if (items.length === 0) return null
  return (
    <div className="sb-group">
      <div className={cn('sb-label-row', compact && 'hidden')}>
        <p className="sb-label">{title}</p>
      </div>
      <div className="sb-items">
        {items.map((item) => (
          <NavRow key={item.id} item={item} pathname={pathname} onClick={onClick} compact={compact} />
        ))}
      </div>
    </div>
  )
}

function AppShellInner({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const toast = useToast()
  const { user, organization, signOut, recordLastSeenIfDue, syncSignInEmail } = useAuthStore()
  const { users, loadUsers } = useOrgUserStore()
  const notifications = useNotificationStore((s) => s.notifications)
  const loadNotifications = useNotificationStore((s) => s.loadNotifications)
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead)
  // Every id of the signed-in person (`personIdSet`): the inbox owner ids.
  const ownerIds = useMemo(() => inboxOwnerIds(user, users), [user, users])
  const [notificationPrefs, setNotificationPrefs] = useState(DEFAULT_USER_NOTIFICATION_PREFERENCES)
  const [online, setOnline] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [customiseOpen, setCustomiseOpen] = useState(false)
  const [navigateConfig, setNavigateConfig] = useState<NavigateConfig | null>(null)
  const [analyticsAllowed, setAnalyticsAllowed] = useState(false)
  const { projects, smallWorks, loadProjects, loadSmallWorks } = useProjectStore()
  const prefetchedNav = useRef(false)

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
    // Rulebook 1.13.0 §14 (`signInEmailSyncWrites`): once per signed-in account.
    void syncSignInEmail()
  }, [user?.id, syncSignInEmail])

  useEffect(() => {
    void recordLastSeenIfDue()
    const onVis = () => {
      if (document.visibilityState === 'visible') void recordLastSeenIfDue()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [user?.id, recordLastSeenIfDue])

  useEffect(() => {
    setAnalyticsAllowed(hasGrantedAnalyticsConsent())
    return subscribeAnalyticsConsent(() => setAnalyticsAllowed(hasGrantedAnalyticsConsent()))
  }, [])

  useEffect(() => {
    if (!user?.id || !pathname || !analyticsAllowed) return
    const userId = user.id
    const organizationId = organization?.id
    return runWhenIdle(() => {
      void import('@/lib/analytics/trackEvent').then(({ trackEvent }) => {
        void trackEvent('page_viewed', { userId, organizationId, metadata: { path: pathname } })
      })
    })
  }, [pathname, user?.id, organization?.id, analyticsAllowed])

  // 1.16.0: the inbox listens whenever an organisation is open — never skipped behind the team-onboarding prompt
  // (admins used to get no inbox while it showed).
  useEffect(() => {
    if (!organization?.id || !user?.id) return
    loadNotifications(organization.id, user.id, ownerIds)
  }, [organization?.id, user?.id, loadNotifications, ownerIds])

  useEffect(() => {
    if (!user?.id) return
    void loadUserNotificationPreferences(user.id).then(setNotificationPrefs)
  }, [user?.id])

  // Toggles stop the device push only; every notice stays in the inbox and the unread count.
  const visibleNotifications = useMemo(
    () => notifications.filter((row) => notificationShowsInInbox(notificationPrefs, row.type)),
    [notifications, notificationPrefs]
  )
  // Rows addressed to any of the person's ids (`unreadNotificationBadgeCount`); ownerless rows never count.
  const unreadCount = unreadNotificationBadgeCount(visibleNotifications, ownerIds)

  useEffect(() => {
    if (!user || prefetchedNav.current) return
    prefetchedNav.current = true
    const hrefs = getDashboardNavItems(user, organization, users).map((item) => item.href)
    for (const href of hrefs) router.prefetch(href)
  }, [user, organization, users, router])

  // Once per organisation per session, after the roster has loaded. The roster listener
  // republishes `users` several times during boot; each pass used to re-read every recipient.
  const remindersRunForOrg = useRef('')
  useEffect(() => {
    if (!organization?.id || users.length === 0) return
    if (remindersRunForOrg.current === organization.id) return
    const orgId = organization.id
    // Wait for the roster to settle so a partial first snapshot does not miss recipients.
    const timer = window.setTimeout(() => {
      if (remindersRunForOrg.current === orgId) return
      remindersRunForOrg.current = orgId
      void deliverDueTimesheetSubmissionReminders(orgId, users).catch(() => {})
    }, 1500)
    return () => window.clearTimeout(timer)
  }, [organization?.id, users])

  useEffect(() => {
    if (!organization?.id) return
    loadUsers(organization.id)
    loadProjects(organization.id)
    loadSmallWorks(organization.id)
  }, [organization?.id, loadUsers, loadProjects, loadSmallWorks])

  // Job type recovery reads the projects and small works the stores already hold.
  const workLoadedForOrg = useProjectStore(
    (state) =>
      Boolean(organization?.id) &&
      state.projectsLoadedOrgId === organization?.id &&
      state.smallWorksLoadedOrgId === organization?.id
  )
  useEffect(() => {
    if (!organization?.id || !workLoadedForOrg) return
    const orgId = organization.id
    const timer = window.setTimeout(() => {
      const { projects: loadedProjects, smallWorks: loadedSmallWorks } = useProjectStore.getState()
      void recoverJobTypesFromWork(orgId, [...loadedProjects, ...loadedSmallWorks]).catch(() => {})
    }, 400)
    return () => window.clearTimeout(timer)
  }, [organization?.id, workLoadedForOrg])

  // The auth store already holds users/{uid}; no second read of the same document.
  // Select a string so an unchanged sidebar config does not re-run the effect.
  const remoteNavigateSidebar = useAuthStore((s) =>
    s.currentUserDocument?.webNavigateSidebar == null ? '' : JSON.stringify(s.currentUserDocument.webNavigateSidebar)
  )
  useEffect(() => {
    if (!user?.id) return
    const local = readLocalNavigateConfig(user.id)
    if (local) setNavigateConfig(local)
  }, [user?.id])
  useEffect(() => {
    if (!user?.id || !remoteNavigateSidebar) return
    let raw: unknown = null
    try {
      raw = JSON.parse(remoteNavigateSidebar)
    } catch {
      return
    }
    const remote = parseNavigateConfig(raw)
    if (remote) {
      setNavigateConfig(remote)
      writeLocalNavigateConfig(user.id, remote)
    }
  }, [user?.id, remoteNavigateSidebar])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen(true)
      }
      if (event.key === 'Escape') {
        setPaletteOpen(false)
        setNewOpen(false)
        setNotifOpen(false)
        setMenuOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const paletteItems = useMemo<PaletteItem[]>(() => {
    if (!user) return []
    const jobs: PaletteItem[] = [
      ...projects.map((project) => ({
        group: 'Jobs' as const,
        label: `${project.jobNumber || 'Job'} · ${project.siteName}`,
        href: `/dashboard/projects/${project.id}`,
        meta: project.status,
        hue: 'proj' as const,
      })),
      ...smallWorks.map((project) => ({
        group: 'Jobs' as const,
        label: `${project.jobNumber || 'Job'} · ${project.siteName}`,
        href: `/dashboard/small-works/${project.id}`,
        meta: project.status,
        hue: 'sw' as const,
      })),
    ]
    const people: PaletteItem[] = users.map((member) => ({
      group: 'People',
      label: `${member.firstName} ${member.surname}`.trim() || member.email,
      href: `/dashboard/users/${member.id}`,
      meta: member.role,
      hue: 'user',
    }))
    const pages: PaletteItem[] = getDashboardNavItems(user, organization, users).map((item) => ({
      group: 'Pages',
      label: item.label,
      href: item.href,
      hue: hueForNavId(item.id),
    }))
    const actions: PaletteItem[] = [
      ...(canBookWork(user)
        ? [{ group: 'Actions' as const, label: 'Book labour', href: '/dashboard/book-labour', hue: 'blue' as const }]
        : []),
      ...createMenuItems(user).map((item) => ({
        group: 'Actions' as const,
        label: item.label,
        href: item.href,
        hue: hueForCreateId(item.id),
      })),
    ]
    return [...jobs, ...people, ...pages, ...actions]
  }, [user, organization, users, projects, smallWorks])

  if (!user) return null

  const homeItems = getDashboardNavBySection(user, organization, 'home', users)
  const navigateItems = getDashboardNavBySection(user, organization, 'navigate', users)
  const toolsItems = getDashboardNavBySection(user, organization, 'tools', users)
  const teamItems = getDashboardNavBySection(user, organization, 'team', users)
  const accountItems = getDashboardNavBySection(user, organization, 'account', users)
  const title = dashboardPageTitle(pathname)
  const timesheetChild =
    pathname === TIMESHEETS_MINE_PATH ||
    pathname.startsWith(`${TIMESHEETS_MINE_PATH}/`) ||
    pathname === TIMESHEETS_TEAM_PATH ||
    pathname.startsWith(`${TIMESHEETS_TEAM_PATH}/`)
  const isHome = pathname === '/dashboard'
  const isBookLabour = pathname.startsWith('/dashboard/book-labour')
  const showHeader = !isBookLabour
  // Desktop crumb is "Org / page". Below 761px the org name is hidden, so the
  // current-page label is omitted and the page h1 is the only copy of that title.
  // A nested screen keeps a section link here (Timesheets → My Timesheets).

  const persistNavigate = (next: NavigateConfig) => {
    setNavigateConfig(next)
    if (!user?.id) return
    writeLocalNavigateConfig(user.id, next)
    if (!db) return
    void setDoc(doc(db, 'users', user.id), { webNavigateSidebar: next }, { merge: true }).catch(() => {})
  }

  const catalog = getDashboardNavItems(user, organization, users)
  const resolvedNavigate = resolveNavigateRows(navigateConfig, navigateItems, catalog)
  const effectiveNavigateConfig = navigateConfig ?? defaultNavigateConfig(navigateItems)
  const createItems = createMenuItems(user)
  const closeMenus = () => {
    setMenuOpen(false)
    setNewOpen(false)
    setNotifOpen(false)
  }

  const refresh = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      // Every organisation store re-reads from Firestore; warnings, schedules, and
      // counts recompute from the fresh rows. router.refresh() alone only re-rendered
      // server components and left the client stores as they were.
      if (organization?.id) await refreshAllOrgData(organization.id)
      router.refresh()
      toast('Data refreshed')
    } catch {
      toast('Refresh did not finish. Showing the last loaded data.')
    } finally {
      setRefreshing(false)
    }
  }

  const confirmSignOut = async () => {
    if (window.confirm('Are you sure you want to sign out?')) {
      await signOut()
    }
  }

  const sidebar = (
    <>
      <div className="sb-brand">
        <span className="sb-logo">
          <AppLogoMark size={44} radius={11} />
        </span>
        <div className="min-w-0">
          <p className="sb-title truncate">Project Planner</p>
          <p className="sb-org truncate">{organization?.name || 'Organisation'}</p>
        </div>
      </div>
      <nav className="sb-nav flex-1 overflow-y-auto" aria-label="Main">
        <div className="sb-group sb-items">
          {homeItems.map((item) => (
            <NavRow key={item.id} item={item} pathname={pathname} onClick={closeMenus} />
          ))}
        </div>
        <div className="sb-group">
          <div className="sb-label-row">
            <p className="sb-label">Navigate</p>
            <button type="button" onClick={() => setCustomiseOpen(true)} className="sb-link">
              Customise
            </button>
          </div>
          <div className="sb-items">
            {resolvedNavigate.map((row) =>
              row.navItem ? (
                <NavRow
                  key={row.key}
                  item={row.navItem}
                  pathname={pathname}
                  onClick={closeMenus}
                />
              ) : (
                <ShortcutRow
                  key={row.key}
                  href={row.href}
                  label={row.label}
                  pathname={pathname}
                  onClick={closeMenus}
                />
              )
            )}
          </div>
        </div>
        <Section title="Tools" items={toolsItems} pathname={pathname} onClick={closeMenus} />
        {teamItems.length > 0 && (
          <Section title="Team" items={teamItems} pathname={pathname} onClick={closeMenus} />
        )}
        <Section title="App & account" items={accountItems} pathname={pathname} onClick={closeMenus} />
      </nav>
      <div className="sb-foot">
        <div className="sb-user">
          <UserAvatar user={user} size={36} gradient="from-[var(--brand-600)] to-[var(--brand-500)]" />
          <div className="min-w-0">
            <p className="sb-user-name truncate">{`${user.firstName} ${user.surname}`.trim() || user.email}</p>
            <p className="sb-org truncate">{organization?.name || 'Organisation'}</p>
          </div>
        </div>
        <button type="button" onClick={confirmSignOut} className="sb-signout">
          <ArrowRightOnRectangleIcon className="h-[18px] w-[18px]" aria-hidden />
          Sign out
        </button>
        <p className="sb-version">
          v1.0.0 · Project Planner
          {process.env.NODE_ENV !== 'production' || hasAdminAccess(user) ? (
            <>
              {' · '}
              <Link href="/dashboard/data-health">Data health</Link>
            </>
          ) : null}
        </p>
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-[var(--page-bg)] text-[var(--ink)]">
      <TeamOnboardingPrompt />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} items={paletteItems} />
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
      {menuOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-[60] bg-[rgba(10,20,40,.4)] lg:hidden"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <div className="flex min-h-screen">
        <aside
          className={cn(
            'sb flex min-h-0 flex-col',
            'max-[1023px]:fixed max-[1023px]:inset-y-0 max-[1023px]:left-0 max-[1023px]:z-[70] max-[1023px]:w-[290px] max-[1023px]:transition-transform',
            menuOpen ? 'max-[1023px]:translate-x-0' : 'max-[1023px]:-translate-x-full',
            'lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[268px]'
          )}
        >
          <div className="flex h-full flex-col">{sidebar}</div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {!online ? (
            <div className="bg-[var(--warn)] px-4 py-2 text-center text-sm font-medium text-white">
              You&apos;re offline. Changes will not sync until you reconnect.
            </div>
          ) : null}

          {showHeader ? (
            <header className="sticky top-0 z-20 flex h-[66px] min-w-0 items-center gap-3 bg-[color-mix(in_srgb,var(--page-bg)_85%,transparent)] px-6 backdrop-blur-[10px] max-[760px]:h-[60px] max-[760px]:px-3.5">
              <button
                type="button"
                className="tb-control grid h-11 w-11 place-items-center lg:hidden"
                aria-label="Open menu"
                onClick={() => setMenuOpen(true)}
              >
                <Bars3Icon className="h-5 w-5" />
              </button>
              <nav className="crumb tb-crumb flex min-w-0 items-center gap-2 text-sm" aria-label="Breadcrumb">
                <span className="sep hidden truncate min-[761px]:inline">{organization?.name || 'Project Planner'}</span>
                <span className="sep hidden min-[761px]:inline">/</span>
                {timesheetChild ? (
                  <Link
                    href={TIMESHEETS_HUB_PATH}
                    className="truncate underline-offset-2 hover:underline"
                    onClick={(event) => {
                      if (
                        timesheetLinkShouldHardReset(
                          window.location.pathname,
                          window.location.search,
                          TIMESHEETS_HUB_PATH
                        )
                      ) {
                        event.preventDefault()
                        window.location.assign(TIMESHEETS_HUB_PATH)
                      }
                    }}
                  >
                    {title}
                  </Link>
                ) : (
                  <b className="truncate">{title}</b>
                )}
              </nav>
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                className="tb-control ml-auto flex h-11 w-[min(320px,100%)] min-w-0 shrink items-center gap-2.5 px-3.5 text-[14.5px] max-[1100px]:w-11 max-[1100px]:shrink-0 max-[1100px]:justify-center max-[1100px]:px-0"
                aria-label="Search"
              >
                <MagnifyingGlassIcon className="h-5 w-5" />
                <span className="hidden min-[1101px]:inline">Search projects, people, pages</span>
                <kbd className="ml-auto hidden rounded-md bg-[var(--soft2)] px-1.5 py-0.5 text-[11.5px] font-semibold text-[var(--ink2)] min-[1101px]:inline">
                  ⌘K
                </kbd>
              </button>
              <div className="flex items-center gap-2">
                {createItems.length > 0 ? (
                  <div className="relative">
                    <Button variant="primary" onClick={() => setNewOpen((value) => !value)} className="tb-new relative z-20" aria-label="New">
                      <PlusIcon className="h-4 w-4" />
                      <span className="hidden min-[761px]:inline">New</span>
                    </Button>
                    {newOpen ? (
                      <>
                        <button
                          type="button"
                          className="fixed inset-0 z-10 cursor-default bg-transparent"
                          aria-label="Close new menu"
                          onClick={() => setNewOpen(false)}
                        />
                        <div className="absolute right-0 z-30 mt-2 w-[260px] rounded-[18px] bg-[var(--card)] p-2 shadow-[var(--sh-pop)]">
                          <p className="px-2.5 py-1 text-xs font-semibold text-[var(--ink3)]">Create new</p>
                          {createItems.map((item) => (
                            <Link
                              key={item.id}
                              href={item.href}
                              data-hue={hueForCreateId(item.id)}
                              className="flex items-center gap-3 rounded-xl px-2.5 py-2 text-[14.5px] hover:bg-[var(--soft)]"
                              onClick={() => setNewOpen(false)}
                            >
                              <IconChip hue={hueForCreateId(item.id)} size="sm">
                                <PlusIcon className="h-4 w-4" />
                              </IconChip>
                              {item.label}
                            </Link>
                          ))}
                        </div>
                      </>
                    ) : null}
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => void refresh()}
                  className="tb-control grid h-11 w-11 place-items-center"
                  aria-label="Refresh data"
                >
                  <ArrowPathIcon className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setNotifOpen((value) => !value)}
                    className="tb-control relative grid h-11 w-11 place-items-center"
                    aria-label="Notifications"
                  >
                    <BellIcon className="h-5 w-5" />
                    {unreadCount > 0 ? (
                      <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full tb-badge px-1 text-center text-[10px] font-bold leading-[18px] text-white">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    ) : null}
                  </button>
                  <NotificationsPopover
                    open={notifOpen}
                    onClose={() => setNotifOpen(false)}
                    notifications={visibleNotifications}
                    user={user}
                    onMarkAllRead={() => {
                      if (organization?.id) void markAllAsRead(organization.id)
                    }}
                  />
                </div>
                <AccountMenu user={user} onSignOut={() => void confirmSignOut()} />
              </div>
            </header>
          ) : null}

          <main className="min-w-0 flex-1">
            <div className={cn('page mx-auto w-full max-w-shell', isHome ? 'px-4 py-4 min-[760px]:px-8 min-[760px]:py-[22px]' : 'px-4 py-6 min-[760px]:px-7 min-[760px]:pb-14')}>
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AppShellInner>{children}</AppShellInner>
    </ToastProvider>
  )
}
