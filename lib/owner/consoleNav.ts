/**
 * Owner console sidebar (spec §4, PLAN §8 PR 1). The groups are the spec's; the routes are the pages that exist.
 *
 * Standing owner rule "useful features only" (16 Nov): the menu lists only pages backed by real data. A page that is
 * planned but not built, or has no data source connected, has no menu entry until it does (`shown: false`, with the
 * reason). Old routes stay reachable by their address (spec §6.6: nothing is removed before its replacement).
 */

export type ConsoleNavGroupId = 'today' | 'customers' | 'money' | 'product' | 'platform' | 'record' | 'bottom'

export type ConsoleNavItem = {
  label: string
  /** The page's address; `null` when the page does not exist yet. */
  href: string | null
  /** In the menu only when the page exists and reads real data. */
  shown: boolean
  /** Why an item is not shown, or what it reads when it is (the useful-only audit in the PR body). */
  note: string
  /** The PR that builds or rebuilds it (PLAN §8). */
  plannedIn?: string
  /** The page uses the shared period selector in the console header. */
  usesPeriod?: boolean
  /** A count shown beside the label (each is a link to the matching list). */
  badge?: 'feedbackTriage' | 'interestNew'
}

export type ConsoleNavGroup = { id: ConsoleNavGroupId; label: string; items: ConsoleNavItem[] }

export const CONSOLE_NAV: ConsoleNavGroup[] = [
  {
    id: 'today',
    label: 'Today',
    items: [
      { label: 'Overview', href: '/developer', shown: true, usesPeriod: true, note: 'Active organisations and people, MRR, new people and organisations, organisations needing attention and the live feed (PR 2).' },
      { label: 'Needs you', href: null, shown: false, note: 'Not built yet (PR 3).', plannedIn: 'PR 3' },
    ],
  },
  {
    id: 'customers',
    label: 'Customers',
    items: [
      { label: 'Organisations', href: '/developer/organisations', shown: true, note: 'Organisation documents and their people.', plannedIn: 'PR 4' },
      { label: 'People', href: '/developer/users', shown: true, note: 'One row per person across every organisation (server directory); each opens the person page and its actions.' },
      { label: 'Register interest', href: '/developer/register-interest', shown: true, badge: 'interestNew', note: 'interestRegistrations, live.' },
    ],
  },
  {
    id: 'money',
    label: 'Money',
    items: [
      { label: 'Timesheet value', href: null, shown: false, note: 'Not built yet (PR 6, with the rollups).', plannedIn: 'PR 6' },
      { label: 'Revenue', href: '/developer/revenue', shown: true, note: 'organizations/{id}.billing. Definitions are fixed in PR 7.', plannedIn: 'PR 7' },
    ],
  },
  {
    id: 'product',
    label: 'Product',
    items: [
      { label: 'Growth & engagement', href: '/developer/growth', shown: true, usesPeriod: true, note: 'Directory and product events, and the platform scoreboard moved from the Overview (PR 2); rebuilt from records in PR 8.', plannedIn: 'PR 8' },
      { label: 'Feature usage', href: '/developer/usage', shown: true, note: 'productEvents (web, people who accepted analytics cookies).' },
      { label: 'Analytics', href: '/developer/analytics', shown: true, note: 'Old page, kept until Growth replaces it (PR 8).', plannedIn: 'PR 8' },
      { label: 'Feedback', href: '/developer/feedback', shown: true, badge: 'feedbackTriage', note: 'productFeedback board.' },
      { label: 'Roadmap', href: '/developer/roadmap', shown: true, note: 'productFeedback cards on the roadmap.' },
    ],
  },
  {
    id: 'platform',
    label: 'Platform',
    items: [
      {
        label: 'Status',
        href: '/developer/status',
        shown: true,
        note: 'The running web deploy and rulebook, live rules against this build, Cloud Functions errors, email failures and platformConfig/app (read-only); a source the server cannot read is listed as Not connected.',
      },
      { label: 'Health & data', href: '/developer/data-quality', shown: true, note: 'Today the Data quality page; rebuilt as Health & data in PR 9.', plannedIn: 'PR 9' },
      { label: 'Errors', href: '/developer/errors', shown: true, note: 'clientErrors (D7, rulebook 1.84.0): pseudonymous web and iPhone error reports (no message text) grouped by kind, where and message key / hash, through the owner-only /api/owner/errors.' },
      { label: 'Emails & notifications', href: null, shown: false, note: 'No email or push log is written yet (PR 11).', plannedIn: 'PR 11' },
      { label: 'Releases & switches', href: null, shown: false, note: 'Not built yet (PR 9, read-only, D17).', plannedIn: 'PR 9' },
    ],
  },
  {
    id: 'record',
    label: 'Record',
    items: [{ label: 'Audit log', href: null, shown: false, note: 'Not built yet (PR 10).', plannedIn: 'PR 10' }],
  },
  {
    id: 'bottom',
    label: 'Account',
    items: [{ label: 'Account', href: '/developer/account', shown: true, note: 'Your owner account.' }],
  },
]

/** Pages kept at their address but never in the menu (owner decision D8: no website stats source). */
export const CONSOLE_UNLISTED_ROUTES: { href: string; note: string }[] = [
  { href: '/developer/website-stats', note: 'D8: no website stats source — left out of the menu.' },
  { href: '/developer/pages', note: 'Old page events view; replaced in the menu by Errors (clientErrors, D7, 1.84.0).' },
]

/** The groups as the sidebar shows them: shown items only, empty groups dropped. */
export function visibleConsoleNav(nav: ConsoleNavGroup[] = CONSOLE_NAV): ConsoleNavGroup[] {
  return nav
    .map((group) => ({ ...group, items: group.items.filter((item) => item.shown && item.href) }))
    .filter((group) => group.items.length > 0)
}

/** The menu item a path belongs to (the longest matching address), for the "current page" mark. */
export function activeConsoleHref(pathname: string, nav: ConsoleNavGroup[] = CONSOLE_NAV): string | null {
  let best: string | null = null
  for (const group of nav) {
    for (const item of group.items) {
      if (!item.shown || !item.href) continue
      const match = item.href === '/developer' ? pathname === '/developer' : pathname === item.href || pathname.startsWith(`${item.href}/`)
      if (match && (!best || item.href.length > best.length)) best = item.href
    }
  }
  return best
}

/** True when the page at this path reads the shared period selector. */
export function consolePageUsesPeriod(pathname: string, nav: ConsoleNavGroup[] = CONSOLE_NAV): boolean {
  const href = activeConsoleHref(pathname, nav)
  return Boolean(href && nav.some((group) => group.items.some((item) => item.href === href && item.usesPeriod)))
}
