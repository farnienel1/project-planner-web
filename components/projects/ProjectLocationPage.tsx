'use client'

import Link from 'next/link'
import { openMapsForProject, formatSiteAddress } from '@/lib/maps/siteAddress'
import { SetSitePinButton } from '@/components/site-map/SetSitePinButton'
import type { Project } from '@/types'

export function ProjectLocationPage({
  project,
  hubPath,
  collection = 'projects',
}: {
  project: Project
  hubPath: string
  collection?: 'projects' | 'smallWorks'
}) {
  const address = formatSiteAddress(project)
  const googleMapsUrl = openMapsForProject(project)
  const hasCoords = project.latitude != null && project.longitude != null

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Location</h2>
        <p className="mt-1 text-sm text-slate-500">{project.siteName} · {project.jobNumber}</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden divide-y divide-slate-100">
        <div className="px-5 py-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Site address</p>
          <p className="mt-2 text-sm text-slate-800 leading-relaxed">
            {address || 'No address on file'}
          </p>
        </div>
        {hasCoords && (
          <div className="px-5 py-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Map pin</p>
            <p className="mt-2 text-sm font-mono text-slate-700">
              {project.latitude?.toFixed(5)}, {project.longitude?.toFixed(5)}
            </p>
            {project.usesMapPinForLocation && (
              <p className="mt-1 text-xs text-emerald-700">Exact pin saved for site map</p>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <SetSitePinButton project={project} collection={collection} label="Set pin on map" className="px-4 py-2.5 text-sm" />
        {googleMapsUrl && (
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            Open in Google Maps
          </a>
        )}
        <Link
          href="/dashboard/site-map"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Organisation site map
        </Link>
        <Link
          href={hubPath}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Back to hub
        </Link>
      </div>
    </div>
  )
}
