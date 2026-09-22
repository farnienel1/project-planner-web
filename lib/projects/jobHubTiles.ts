/**
 * iOS parity source: Views/ProjectDetailView.swift ~L507–707
 * Spec: docs/ios-parity/sections/16-job-tiles.md
 */

export type JobHubTile = {
  href: string
  label: string
  desc: string
  badge?: number
}

export function jobHubTiles(input: {
  isOperative: boolean
  showViewTile: boolean
  canViewMaterials: boolean
  canViewSiteAudit: boolean
  locationCaption?: string
}): JobHubTile[] {
  const tiles: JobHubTile[] = []
  if (!input.isOperative) {
    tiles.push({ href: 'schedule', label: 'Scheduling', desc: 'Bookings and operative schedule' })
  }
  if (input.showViewTile && !input.isOperative) {
    tiles.push({ href: 'view', label: 'View', desc: 'Control who can see this project' })
  }
    tiles.push({ href: 'tasks', label: 'Tasks', desc: 'Tasks and assignments' })
  if (input.canViewMaterials) {
    tiles.push({ href: 'materials', label: 'Materials', desc: 'Materials list and send to wholesaler' })
  }
  tiles.push({ href: 'health-safety', label: 'H&S', desc: 'Toolbox talks, RAMS, documents' })
  if (input.canViewSiteAudit) {
    tiles.push({ href: 'site-audit', label: 'Site Audit', desc: 'Audits for this project' })
  }
  tiles.push({
    href: 'location',
    label: 'Location',
    desc: input.locationCaption || 'View on map',
  })
  return tiles
}
