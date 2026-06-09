'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { useProjectStore } from '@/lib/stores/projectStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import type { Project } from '@/types'
import { DEFAULT_JOB_TYPES } from '@/types'
import type { ProjectSaveInput } from '@/lib/firebase/projectPayload'
import { FormActions, FormInput, FormLabel, FormSelect, FormTextarea } from '@/components/forms/FormShell'
import { ErrorBanner } from '@/components/dashboard/PageShell'
import { SitePinPickerSheet } from '@/components/site-map/SitePinPickerSheet'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { getManagerUsers } from '@/lib/staff/userRosterUtils'

type ProjectFormProps = {
  initial?: Project | null
  collection?: 'projects' | 'smallWorks'
  backHref: string
  onSaved: (id: string) => void
}

export function ProjectForm({ initial, collection = 'projects', backHref, onSaved }: ProjectFormProps) {
  const { organization } = useAuthStore()
  const { clients, loadClients, saveProject, createClient } = useProjectStore()
  const { managers, placeholderManagerCount, loadManagers } = useOperativeStore()
  const { users, loadUsers } = useOrgUserStore()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pinPickerOpen, setPinPickerOpen] = useState(false)
  const [newClientName, setNewClientName] = useState('')

  const [form, setForm] = useState({
    jobNumber: initial?.jobNumber || '',
    siteName: initial?.siteName || '',
    addressLine1: initial?.addressLine1 || '',
    addressLine2: initial?.addressLine2 || '',
    townCity: initial?.townCity || '',
    postcode: initial?.postcode || '',
    clientId: initial?.client?.id || '',
    startDate: initial?.startDate ? new Date(initial.startDate).toISOString().slice(0, 10) : '',
    endDate: initial?.endDate ? new Date(initial.endDate).toISOString().slice(0, 10) : '',
    jobType: initial?.jobType || (collection === 'smallWorks' ? 'Small Works' : 'CAT A'),
    customJobType: initial?.customJobType || '',
    managerIds: initial?.managerIds?.length ? initial.managerIds : initial?.managerId ? [initial.managerId] : [],
    description: initial?.description || '',
    notes: initial?.notes || '',
    isLive: initial?.isLive !== false,
    latitude: initial?.latitude?.toString() || '',
    longitude: initial?.longitude?.toString() || '',
  })

  useEffect(() => {
    if (organization?.id) {
      loadClients(organization.id)
      loadManagers(organization.id)
      loadUsers(organization.id)
    }
  }, [organization, loadClients, loadManagers, loadUsers])

  const managerUsers = getManagerUsers(users)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!organization?.id) return
    setError(null)
    if (!form.jobNumber.trim() || !form.siteName.trim() || !form.clientId || !form.startDate || !form.endDate) {
      setError('Job number, site name, client, and dates are required.')
      return
    }
    if (form.managerIds.length === 0) {
      setError('Select at least one manager.')
      return
    }
    const client = clients.find((c) => c.id === form.clientId)
    if (!client) {
      setError('Select a valid client.')
      return
    }

    setSaving(true)
    try {
      const input: ProjectSaveInput = {
        id: initial?.id || '',
        organizationId: organization.id,
        jobNumber: form.jobNumber,
        siteName: form.siteName,
        addressLine1: form.addressLine1,
        addressLine2: form.addressLine2,
        townCity: form.townCity,
        postcode: form.postcode,
        client,
        startDate: new Date(form.startDate),
        endDate: new Date(form.endDate),
        jobType: form.jobType,
        customJobType: form.customJobType,
        managerId: form.managerIds[0],
        managerIds: form.managerIds,
        managerLegacy: managers.find((m) => m.id === form.managerIds[0])?.firstName
          ? `${managers.find((m) => m.id === form.managerIds[0])!.firstName} ${managers.find((m) => m.id === form.managerIds[0])!.lastName}`
          : 'Project Manager',
        isLive: form.isLive,
        description: form.description,
        notes: form.notes,
        latitude: form.latitude ? Number(form.latitude) : undefined,
        longitude: form.longitude ? Number(form.longitude) : undefined,
        usesMapPinForLocation: Boolean(form.latitude && form.longitude),
        createdAt: initial?.createdAt,
      }
      const id = await saveProject(input, collection)
      onSaved(id)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save project')
    } finally {
      setSaving(false)
    }
  }

  const addQuickClient = async () => {
    if (!organization?.id || !newClientName.trim()) return
    const client = await createClient({ name: newClientName.trim(), organizationId: organization.id })
    setForm({ ...form, clientId: client.id })
    setNewClientName('')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {error && <ErrorBanner message={error} />}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <FormLabel required>Job number</FormLabel>
          <FormInput value={form.jobNumber} onChange={(e) => setForm({ ...form, jobNumber: e.target.value })} required />
        </div>
        <div>
          <FormLabel required>Site name</FormLabel>
          <FormInput value={form.siteName} onChange={(e) => setForm({ ...form, siteName: e.target.value })} required />
        </div>
        <div>
          <FormLabel>Job type</FormLabel>
          <FormSelect value={form.jobType} onChange={(e) => setForm({ ...form, jobType: e.target.value })}>
            {DEFAULT_JOB_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </FormSelect>
        </div>
        <div>
          <FormLabel>Custom job type</FormLabel>
          <FormInput value={form.customJobType} onChange={(e) => setForm({ ...form, customJobType: e.target.value })} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <FormLabel required>Client</FormLabel>
          <FormSelect value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} required>
            <option value="">Select client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </FormSelect>
          <div className="mt-2 flex gap-2">
            <FormInput value={newClientName} onChange={(e) => setNewClientName(e.target.value)} placeholder="Quick add client" />
            <button type="button" onClick={addQuickClient} className="shrink-0 rounded-lg border border-slate-300 px-3 text-sm hover:bg-slate-50">
              Add
            </button>
          </div>
        </div>
        <div>
          <FormLabel required>Managers</FormLabel>
          <select
            multiple
            value={form.managerIds}
            onChange={(e) =>
              setForm({
                ...form,
                managerIds: Array.from(e.target.selectedOptions, (o) => o.value),
              })
            }
            className="h-28 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.firstName} {m.lastName}
              </option>
            ))}
          </select>
          {managers.length === 0 && managerUsers.length > 0 && (
            <p className="mt-2 text-xs text-amber-700">
              No manager roster records found. Add managers from the Managers page, then return here.
            </p>
          )}
          {placeholderManagerCount > 0 && (
            <p className="mt-2 text-xs text-slate-500">
              {placeholderManagerCount} legacy placeholder manager record
              {placeholderManagerCount === 1 ? '' : 's'} hidden from this list (same as iOS).
            </p>
          )}
          <p className="mt-1 text-xs text-slate-500">Hold Cmd/Ctrl to select multiple</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <FormLabel>Address line 1</FormLabel>
          <FormInput value={form.addressLine1} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })} />
        </div>
        <div>
          <FormLabel>Address line 2</FormLabel>
          <FormInput value={form.addressLine2} onChange={(e) => setForm({ ...form, addressLine2: e.target.value })} />
        </div>
        <div>
          <FormLabel>Town / city</FormLabel>
          <FormInput value={form.townCity} onChange={(e) => setForm({ ...form, townCity: e.target.value })} />
        </div>
        <div>
          <FormLabel>Postcode</FormLabel>
          <FormInput value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} />
        </div>
        <div>
          <FormLabel required>Start date</FormLabel>
          <FormInput type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
        </div>
        <div>
          <FormLabel required>End date</FormLabel>
          <FormInput type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required />
        </div>
        <div className="md:col-span-2">
          <FormLabel>Site location pin</FormLabel>
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <button
              type="button"
              onClick={() => setPinPickerOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              Set pin on map
            </button>
            {form.latitude && form.longitude ? (
              <p className="text-xs font-mono text-slate-600">
                Pin: {Number(form.latitude).toFixed(5)}, {Number(form.longitude).toFixed(5)}
              </p>
            ) : (
              <p className="text-xs text-slate-500">No pin set — use the map for an exact location.</p>
            )}
          </div>
        </div>
      </div>

      <SitePinPickerSheet
        open={pinPickerOpen}
        siteName={form.siteName || 'New project'}
        jobNumber={form.jobNumber}
        initial={{
          addressLine1: form.addressLine1,
          addressLine2: form.addressLine2,
          townCity: form.townCity,
          postcode: form.postcode,
          latitude: form.latitude ? Number(form.latitude) : undefined,
          longitude: form.longitude ? Number(form.longitude) : undefined,
        }}
        onClose={() => setPinPickerOpen(false)}
        onSave={(payload) => {
          setForm((current) => ({
            ...current,
            addressLine1: payload.addressLine1,
            addressLine2: payload.addressLine2 || '',
            townCity: payload.townCity,
            postcode: payload.postcode,
            latitude: String(payload.latitude),
            longitude: String(payload.longitude),
          }))
        }}
      />

      <div>
        <FormLabel>Description</FormLabel>
        <FormTextarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={form.isLive} onChange={(e) => setForm({ ...form, isLive: e.target.checked })} />
        Active / live project
      </label>

      <FormActions saving={saving} submitLabel={initial ? 'Save changes' : 'Create project'} cancelHref={backHref} />
    </form>
  )
}
