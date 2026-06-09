'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { loadLeaflet, type LeafletMap, type LeafletMarker } from '@/lib/maps/leafletLoader'
import { mapPinIconOptions } from '@/lib/maps/mapPinIcon'
import { cacheGeocodeResult, reverseGeocode } from '@/lib/maps/geocoding'
import { formatSiteAddress, googleMapsCoordinateUrl } from '@/lib/maps/siteAddress'

export type SitePinSavePayload = {
  latitude: number
  longitude: number
  addressLine1: string
  addressLine2?: string
  townCity: string
  postcode: string
  usesMapPinForLocation: true
}

type SitePinPickerSheetProps = {
  open: boolean
  siteName: string
  jobNumber?: string
  initial: {
    addressLine1?: string
    addressLine2?: string
    townCity?: string
    postcode?: string
    siteAddress?: string
    latitude?: number
    longitude?: number
  }
  onClose: () => void
  onSave: (payload: SitePinSavePayload) => Promise<void> | void
}

export function SitePinPickerSheet({
  open,
  siteName,
  jobNumber,
  initial,
  onClose,
  onSave,
}: SitePinPickerSheetProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const markerRef = useRef<LeafletMarker | null>(null)
  const [draft, setDraft] = useState<{ latitude: number; longitude: number } | null>(null)
  const [resolvedAddress, setResolvedAddress] = useState('')
  const [addressFields, setAddressFields] = useState({
    addressLine1: initial.addressLine1 || '',
    addressLine2: initial.addressLine2 || '',
    townCity: initial.townCity || '',
    postcode: initial.postcode || '',
  })
  const [saving, setSaving] = useState(false)
  const [lookingUp, setLookingUp] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const start =
      initial.latitude != null && initial.longitude != null
        ? { latitude: initial.latitude, longitude: initial.longitude }
        : null
    setDraft(start)
    setAddressFields({
      addressLine1: initial.addressLine1 || '',
      addressLine2: initial.addressLine2 || '',
      townCity: initial.townCity || '',
      postcode: initial.postcode || '',
    })
    setResolvedAddress(formatSiteAddress(initial))
    setError(null)
  }, [open, initial])

  useEffect(() => {
    if (!open) return

    let cancelled = false

    const updateDraft = (latitude: number, longitude: number) => {
      setDraft({ latitude, longitude })
      const map = mapRef.current
      const L = window.L
      if (!map || !L) return

      if (markerRef.current) {
        markerRef.current.setLatLng([latitude, longitude])
      } else {
        markerRef.current = L.marker([latitude, longitude], {
          icon: L.divIcon(mapPinIconOptions('#2563eb', true)),
          draggable: true,
        }).addTo(map)
        markerRef.current.on('dragend', () => {
          const target = markerRef.current as LeafletMarker & {
            getLatLng?: () => { lat: number; lng: number }
          }
          const latlng = target.getLatLng?.()
          if (latlng) updateDraft(latlng.lat, latlng.lng)
        })
      }
    }

    loadLeaflet()
      .then((L) => {
        if (cancelled || !mapContainerRef.current) return

        mapRef.current?.remove()
        markerRef.current = null

        const map = L.map(mapContainerRef.current, { zoomControl: true, scrollWheelZoom: true })
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map)

        const start = draft || { latitude: 51.5074, longitude: -0.1278 }
        map.setView([start.latitude, start.longitude], draft ? 16 : 11)
        if (draft) updateDraft(draft.latitude, draft.longitude)

        map.on('click', (event: { latlng: { lat: number; lng: number } }) => {
          updateDraft(event.latlng.lat, event.latlng.lng)
        })

        mapRef.current = map
        setTimeout(() => map.invalidateSize(), 150)
      })
      .catch((lookupError: Error) => setError(lookupError.message))

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open || !draft) return

    let cancelled = false
    setLookingUp(true)

    reverseGeocode(draft.latitude, draft.longitude)
      .then((result) => {
        if (cancelled || !result) return
        setResolvedAddress(result.displayName)
        setAddressFields((current) => ({
          addressLine1: result.addressLine1 || current.addressLine1,
          addressLine2: result.addressLine2 || current.addressLine2,
          townCity: result.townCity || current.townCity,
          postcode: result.postcode || current.postcode,
        }))
      })
      .finally(() => {
        if (!cancelled) setLookingUp(false)
      })

    return () => {
      cancelled = true
    }
  }, [draft, open])

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  if (!open) return null

  const googleVerifyUrl = draft ? googleMapsCoordinateUrl(draft.latitude, draft.longitude) : null

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center">
      <div className="relative z-[10000] flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">Set pin on map</h2>
          <p className="mt-1 text-sm text-slate-500">
            {siteName}
            {jobNumber ? ` · #${jobNumber}` : ''}
          </p>
          <p className="mt-1 text-xs text-slate-400">Click or drag the pin to mark the exact site location.</p>
        </div>

        <div ref={mapContainerRef} className="relative isolate z-0 h-[340px] w-full bg-slate-100" />

        <div className="space-y-3 overflow-y-auto px-5 py-4">
          {!draft ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Click the map to drop a pin for this site.
            </p>
          ) : (
            <>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">Pin coordinates</p>
                <p className="mt-1 font-mono text-xs">
                  {draft.latitude.toFixed(6)}, {draft.longitude.toFixed(6)}
                </p>
                {lookingUp ? (
                  <p className="mt-2 text-xs text-slate-500">Looking up address…</p>
                ) : (
                  <p className="mt-2 text-xs text-slate-600">{resolvedAddress || 'Address lookup unavailable'}</p>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Address line 1
                  </span>
                  <input
                    value={addressFields.addressLine1}
                    onChange={(e) => setAddressFields((f) => ({ ...f, addressLine1: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Town / city
                  </span>
                  <input
                    value={addressFields.townCity}
                    onChange={(e) => setAddressFields((f) => ({ ...f, townCity: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Postcode
                  </span>
                  <input
                    value={addressFields.postcode}
                    onChange={(e) => setAddressFields((f) => ({ ...f, postcode: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              {googleVerifyUrl && (
                <a
                  href={googleVerifyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                >
                  Verify on Google Maps
                </a>
              )}
            </>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!draft || saving}
            onClick={async () => {
              if (!draft) return
              setSaving(true)
              setError(null)
              try {
                const payload: SitePinSavePayload = {
                  latitude: draft.latitude,
                  longitude: draft.longitude,
                  addressLine1: addressFields.addressLine1.trim(),
                  addressLine2: addressFields.addressLine2.trim() || undefined,
                  townCity: addressFields.townCity.trim(),
                  postcode: addressFields.postcode.trim(),
                  usesMapPinForLocation: true,
                }
                cacheGeocodeResult(formatSiteAddress(payload), draft)
                await onSave(payload)
                onClose()
              } catch (saveError: unknown) {
                setError(saveError instanceof Error ? saveError.message : 'Failed to save pin')
              } finally {
                setSaving(false)
              }
            }}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save pin & address'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
