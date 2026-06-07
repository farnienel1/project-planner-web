'use client'

import Link from 'next/link'
import type { Project } from '@/types'

export function ProjectLocationPage({ project, hubPath }: { project: Project; hubPath: string }) {
  const address = [project.addressLine1, project.addressLine2, project.townCity, project.postcode]
    .filter(Boolean)
    .join(', ')

  const mapsQuery = encodeURIComponent(address || project.siteName)
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`
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
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Coordinates</p>
            <p className="mt-2 text-sm font-mono text-slate-700">
              {project.latitude?.toFixed(5)}, {project.longitude?.toFixed(5)}
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          Open in Google Maps
        </a>
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
