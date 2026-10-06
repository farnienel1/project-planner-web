'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { useProjectStore } from '@/lib/stores/projectStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import type { Project } from '@/types'
import { DEFAULT_JOB_TYPES } from '@/types'
import { collectionJobTypeForName, recoverJobTypesFromWork } from '@/lib/jobTypes/jobTypesStorage'
import { addLondonDays, dateFromDayKey, dayKey } from '@/lib/ios-parity/londonTime'
import type { ProjectSaveInput } from '@/lib/firebase/projectPayload'
import {
  countFilledProjectCreateFields,
  emptyProjectCreateIdentity,
} from '@/lib/projects/projectCreateRules'
import { FormActions, FormInput, FormLabel, FormSelect, FormTextarea } from '@/components/forms/FormShell'
import { ErrorBanner } from '@/components/dashboard/PageShell'
import { SitePinPickerSheet } from '@/components/site-map/SitePinPickerSheet'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { getManagerUsers, matchesRosterSegment } from '@/lib/staff/userRosterUtils'

type ProjectFormProps = {
  initial?: Project | null
  collection?: 'projects' | 'smallWorks'
  backHref: string
  onSaved: (id: string) => void
}

type ManagerOption = {
  id: string
  label: string
  userId?: string
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function userManagerOptionId(userId: string): string {
  return `user:${userId}`
}

function defaultProjectStart(): string {
  return dayKey(new Date())
}

function defaultProjectEnd(): string {
  return dayKey(addLondonDays(new Date(), 30))
}

export function ProjectForm({ initial, collection = 'projects', backHref, onSaved }: ProjectFormProps) {
  const { organization } = useAuthStore()
  const { clients, loadClients, saveProject, createClient } = useProjectStore()
  const { managers, placeholderManagerCount, loadManagers, saveManager } = useOperativeStore()
  const { users, loadUsers } = useOrgUserStore()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [managerFieldError, setManagerFieldError] = useState(false)
  const [pinPickerOpen, setPinPickerOpen] = useState(false)
  const [newClientName, setNewClientName] = useState('')
  const managersFieldRef = useRef<HTMLDivElement>(null)

  const [jobTypes, setJobTypes] = useState<string[]>([...DEFAULT_JOB_TYPES])
  const blankIdentity = emptyProjectCreateIdentity()
  const [form, setForm] = useState({
    jobNumber: initial?.jobNumber || blankIdentity.jobNumber,
    siteName: initial?.siteName || blankIdentity.siteName,
    addressLine1: initial?.addressLine1 || '',
    addressLine2: initial?.addressLine2 || '',
    townCity: initial?.townCity || '',
    postcode: initial?.postcode || '',
    clientId: initial?.client?.id || '',
    startDate: initial?.startDate ? dayKey(new Date(initial.startDate)) : defaultProjectStart(),
    endDate: initial?.endDate ? dayKey(new Date(initial.endDate)) : defaultProjectEnd(),
    jobType: initial
      ? collectionJobTypeForName(initial.customJobType || initial.jobType || 'CAT A', collection)
      : '',
    customJobType: initial ? initial.customJobType || initial.jobType || '' : '',
    managerIds: initial?.managerIds?.length ? initial.managerIds : initial?.managerId ? [initial.managerId] : [],
    description: initial?.description || '',
    notes: initial?.notes || '',
    isLive: initial?.isLive !== false,
    latitude: initial?.latitude?.toString() || '',
    longitude: initial?.longitude?.toString() || '',
    useMapPin:
      initial?.usesMapPinForLocation === true ||
      (initial?.usesMapPinForLocation !== false && initial?.latitude != null && initial?.longitude != null),
  })

  useEffect(() => {
    if (organization?.id) {
      loadClients(organization.id)
      loadManagers(organization.id)
      loadUsers(organization.id)
      recoverJobTypesFromWork(organization.id)
        .then((recovered) => {
          const names = [...recovered]
          if (initial?.customJobType && !names.includes(initial.customJobType)) {
            names.push(initial.customJobType)
          }
          if (initial?.jobType && !names.includes(initial.jobType)) names.push(initial.jobType)
          setJobTypes(names.sort((a, b) => a.localeCompare(b)))
        })
        .catch(() => {})
    }
  }, [organization, loadClients, loadManagers, loadUsers])

  const managerUsers = useMemo(() => getManagerUsers(users), [users])

  const managerOptions = useMemo(() => {
    const options: ManagerOption[] = []
    const seenEmails = new Set<string>()

    for (const manager of managers) {
      const email = normalizeEmail(manager.email)
      if (email) seenEmails.add(email)
      options.push({
        id: manager.id,
        label: `${manager.firstName} ${manager.lastName}`.trim() || manager.email,
      })
    }

    for (const managerUser of managerUsers) {
      if (!matchesRosterSegment(managerUser, 'active')) continue
      const email = normalizeEmail(managerUser.email)
      if (email && seenEmails.has(email)) continue
      options.push({
        id: userManagerOptionId(managerUser.id),
        label: `${managerUser.firstName} ${managerUser.surname}`.trim() || managerUser.email,
        userId: managerUser.id,
      })
    }

    return options.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
  }, [managers, managerUsers])

  const setAddressField = (patch: Partial<Pick<typeof form, 'addressLine1' | 'addressLine2' | 'townCity' | 'postcode'>>) => {
    setForm((current) => ({
      ...current,
      ...patch,
      latitude: '',
      longitude: '',
      useMapPin: false,
    }))
  }

  const scrollToFirstError = () => {
    managersFieldRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const resolveManagerIds = async (): Promise<string[]> => {
    if (!organization?.id) return []
    const resolved: string[] = []

    for (const selectedId of form.managerIds) {
      if (!selectedId.startsWith('user:')) {
        resolved.push(selectedId)
        continue
      }

      const userId = selectedId.slice('user:'.length)
      const managerUser = managerUsers.find((entry) => entry.id === userId)
      if (!managerUser) continue

      const email = normalizeEmail(managerUser.email)
      const existing = managers.find((entry) => normalizeEmail(entry.email) === email)
      if (existing) {
        resolved.push(existing.id)
        continue
      }

      const rosterId = await saveManager(organization.id, {
        id: '',
        firstName: managerUser.firstName,
        lastName: managerUser.surname,
        email: managerUser.email,
        phone: managerUser.mobileNumber,
        isActive: true,
        organizationId: organization.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      resolved.push(rosterId)
    }

    return resolved
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!organization?.id) return
    setError(null)
    setManagerFieldError(false)

    const creating = !initial
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      setError('End date must be on or after start date.')
      return
    }
    const hasAddress = Boolean(form.addressLine1.trim() && form.townCity.trim() && form.postcode.trim())
    const hasPin = Boolean(form.useMapPin && form.latitude && form.longitude)
    if (creating) {
      const filled = countFilledProjectCreateFields(form)
      const othersReady = Boolean(form.jobNumber.trim() && form.siteName.trim() && (hasAddress || hasPin))
      if (!form.clientId && othersReady && form.managerIds.length > 0) {
        setError('Please select a client')
        return
      }
      if (form.managerIds.length === 0 && othersReady && form.clientId) {
        setError('Please assign at least one manager')
        setManagerFieldError(true)
        scrollToFirstError()
        return
      }
      if (filled < 7) {
        setError('Fill the 7 required fields to continue')
        return
      }
    }
    if (!form.clientId) {
      setError('Please select a client')
      return
    }
    if (!creating && !hasAddress && !hasPin) {
      setError('Enter an address or drop a map pin.')
      return
    }
    const client = clients.find((c) => c.id === form.clientId)
    if (!client) {
      setError('Please select a client')
      return
    }

    setSaving(true)
    try {
      const resolvedManagerIds = await resolveManagerIds()
      if (creating && resolvedManagerIds.length === 0) {
        setError('Please assign at least one manager')
        setManagerFieldError(true)
        scrollToFirstError()
        return
      }

      const primaryManagerId = resolvedManagerIds[0]
      const primaryManager = managers.find((m) => m.id === primaryManagerId)
      const primaryUser = managerUsers.find((u) => userManagerOptionId(u.id) === form.managerIds[0])

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
        startDate: dateFromDayKey(form.startDate),
        endDate: dateFromDayKey(form.endDate),
        jobType: form.jobType.trim()
          ? form.jobType
          : collection === 'smallWorks'
            ? 'Small Works'
            : 'CAT A',
        customJobType: form.customJobType.trim() && form.customJobType.trim() !== 'CAT A' ? form.customJobType.trim() : undefined,
        managerId: primaryManagerId,
        managerIds: resolvedManagerIds,
        managerLegacy: primaryManager
          ? `${primaryManager.firstName} ${primaryManager.lastName}`.trim()
          : primaryUser
            ? `${primaryUser.firstName} ${primaryUser.surname}`.trim()
            : initial?.manager?.name && initial.manager.name.trim().toLowerCase() !== 'custom'
              ? initial.manager.name
              : undefined,
        isLive: creating ? true : form.isLive,
        hiddenManagerUserIds: initial?.hiddenManagerUserIds,
        hiddenOperativeUserIds: initial?.hiddenOperativeUserIds,
        description: form.description,
        notes: form.notes,
        latitude: form.useMapPin && form.latitude ? Number(form.latitude) : undefined,
        longitude: form.useMapPin && form.longitude ? Number(form.longitude) : undefined,
        usesMapPinForLocation: Boolean(form.useMapPin && form.latitude && form.longitude),
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
    <form onSubmit={handleSubmit} noValidate className="card pad stack">
      {error && <ErrorBanner message={error} />}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <FormLabel required>Project reference</FormLabel>
          <FormInput value={form.jobNumber} placeholder="e.g. C646" onChange={(e) => setForm({ ...form, jobNumber: e.target.value })} required />
        </div>
        <div>
          <FormLabel required>Site name</FormLabel>
          <FormInput value={form.siteName} placeholder="e.g. Lancelot Place" onChange={(e) => setForm({ ...form, siteName: e.target.value })} required />
        </div>
        <div>
          <FormLabel>{!initial ? 'Job type · Optional' : 'Job type'}</FormLabel>
          <FormSelect
            value={form.customJobType || form.jobType}
            onChange={(e) => {
              const name = e.target.value
              setForm({
                ...form,
                customJobType: name,
                jobType: name ? collectionJobTypeForName(name, collection) : '',
              })
            }}
          >
            {!initial ? <option value="">Select job type</option> : null}
            {jobTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
            {(form.customJobType || form.jobType) &&
            !jobTypes.includes(form.customJobType || form.jobType) ? (
              <option value={form.customJobType || form.jobType}>{form.customJobType || form.jobType}</option>
            ) : null}
          </FormSelect>
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
        <div ref={managersFieldRef}>
          <FormLabel required>Managers</FormLabel>
          <select
            multiple
            value={form.managerIds}
            onChange={(e) => {
              setManagerFieldError(false)
              setForm({
                ...form,
                managerIds: Array.from(e.target.selectedOptions, (o) => o.value),
              })
            }}
            className={`h-28 w-full rounded-lg border px-3 py-2 text-sm ${
              managerFieldError ? 'border-red-400 bg-red-50 ring-2 ring-red-200' : 'border-slate-300'
            }`}
            aria-invalid={managerFieldError}
            aria-describedby={managerFieldError ? 'managers-error' : undefined}
          >
            {managerOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          {managerFieldError && (
            <p id="managers-error" className="mt-2 text-xs font-semibold text-red-700">
              Please assign at least one manager
            </p>
          )}
          {managerOptions.length === 0 && (
            <p className="mt-2 text-xs text-amber-700">
              No managers found. Invite managers from Manage users, then return here.
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
          <FormLabel required={!initial}>Address line 1</FormLabel>
          <FormInput value={form.addressLine1} onChange={(e) => setAddressField({ addressLine1: e.target.value })} />
        </div>
        <div>
          <FormLabel>{!initial ? 'Address line 2 · Optional' : 'Address line 2'}</FormLabel>
          <FormInput value={form.addressLine2} onChange={(e) => setAddressField({ addressLine2: e.target.value })} />
        </div>
        <div>
          <FormLabel required={!initial}>Town / City</FormLabel>
          <FormInput value={form.townCity} onChange={(e) => setAddressField({ townCity: e.target.value })} />
        </div>
        <div>
          <FormLabel required={!initial}>Postcode</FormLabel>
          <FormInput value={form.postcode} onChange={(e) => setAddressField({ postcode: e.target.value })} />
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
          <FormLabel>Site location</FormLabel>
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setForm((current) => ({ ...current, useMapPin: false, latitude: '', longitude: '' }))}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                  form.useMapPin ? 'border border-slate-200 bg-white text-slate-600' : 'bg-slate-900 text-white'
                }`}
              >
                Address
              </button>
              <button
                type="button"
                onClick={() => {
                  setForm((current) => ({ ...current, useMapPin: true }))
                  setPinPickerOpen(true)
                }}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                  form.useMapPin ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600'
                }`}
              >
                Map pin
              </button>
            </div>
            {form.useMapPin ? (
              <div className="flex flex-wrap items-center gap-3">
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
                  <p className="text-xs text-slate-500">Drop a pin for the exact site.</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500">The location map follows this address.</p>
            )}
          </div>
        </div>
      </div>

      <SitePinPickerSheet
        open={pinPickerOpen}
        siteName={form.siteName || (collection === 'smallWorks' ? 'New small works' : 'New project')}
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
            useMapPin: true,
          }))
        }}
      />

      <div>
        <FormLabel>Description</FormLabel>
        <FormTextarea
          rows={3}
          value={form.description}
          placeholder={
            collection === 'smallWorks'
              ? 'Add notes, scope, key contacts or anything else the team should know about this small works job…'
              : 'Add notes, scope, key contacts or anything else the team should know about this project…'
          }
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </div>

      {initial ? (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={form.isLive} onChange={(e) => setForm({ ...form, isLive: e.target.checked })} />
          Active / live project
        </label>
      ) : null}

      <FormActions
        saving={saving}
        submitLabel={initial ? 'Save' : collection === 'smallWorks' ? 'Create small works' : 'Create project'}
        cancelHref={backHref}
      />
      {!initial && countFilledProjectCreateFields(form) < 7 ? (
        <p className="muted small">Fill the 7 required fields to continue</p>
      ) : null}
    </form>
  )
}
