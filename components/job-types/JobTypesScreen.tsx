/**
 * iOS parity source: Views/JobTypesManagementView.swift, Core/ProjectStore.swift addJobType/removeJobType
 * Spec: docs/ios-parity/sections/04-job-types.md
 */
'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FolderIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/solid'
import { useAuthStore } from '@/lib/stores/authStore'
import { canManageJobTypes } from '@/lib/permissions'
import { consumeCreateQuery } from '@/lib/navigation/createMenu'
import { EmptyState, IosFormModal, PageHeader } from '@/components/ios/primitives'
import {
  loadJobTypes,
  mergeJobTypeCatalogues,
  recoverJobTypesFromWork,
  RESTORED_JOB_TYPES,
  saveJobTypes,
  validateJobTypeName,
} from '@/lib/jobTypes/jobTypesStorage'

export function JobTypesScreen() {
  const router = useRouter()
  const { user, organization } = useAuthStore()
  const [jobTypes, setJobTypes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [name, setName] = useState('')
  const canManage = canManageJobTypes(user)

  useEffect(() => {
    if (user && !canManage) router.replace('/dashboard')
  }, [user, canManage, router])

  useEffect(() => {
    if (!canManage) return
    if (consumeCreateQuery()) {
      setError(null)
      setName('')
      setAddOpen(true)
    }
  }, [canManage])

  useEffect(() => {
    if (!organization?.id) return
    let cancelled = false
    const orgId = organization.id
    setLoading(true)

    const showList = (names: string[]) => {
      setJobTypes([...names].sort((a, b) => a.localeCompare(b)))
      setLoading(false)
    }

    void loadJobTypes(orgId)
      .then((stored) => {
        if (cancelled) return
        showList(mergeJobTypeCatalogues(stored, []))
        return recoverJobTypesFromWork(orgId)
      })
      .then((recovered) => {
        if (cancelled || !recovered) return
        showList(recovered)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load job types')
          showList([...RESTORED_JOB_TYPES])
        }
      })

    return () => {
      cancelled = true
    }
  }, [organization?.id])

  const persist = async (next: string[]) => {
    if (!organization?.id || !canManage) return
    setSaving(true)
    setError(null)
    try {
      const sorted = [...next].sort((a, b) => a.localeCompare(b))
      await saveJobTypes(organization.id, sorted)
      setJobTypes(sorted)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save job types')
    } finally {
      setSaving(false)
    }
  }

  const handleAdd = async (event: FormEvent) => {
    event.preventDefault()
    const message = validateJobTypeName(name, jobTypes)
    if (message) {
      setError(message)
      return
    }
    await persist([...jobTypes, name.trim()])
    setName('')
    setAddOpen(false)
  }

  const handleRemove = async (jobType: string) => {
    if (!window.confirm(`Delete "${jobType}"?`)) return
    await persist(jobTypes.filter((item) => item !== jobType))
  }

  if (!user || !canManage) return null

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[var(--blue)]" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[720px] space-y-5 pb-10" data-hue="daily">
      <PageHeader
        title="Job types"
        subtitle="Used to categorise every project and small works job"
        hue="daily"
        actions={
          <button
            type="button"
            onClick={() => {
              setError(null)
              setName('')
              setAddOpen(true)
            }}
            className="btn primary"
          >
            <PlusIcon className="h-4 w-4" />
            Add job type
          </button>
        }
      />

      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

      {jobTypes.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 shadow-[0_1px_2px_rgba(0,0,0,0.10)]">
          <EmptyState
            icon={<FolderIcon className="h-[60px] w-[60px] text-gray-400" />}
            title="No Job Types Added Yet"
            subtitle="Add job types that you can assign to your projects. These will appear as options when creating or editing projects."
          />
          <p className="-mt-8 pb-6 text-center text-[13px] text-[var(--ink3)]">
            Recommended: Create job types like 'CAT A', 'CAT B', 'Small Works', 'Maintenance', or any custom types you
            use.
          </p>
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="rounded-xl bg-[var(--blue)] px-5 py-2.5 text-[15px] font-semibold text-white"
            >
              Add Your First Job Type
            </button>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.10)] divide-y divide-[#E5E5EA]">
          {jobTypes.map((jobType) => (
            <div key={jobType} className="flex items-center gap-3 px-5 py-3.5">
              <FolderIcon className="h-5 w-5 text-purple-600" />
              <p className="flex-1 text-[16px] text-[var(--ink)]">{jobType}</p>
              <button
                type="button"
                onClick={() => handleRemove(jobType)}
                disabled={saving}
                className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                aria-label={`Delete ${jobType}`}
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {addOpen ? (
        <IosFormModal
          title="Add New Job Type"
          onCancel={() => setAddOpen(false)}
          footer={
            <button
              type="submit"
              form="add-job-type"
              disabled={saving || !name.trim()}
              className="w-full rounded-xl bg-[var(--blue)] py-3 text-[16px] font-semibold text-white disabled:opacity-50"
            >
              Create New Job Type
            </button>
          }
        >
          <form id="add-job-type" onSubmit={handleAdd} className="space-y-4">
            <p className="text-[15px] text-[var(--ink3)]">
              Enter the name of the job type you want to add for your projects.
            </p>
            <label className="block text-[15px] font-semibold text-[var(--ink)]">
              Job Type Name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Renovation, New Build, Repair"
                className="mt-1.5 w-full rounded-lg border border-[var(--line2)] bg-white px-3 py-2.5 text-[15px] outline-none focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue-t)]"
              />
            </label>
          </form>
        </IosFormModal>
      ) : null}
    </div>
  )
}
