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
