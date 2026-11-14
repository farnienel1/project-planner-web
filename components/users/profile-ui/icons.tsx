/** Line icons for the User profile UI pack (docs/design/user-profile-ui/). Decoration only: always aria-hidden. */

const PATHS = {
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2 20a7 7 0 0 1 14 0M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14a6 6 0 0 1 4 6',
  hat: 'M3 17h18M5 17v-2a7 7 0 0 1 14 0v2M10 9V6h4v3',
  brief: 'M3 7h18v13H3zM9 7V4h6v3M3 12h18',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4',
  badge: 'M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 15.6 7.1 18.2 8 12.7 4 8.8l5.5-.8z',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5',
  sheet: 'M6 3h12v18H6zM9 8h6M9 12h6M9 16h4',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2',
  key: 'M8 15a4 4 0 1 1 3.5-6H21v3h-2v3h-3v-3h-4.5A4 4 0 0 1 8 15z',
  refresh: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5',
  chat: 'M4 5h16v11H9l-5 4z',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  warn: 'M12 3l10 18H2zM12 10v5M12 17.5v.5',
  right: 'M9 6l6 6-6 6',
  left: 'M15 6l-6 6 6 6',
  pencil: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  upload: 'M12 16V5M7 10l5-5 5 5M4 20h16',
  box: 'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10',
  folder: 'M3 6h6l2 2h10v11H3z',
  tools: 'M14 6l4-4 4 4-4 4M18 6L7 17M4 20l3-3',
  cal: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  sub: 'M4 21V4h11v17M15 9h5v12M8 8h3M8 12h3M8 16h3M3 21h18',
  cart: 'M3 4h2l2 12h11l2-8H6M9 20h.5M17 20h.5',
  doc: 'M6 3h8l5 5v13H6zM14 3v5h5M9 13h6M9 17h6',
  scan: 'M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M8 12h8',
  pulse: 'M3 12h4l3-7 4 14 3-7h4',
  star: 'M12 3v18M3 12h18',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8v.5',
} as const

export type ProfileIconName = keyof typeof PATHS

export function ProfileIcon({ name, size = 16 }: { name: ProfileIconName; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}

/** Icon shown on a permission row (`permissionToggleRows` field key). Unknown keys get the shield. */
export function permissionIconFor(field: string): ProfileIconName {
  switch (field) {
    case 'projects':
      return 'folder'
    case 'smallWorks':
      return 'tools'
    case 'dailyOverview':
      return 'cal'
    case 'subContractors':
      return 'sub'
    case 'annualLeaveSelfBook':
      return 'sun'
    case 'timesheetSelfSign':
      return 'sheet'
    case 'operatives':
      return 'hat'
    case 'qualifications':
      return 'badge'
    case 'skills':
      return 'star'
    case 'wholesalersOrderHistory':
      return 'cart'
    case 'materials':
      return 'box'
    case 'siteAudit':
      return 'scan'
    case 'weeklyReports':
      return 'doc'
    case 'manager':
      return 'brief'
    case 'adminAccess':
      return 'key'
    default:
      return 'shield'
  }
}
