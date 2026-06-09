'use client'

import { useMemo, useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { useProjectStore } from '@/lib/stores/projectStore'
import type { ProjectSaveInput } from '@/lib/firebase/projectPayload'
import { SitePinPickerSheet, type SitePinSavePayload } from '@/components/site-map/SitePinPickerSheet'
import type { Project } from '@/types'

type SetSitePinButtonProps = {
  project: Project
  collection: 'projects' | 'smallWorks'
  onUpdated?: (project: Project) => void
  className?: string
  label?: string
}

export function SetSitePinButton({
  project,
  collection,
  onUpdated,
  className = '',
  label = 'Set pin on map',
}: SetSitePinButtonProps) {
  const { organization } = useAuthStore()
  const { saveProject } = useProjectStore()
  const [open, setOpen] = useState(false)

  const pickerProject = useMemo(
    () => ({
      siteName: project.siteName,
      jobNumber: project.jobNumber,
      addressLine1: project.addressLine1,
      addressLine2: project.addressLine2,
      townCity: project.townCity,
      postcode: project.postcode,
      siteAddress: project.siteAddress,
      latitude: project.latitude,
      longitude: project.longitude,
    }),
    [project]
  )

  const handleSave = async (payload: SitePinSavePayload) => {
    if (!organization?.id) throw new Error('Organisation not loaded')

    const input: ProjectSaveInput = {
      id: project.id,
      organizationId: organization.id,
      jobNumber: project.jobNumber,
      siteName: project.siteName,
      addressLine1: payload.addressLine1,
      addressLine2: payload.addressLine2,
      townCity: payload.townCity,
      postcode: payload.postcode,
      client: project.client,
      startDate: project.startDate,
      endDate: project.endDate,
      jobType: project.jobType,
      customJobType: project.customJobType,
      managerId: project.managerId,
      managerIds: project.managerIds,
      managerLegacy: project.manager.name,
      isLive: project.isLive,
      description: project.description,
      notes: project.notes,
      latitude: payload.latitude,
      longitude: payload.longitude,
      usesMapPinForLocation: true,
      hiddenManagerUserIds: project.hiddenManagerUserIds,
      hiddenOperativeUserIds: project.hiddenOperativeUserIds,
      createdAt: project.createdAt,
      updatedAt: new Date(),
    }

    await saveProject(input, collection)
    onUpdated?.({
      ...project,
      addressLine1: payload.addressLine1,
      addressLine2: payload.addressLine2,
      townCity: payload.townCity,
      postcode: payload.postcode,
      latitude: payload.latitude,
      longitude: payload.longitude,
      usesMapPinForLocation: true,
      updatedAt: new Date(),
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 ${className}`}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        {label}
      </button>
      <SitePinPickerSheet
        open={open}
        siteName={project.siteName}
        jobNumber={project.jobNumber}
        initial={pickerProject}
        onClose={() => setOpen(false)}
        onSave={handleSave}
      />
    </>
  )
}
