import type { SectionHue } from '@/lib/ui/sectionHue'

export type PaletteItem = {
  group: 'Jobs' | 'People' | 'Pages' | 'Actions'
  label: string
  href: string
  meta?: string
  hue: SectionHue
}

export function filterPaletteItems(items: PaletteItem[], query: string): PaletteItem[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return items
  return items.filter(
    (item) =>
      item.label.toLowerCase().includes(needle) ||
      (item.meta || '').toLowerCase().includes(needle) ||
      item.group.toLowerCase().includes(needle)
  )
}

export function groupPaletteItems(items: PaletteItem[]): { group: PaletteItem['group']; items: PaletteItem[] }[] {
  const order: PaletteItem['group'][] = ['Jobs', 'People', 'Pages', 'Actions']
  return order
    .map((group) => ({ group, items: items.filter((item) => item.group === group).slice(0, 8) }))
    .filter((entry) => entry.items.length > 0)
}
