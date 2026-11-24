'use client'

/** Which dot is which (owner 24 Nov: projects blue, small works red). */
export function SiteMapLegend() {
  return (
    <div className="sitemap-legend" aria-label="Map key">
      <span>
        <span className="sitemap-dot" data-kind="project" aria-hidden="true" /> Project
      </span>
      <span>
        <span className="sitemap-dot" data-kind="smallWork" aria-hidden="true" /> Small works
      </span>
    </div>
  )
}

/** Off by default: Active and Upcoming jobs only; on adds Completed jobs (owner 24 Nov). */
export function SiteMapCompletedToggle({ checked, onChange }: { checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <label className="sitemap-toggle">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>Show completed jobs</span>
    </label>
  )
}
