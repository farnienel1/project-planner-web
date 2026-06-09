import type { TileId } from '@/lib/stores/dashboardStore'

export type TileMeta = {
  id: TileId
  name: string
  description: string
  category: string
  wide: boolean
  heroEligible: boolean
  icon: string
  iconBg: string
  iconColor: string
}

const TILE_CATALOGUE_BASE: Omit<TileMeta, 'heroEligible'>[] = [
  { id: 'tasks_open', name: 'Open tasks', description: 'To do + in progress count with status pills', category: 'Tasks', wide: false, icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', iconBg: '#dbeafe', iconColor: '#1e40af' },
  { id: 'tasks_overdue', name: 'Overdue tasks', description: 'Tasks past their due date', category: 'Tasks', wide: false, icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', iconBg: '#fee2e2', iconColor: '#991b1b' },
  { id: 'tasks_completed', name: 'Tasks completed', description: 'Total completed tasks count', category: 'Tasks', wide: false, icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', iconBg: '#dcfce7', iconColor: '#166534' },
  { id: 'tasks_priority', name: 'Task priority split', description: 'Urgent / High / Normal / Low breakdown', category: 'Tasks', wide: true, icon: 'M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12', iconBg: '#fef3c7', iconColor: '#92400e' },
  { id: 'projects_active', name: 'Active projects', description: 'Live project count + active small works', category: 'Projects', wide: false, icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', iconBg: '#ede9fe', iconColor: '#6d28d9' },
  { id: 'projects_pipeline', name: 'Project pipeline', description: 'Live vs completed bar breakdown', category: 'Projects', wide: true, icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', iconBg: '#ede9fe', iconColor: '#6d28d9' },
  { id: 'projects_health', name: 'Project health', description: 'Timeline progress per live project', category: 'Projects', wide: true, icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z', iconBg: '#ede9fe', iconColor: '#6d28d9' },
  { id: 'bookings_total', name: 'Total bookings', description: 'All bookings this period', category: 'Schedule', wide: false, icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', iconBg: '#ecfdf5', iconColor: '#065f46' },
  { id: 'bookings_clashes', name: 'Booking clashes', description: 'Operatives with overlapping bookings', category: 'Schedule', wide: false, icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z', iconBg: '#fef3c7', iconColor: '#92400e' },
  { id: 'bookings_trend', name: 'Bookings trend', description: 'Bookings by day of week', category: 'Schedule', wide: true, icon: 'M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z', iconBg: '#ecfdf5', iconColor: '#065f46' },
  { id: 'operatives_active', name: 'Active operatives', description: 'Operatives on roster', category: 'People', wide: false, icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', iconBg: '#fdf4ff', iconColor: '#7e22ce' },
  { id: 'operatives_utilisation', name: 'Operative utilisation', description: 'Booked vs roster operatives', category: 'People', wide: true, icon: 'M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z', iconBg: '#fdf4ff', iconColor: '#7e22ce' },
  { id: 'leave_pending', name: 'Pending leave', description: 'Leave requests awaiting your approval', category: 'People', wide: false, icon: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z', iconBg: '#fef3c7', iconColor: '#92400e' },
  { id: 'leave_calendar', name: 'Leave allowance', description: 'Your taken vs pending vs remaining leave', category: 'People', wide: true, icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', iconBg: '#fef3c7', iconColor: '#92400e' },
  { id: 'audits_open', name: 'Site audits', description: 'Recent site audits recorded', category: 'Compliance', wide: false, icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', iconBg: '#ecfdf5', iconColor: '#065f46' },
  { id: 'audits_score', name: 'Audit activity trend', description: 'Site audits logged over 6 months', category: 'Compliance', wide: true, icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6', iconBg: '#ecfdf5', iconColor: '#065f46' },
  { id: 'small_works', name: 'Small works count', description: 'Active small works / reactive jobs', category: 'Projects', wide: false, icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z', iconBg: '#fff7ed', iconColor: '#9a3412' },
  { id: 'small_works_status', name: 'Small works by status', description: 'Active vs completed breakdown', category: 'Projects', wide: true, icon: 'M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z', iconBg: '#fff7ed', iconColor: '#9a3412' },
  { id: 'timesheets_submitted', name: 'Bookings this week', description: 'Scheduled operative days this week', category: 'Timesheets', wide: false, icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', iconBg: '#eff6ff', iconColor: '#1e40af' },
  { id: 'timesheets_hours', name: 'Hours logged trend', description: 'Estimated hours from bookings (4 weeks)', category: 'Timesheets', wide: true, icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', iconBg: '#eff6ff', iconColor: '#1e40af' },
  { id: 'clients_total', name: 'Total clients', description: 'All clients in the directory', category: 'Clients', wide: false, icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', iconBg: '#f0fdf4', iconColor: '#166534' },
  { id: 'warnings_active', name: 'Active warnings', description: 'Booking clash warning count', category: 'Alerts', wide: false, icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z', iconBg: '#fef9c3', iconColor: '#854d0e' },
]

export const TILE_CATALOGUE: TileMeta[] = TILE_CATALOGUE_BASE.map((tile) => ({
  ...tile,
  heroEligible: !tile.wide,
}))

export const TILE_CATEGORIES = ['All', ...Array.from(new Set(TILE_CATALOGUE.map((t) => t.category)))]

export function isHeroEligible(id: TileId): boolean {
  const tile = TILE_CATALOGUE_BASE.find((t) => t.id === id)
  return tile ? !tile.wide : false
}

export function getTileMeta(id: TileId): TileMeta | undefined {
  return TILE_CATALOGUE.find((t) => t.id === id)
}
