/**
 * iOS parity source: ContentView.swift, Navigation/MainMenuCatalog.swift, Views/OfflineStatusBanner.swift
 * Spec: docs/ios-parity/02-navigation-map.md, Blueprint §3.1
 */

'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
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
import { AppLogoMark } from '@/components/ui/AppLogoMark'
import { AccountMenu } from '@/components/shell/AccountMenu'
import { CommandPalette } from '@/components/shell/CommandPalette'
import { NotificationsPopover } from '@/components/shell/NotificationsPopover'
import { ToastProvider, useToast } from '@/components/ui/ToastProvider'
import { Button, IconChip } from '@/components/ui'
import { useNotificationStore } from '@/lib/stores/notificationStore'
import { hueForCreateId, hueForNavId, type SectionHue } from '@/lib/ui/sectionHue'
import type { PaletteItem } from '@/lib/ui/commandPalette'
import { useProjectStore } from '@/lib/stores/projectStore'
import { db } from '@/lib/firebase/config'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { recoverJobTypesFromWork } from '@/lib/jobTypes/jobTypesStorage'
import { canBookWork } from '@/lib/permissions'
import { createMenuItems } from '@/lib/navigation/createMenu'
import { cn } from '@/lib/ui/cn'
import { UserAvatar } from '@/components/users/UserAvatar'

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
  const hue = hueForNavId(item.id)
  return (
    <Link
      href={item.href}
      onClick={onClick}
      data-hue={hue}
      title={item.label}
      className={cn(
        'flex items-center gap-3 rounded-xl py-1.5 text-[14.5px] transition',
        compact ? 'justify-center px-1.5' : 'px-2.5',
        active ? 'bg-[var(--ht)] font-semibold text-[var(--ink)]' : 'font-medium text-[var(--ink2)] hover:bg-[var(--soft)]'
      )}
    >
      <span
        className={cn(
          'inline-grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[9px]',
          active ? 'bg-[var(--h)] text-white' : 'bg-[var(--ht)] text-[var(--h)]'
        )}
      >
        <NavGlyph path={item.iconPath} className="h-4 w-4" />
      </span>
      <span className={cn('min-w-0 flex-1 truncate', compact && 'hidden')}>{item.label}</span>
    </Link>
  )
}

function ShortcutRow({
  href,
  label,
  pathname,
  hue,
  onClick,
  compact,
}: {
  href: string
  label: string
  pathname: string
  hue: SectionHue
  onClick?: () => void
  compact?: boolean
}) {
  const active = isDashboardNavActive(pathname, href)
  return (
    <Link
      href={href}
      onClick={onClick}
      data-hue={hue}
      title={label}
      className={cn(
        'flex items-center gap-3 rounded-xl py-1.5 text-[14.5px] transition',
        compact ? 'justify-center px-1.5' : 'px-2.5',
        active ? 'bg-[var(--ht)] font-semibold text-[var(--ink)]' : 'font-medium text-[var(--ink2)] hover:bg-[var(--soft)]'
      )}
    >
      <span
        className={cn(
          'inline-grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[9px]',
          active ? 'bg-[var(--h)] text-white' : 'bg-[var(--ht)] text-[var(--h)]'
        )}
      >
        <FolderIcon className="h-4 w-4" />
      </span>
      <span className={cn('min-w-0 flex-1 truncate', compact && 'hidden')}>{label}</span>
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
    <div>
      <p className={cn('px-2.5 pb-1.5 text-[11.5px] font-semibold tracking-[0.04em] text-[var(--ink3)]', compact && 'hidden')}>
        {title}
      </p>
      <div className="space-y-px">
        {items.map((item) => (
          <NavRow key={item.id} item={item} pathname={pathname} onClick={onClick} compact={compact} />
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

function AppShellInner({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const toast = useToast()
  const { user, organization, signOut, recordLastSeenIfDue } = useAuthStore()
  const { users, loadUsers } = useOrgUserStore()
  const unreadCount = useNotificationStore((s) => s.unreadCount)
  const notifications = useNotificationStore((s) => s.notifications)
  const loadNotifications = useNotificationStore((s) => s.loadNotifications)
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead)
  const [online, setOnline] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
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
    void recordLastSeenIfDue()
    const onVis = () => {
      if (document.visibilityState === 'visible') void recordLastSeenIfDue()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [user?.id, recordLastSeenIfDue])

  useEffect(() => {
    if (!user?.id || !pathname) return
    void import('@/lib/analytics/trackEvent').then(({ trackEvent }) => {
      void trackEvent('page_viewed', {
        userId: user.id,
        organizationId: organization?.id,
        metadata: { path: pathname },
      })
    })
  }, [pathname, user?.id, organization?.id])

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
    loadUsers(organization.id)
    loadProjects(organization.id, true)
    loadSmallWorks(organization.id)
    const timer = window.setTimeout(() => {
      void recoverJobTypesFromWork(organization.id).catch(() => {})
    }, 400)
    return () => window.clearTimeout(timer)
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
  const allItems = [...homeItems, ...navigateItems, ...toolsItems, ...teamItems, ...accountItems]
  const title = pageTitle(pathname, allItems)
  const isHome = pathname === '/dashboard'
  const isBookLabour = pathname.startsWith('/dashboard/book-labour')
  const showHeader = !isBookLabour
  // Prototype: top bar is breadcrumb only. Every page owns its own h1.

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
    setRefreshing(true)
    router.refresh()
    toast('Data refreshed')
    window.setTimeout(() => setRefreshing(false), 600)
  }

  const confirmSignOut = async () => {
    if (window.confirm('Are you sure you want to sign out?')) {
      await signOut()
    }
  }

  const sidebar = (
    <>
      <div className="flex items-center gap-3 px-[18px] py-[18px]">
        <div className="overflow-hidden rounded-xl shadow-[0_4px_12px_rgba(30,90,168,.35)]">
          <AppLogoMark size={40} radius={12} />
        </div>
        <div className="min-w-0">
          <p className="truncate font-[family-name:var(--head)] text-base font-bold">Project Planner</p>
          <p className="truncate text-[12.5px] text-[var(--ink3)]">{organization?.name || 'Organisation'}</p>
        </div>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 pb-3">
        <div className="space-y-px">
          {homeItems.map((item) => (
            <NavRow key={item.id} item={item} pathname={pathname} onClick={closeMenus} />
          ))}
        </div>
        <div>
          <div className="flex items-center justify-between px-2.5 pb-1.5">
            <p className="text-[11.5px] font-semibold tracking-[0.04em] text-[var(--ink3)]">Navigate</p>
            <button
              type="button"
              onClick={() => setCustomiseOpen(true)}
              className="text-xs font-semibold text-[var(--blue)]"
            >
              Customise
            </button>
          </div>
          <div className="space-y-px">
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
                  hue={row.entry.type === 'smallWorks' ? 'sw' : 'proj'}
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
      <div className="border-t border-[var(--line)] p-3">
        <div className="mb-1 flex items-center gap-2.5 rounded-[14px] px-2 py-2">
          <UserAvatar user={user} size={36} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{`${user.firstName} ${user.surname}`.trim() || user.email}</p>
            <p className="truncate text-xs text-[var(--ink3)]">{organization?.name || 'Organisation'}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={confirmSignOut}
          data-hue="red"
          className="flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-[15px] font-medium text-[var(--red)] hover:bg-[var(--red-t)]"
        >
          <IconChip hue="red" size="sm">
            <ArrowRightOnRectangleIcon className="h-4 w-4" />
          </IconChip>
          Sign out
        </button>
        <p className="px-3 pt-2 text-[11px] text-[var(--ink3)]">v1.0.0 · Project Planner</p>
        {process.env.NODE_ENV !== 'production' ? (
          <Link href="/dashboard/data-health" className="block px-3 pt-1 text-[11px] text-[var(--blue)]">
            Data health
          </Link>
        ) : null}
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
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
            'flex min-h-0 flex-col border-r border-[var(--line)] bg-[var(--card)]',
            'max-[1023px]:fixed max-[1023px]:inset-y-0 max-[1023px]:left-0 max-[1023px]:z-[70] max-[1023px]:w-[290px] max-[1023px]:transition-transform',
            menuOpen ? 'max-[1023px]:translate-x-0' : 'max-[1023px]:-translate-x-full',
            'lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[268px] xl:w-[272px]'
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
            <header className="sticky top-0 z-20 flex h-[66px] items-center gap-3 bg-[color-mix(in_srgb,var(--bg)_85%,transparent)] px-6 backdrop-blur-[10px] max-[760px]:h-[60px] max-[760px]:px-3.5">
              <button
                type="button"
                className="grid h-11 w-11 place-items-center rounded-[14px] bg-[var(--card)] text-[var(--ink2)] shadow-[var(--sh)] lg:hidden"
                aria-label="Open menu"
                onClick={() => setMenuOpen(true)}
              >
                <Bars3Icon className="h-5 w-5" />
              </button>
              <nav className="crumb flex min-w-0 items-center gap-2 text-sm text-[var(--ink3)]">
                <span className="sep hidden truncate min-[761px]:inline">{organization?.name || 'Project Planner'}</span>
                <span className="sep hidden min-[761px]:inline">/</span>
                <b className="truncate font-semibold text-[var(--ink)]">{title}</b>
              </nav>
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                className="ml-auto flex h-11 w-[320px] max-w-full items-center gap-2.5 rounded-[14px] bg-[var(--card)] px-3.5 text-[14.5px] text-[var(--ink3)] shadow-[var(--sh)] max-[1100px]:w-11 max-[1100px]:justify-center max-[1100px]:px-0"
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
                    <Button variant="primary" onClick={() => setNewOpen((value) => !value)} className="relative z-20">
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
                  className="grid h-11 w-11 place-items-center rounded-[14px] bg-[var(--card)] text-[var(--ink2)] shadow-[var(--sh)]"
                  aria-label="Refresh data"
                >
                  <ArrowPathIcon className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setNotifOpen((value) => !value)}
                    className="relative grid h-11 w-11 place-items-center rounded-[14px] bg-[var(--card)] text-[var(--ink2)] shadow-[var(--sh)]"
                    aria-label="Notifications"
                  >
                    <BellIcon className="h-5 w-5" />
                    {unreadCount > 0 ? (
                      <span className="absolute right-[11px] top-2.5 h-[9px] w-[9px] rounded-full border-2 border-[var(--card)] bg-[var(--red)]" />
                    ) : null}
                  </button>
                  <NotificationsPopover
                    open={notifOpen}
                    onClose={() => setNotifOpen(false)}
                    notifications={notifications}
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
            <div className={cn('page mx-auto w-full max-w-shell', isHome ? 'px-4 py-4 min-[760px]:px-7 min-[760px]:py-6' : 'px-4 py-6 min-[760px]:px-7 min-[760px]:pb-14')}>
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
