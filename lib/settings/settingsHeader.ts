import { SETTINGS_NAV, type SettingsNavItem } from '@/lib/settings/settingsNav'

/** Title, description, icon and hue for a settings page header, taken from the menu so they always match. */
export function settingsHeader(id: SettingsNavItem['id']): {
  title: string
  description: string
  iconPath: string
  hue: string
} {
  const item = SETTINGS_NAV.find((row) => row.id === id)
  return {
    title: item?.label ?? '',
    description: item?.description ?? '',
    iconPath: item?.icon ?? '',
    hue: item?.hue ?? 'lib',
  }
}

/** 1 → "1st", 2 → "2nd", 11 → "11th", 22 → "22nd". */
export function ordinalDay(day: number): string {
  const mod100 = day % 100
  if (mod100 >= 11 && mod100 <= 13) return `${day}th`
  const suffix = day % 10 === 1 ? 'st' : day % 10 === 2 ? 'nd' : day % 10 === 3 ? 'rd' : 'th'
  return `${day}${suffix}`
}
