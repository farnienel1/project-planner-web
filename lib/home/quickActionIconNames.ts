/**
 * Keys used by `quickActionMeta().icon` and `QuickActionIcon`.
 * Keep in sync with the Heroicon map in `components/home/QuickActionIcon.tsx`.
 */
export const QUICK_ACTION_ICON_NAMES = [
  'folder',
  'hammer',
  'sun',
  'scan',
  'calendar',
  'cog',
  'chart',
  'clock-cal',
  'shield',
  'users',
  'handshake',
  'map',
  'briefcase',
  'plus-square',
  'grad',
  'grid',
  'building',
  'box',
  'user-plus',
  'help',
  'sliders',
  'tasks',
  'doc',
] as const

export type QuickActionIconName = (typeof QUICK_ACTION_ICON_NAMES)[number]

export const QUICK_ACTION_ICON_NAME_SET: ReadonlySet<string> = new Set(QUICK_ACTION_ICON_NAMES)
