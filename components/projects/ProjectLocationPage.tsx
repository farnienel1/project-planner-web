/**
 * iOS parity source: Views/ProjectDetailView.swift siteLocationSection ~L1745–1858
 * Spec: docs/ios-parity/sections/16-job-tiles.md
 */
'use client'

import { useEffect, useState } from 'react'
import { SetSitePinButton } from '@/components/site-map/SetSitePinButton'
import { SiteLocationMap } from '@/components/projects/SiteLocationMap'
import { FeatureCard } from '@/components/projects/features/featureUi'
import { resolveSiteCoordinate } from '@/lib/maps/geocoding'
import {
  appleMapsUrlForProject,
  googleMapsUrlForProject,
  hasValidSiteLocation,
  locationDisplayText,
  mapCoordinateForProject,
} from '@/lib/maps/siteLocation'
import type { Project } from '@/types'

export function ProjectLocationPage({
  project,
  collection = 'projects',
}: {
  project: Project
  hubPath?: string
  collection?: 'projects' | 'smallWorks'
}) {
  const pinned = mapCoordinateForProject(project)
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(pinned)
  const valid = hasValidSiteLocation(project)
  const display = locationDisplayText(project)
  const appleUrl = appleMapsUrlForProject({ ...project, siteName: project.siteName })
  const googleUrl = googleMapsUrlForProject(project)

  useEffect(() => {
    let cancelled = false
    if (pinned) {
      setCoords(pinned)
      return () => {
        cancelled = true
      }
    }
    setCoords(null)
    void resolveSiteCoordinate(
      {
        addressLine1: project.addressLine1,
        addressLine2: project.addressLine2,
        townCity: project.townCity,
        postcode: project.postcode,
        siteName: project.siteName,
        siteAddress: project.siteAddress,
      },
      null
    ).then((point) => {
      if (!cancelled) setCoords(point)
    })
    return () => {
      cancelled = true
    }
  }, [
    project.addressLine1,
    project.addressLine2,
    project.townCity,
    project.postcode,
    project.siteAddress,
    project.siteName,
    project.usesMapPinForLocation,
    pinned?.latitude,
    pinned?.longitude,
  ])

  return (
    <div className="grid gap-4 xl:grid-cols-12">
      <FeatureCard className="p-5 xl:col-span-8">
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-[var(--blue)]" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14A1 1 0 003 18h14a1 1 0 00.894-1.447l-7-14z" />
          </svg>
          <h2 className="text-lg font-semibold text-slate-900">Site Location</h2>
        </div>

        {valid ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-slate-800">{display}</p>
            <div className="flex flex-wrap gap-2.5">
              {appleUrl && (
                <a
                  href={appleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-lg bg-[var(--blue)] px-3.5 py-2 text-sm font-semibold text-white"
                >
                  Apple Maps
                </a>
              )}
              {googleUrl && (
                <a
                  href={googleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-lg bg-slate-100 px-3.5 py-2 text-sm font-semibold text-[var(--blue)]"
                >
                  Google Maps
                </a>
              )}
            </div>
            {coords ? (
              <SiteLocationMap latitude={coords.latitude} longitude={coords.longitude} label={project.siteName} />
            ) : (
              <div className="flex h-[200px] items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-500">
                Finding map pin…
              </div>
            )}
          </div>
        ) : (
          <p className="mt-4 rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-500">Site Location not available</p>
        )}
      </FeatureCard>

      <div className="xl:col-span-4">
        <SetSitePinButton
          project={project}
          collection={collection}
          label="Set pin on map"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
        />
      </div>
    </div>
  )
}
