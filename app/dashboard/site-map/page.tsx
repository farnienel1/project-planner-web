'use client'

import { useEffect, useMemo, useState } from 'react'
import { format, isSameDay } from 'date-fns'
import { useAuthStore } from '@/lib/stores/authStore'
import { useProjectStore } from '@/lib/stores/projectStore'
import { useBookingStore } from '@/lib/stores/bookingStore'
import { EmptyState, LoadingSpinner, PageHeader } from '@/components/dashboard/PageShell'
import { mergeProjectsAndSmallWorks } from '@/lib/projects/workStatus'

type SitePin = {
  id: string
  label: string
  jobNumber: string
  address: string
  latitude?: number
  longitude?: number
  bookingCount: number
  source: 'project' | 'smallWork'
}

export default function SiteMapPage() {
  const { organization } = useAuthStore()
  const { projects, smallWorks, loadProjects, loadSmallWorks } = useProjectStore()
  const { bookings, loadBookings } = useBookingStore()
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  useEffect(() => {
    if (organization?.id) {
      loadProjects(organization.id)
      loadSmallWorks(organization.id)
      loadBookings(organization.id)
    }
  }, [organization, loadProjects, loadSmallWorks, loadBookings])

  const dateObj = useMemo(() => new Date(selectedDate), [selectedDate])

  const pins = useMemo(() => {
    const allSites = mergeProjectsAndSmallWorks(projects, smallWorks).filter((site) => site.isLive)

    return allSites
      .map((site): SitePin => {
        const bookingCount = bookings.filter(
          (b) => b.projectId === site.id && isSameDay(new Date(b.date), dateObj)
        ).length
        return {
          id: site.id,
          label: site.siteName || 'Untitled site',
          jobNumber: site.jobNumber || '—',
          address: [site.addressLine1, site.townCity, site.postcode].filter(Boolean).join(', '),
          latitude: site.latitude,
          longitude: site.longitude,
          bookingCount,
          source: /small works/i.test(site.jobType || '') ? 'smallWork' as const : 'project' as const,
        }
      })
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [projects, smallWorks, bookings, dateObj])

  const withCoords = pins.filter((p) => p.latitude != null && p.longitude != null)
  const withBookings = pins.filter((p) => p.bookingCount > 0)

  if (!organization) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      <PageHeader
        title="Site map"
        description="Active sites for a selected day — built from projects, small works, and bookings (same logic as iOS OrgSitesMapView)."
        meta={`${pins.length} sites · ${withCoords.length} with coordinates · ${withBookings.length} with bookings on selected day`}
      />

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-slate-700">Selected day</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      {withCoords.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <iframe
            title="Site map"
            className="h-[420px] w-full"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${Math.min(...withCoords.map((p) => p.longitude!)) - 0.05}%2C${Math.min(...withCoords.map((p) => p.latitude!)) - 0.03}%2C${Math.max(...withCoords.map((p) => p.longitude!)) + 0.05}%2C${Math.max(...withCoords.map((p) => p.latitude!)) + 0.03}&layer=mapnik&marker=${withCoords[0].latitude}%2C${withCoords[0].longitude}`}
          />
        </div>
      )}

      {pins.length === 0 ? (
        <EmptyState title="No sites found" description="Projects and small works from Firebase will appear here." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {pins.map((pin) => (
            <div key={pin.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900">{pin.label}</h3>
                  <p className="text-sm text-slate-500">#{pin.jobNumber} · {pin.source === 'project' ? 'Project' : 'Small work'}</p>
                  <p className="mt-1 text-sm text-slate-600">{pin.address || 'No address'}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {pin.bookingCount} booking{pin.bookingCount === 1 ? '' : 's'} on {format(dateObj, 'd MMM yyyy')}
                  </p>
                </div>
                {pin.latitude != null && pin.longitude != null && (
                  <a
                    href={`https://www.google.com/maps?q=${pin.latitude},${pin.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                  >
                    Open map
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
