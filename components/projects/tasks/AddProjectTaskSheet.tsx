/**
 * iOS parity source: Views/ProjectDetailView.swift AddProjectTaskView ~L3369
 */
'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  CameraIcon,
  CheckIcon,
  ChevronRightIcon,
  ClipboardDocumentCheckIcon,
  DocumentIcon,
  MagnifyingGlassIcon,
  MinusCircleIcon,
  PaperClipIcon,
  PhotoIcon,
  PlusIcon,
  UserIcon,
  UserGroupIcon,
  UsersIcon,
} from '@heroicons/react/24/solid'
import { useAuthStore } from '@/lib/stores/authStore'
import { useSiteAuditStore } from '@/lib/stores/siteAuditStore'
import { newUuid } from '@/lib/firebase/firestoreUtils'
import { taskAttachmentPath, uploadFile } from '@/lib/firebase/storageUtils'
import { FormInput } from '@/components/forms/FormShell'
import { ErrorBanner } from '@/components/dashboard/PageShell'
import { personDisplayName } from '@/lib/tasks/projectTaskFilters'
import type { Manager, Operative, Project, ProjectTask, ProjectTaskItem, ProjectTaskPriority } from '@/types'

type PeopleRoute = 'managers' | 'operatives' | 'combined'

const PRIORITY_CHIPS: { id: ProjectTaskPriority; label: string }[] = [
  { id: 'Low', label: 'Low' },
  { id: 'Normal', label: 'Medium' },
  { id: 'High', label: 'High' },
  { id: 'Urgent', label: 'Urgent' },
]

function tradeLabel(row: { tradeTypePreset?: string; tradeTypeCustom?: string }): string {
  const custom = (row.tradeTypeCustom || '').trim()
  if (custom) return custom
  return (row.tradeTypePreset || '').trim()
}

function toDateInput(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function AddProjectTaskSheet({
  project,
  people,
  existing,
  onSave,
  onClose,
}: {
  project: Project
  people: { operatives: Operative[]; managers: Manager[] }
  existing?: ProjectTask | null
  onSave: (input: {
    id: string
    title: string
    details?: string
    priority: ProjectTaskPriority
    dueDate: Date
    assignedManagerIds: string[]
    assignedOperativeIds: string[]
    items: ProjectTaskItem[]
    attachedImageURLs: string[]
    attachedFileURL?: string
    attachedFileName?: string
    attachedSiteAuditId?: string
    attachedSiteAuditTitle?: string
  }) => Promise<void>
  onClose: () => void
}) {
  const { organization, user } = useAuthStore()
  const { audits, loadAudits } = useSiteAuditStore()
  const [title, setTitle] = useState(existing?.title || '')
  const [details, setDetails] = useState(existing?.details || '')
  const [checklist, setChecklist] = useState<{ id: string; title: string }[]>(
    (existing?.items || []).map((item) => ({ id: item.id, title: item.title }))
  )
  const [includeSelf, setIncludeSelf] = useState(!existing)
  const [includeManagers, setIncludeManagers] = useState((existing?.assignedManagerIds || []).length > 0)
  const [includeOperatives, setIncludeOperatives] = useState((existing?.assignedOperativeIds || []).length > 0)
  const [selectedManagers, setSelectedManagers] = useState<Set<string>>(
    new Set(existing?.assignedManagerIds || (existing?.assignedManagerId ? [existing.assignedManagerId] : []))
  )
  const [selectedOperatives, setSelectedOperatives] = useState<Set<string>>(
    new Set(existing?.assignedOperativeIds || (existing?.assignedOperativeId ? [existing.assignedOperativeId] : []))
  )
  const [peopleRoute, setPeopleRoute] = useState<PeopleRoute | null>(null)
  const [priority, setPriority] = useState<ProjectTaskPriority>(existing?.priority || 'Normal')
  const [dueDate, setDueDate] = useState(existing?.dueDate ? toDateInput(existing.dueDate) : toDateInput(new Date()))
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [docFile, setDocFile] = useState<File | null>(null)
  const [siteAuditId, setSiteAuditId] = useState(existing?.attachedSiteAuditId || '')
  const [showAuditPicker, setShowAuditPicker] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (organization?.id) loadAudits(organization.id)
  }, [organization, loadAudits])

  const projectAudits = useMemo(
    () => audits.filter((audit) => audit.projectId.toLowerCase() === project.id.toLowerCase()),
    [audits, project.id]
  )

  const selfManagerId = people.managers.find(
    (row) => row.email.trim().toLowerCase() === user?.email.trim().toLowerCase()
  )?.id
  const selfOperativeId = people.operatives.find(
    (row) => row.email.trim().toLowerCase() === user?.email.trim().toLowerCase()
  )?.id

  const assignment = useMemo(() => {
    const managers = new Set<string>()
    const operatives = new Set<string>()
    if (includeManagers) selectedManagers.forEach((id) => managers.add(id))
    if (includeOperatives) selectedOperatives.forEach((id) => operatives.add(id))
    if (includeSelf) {
      if (selfManagerId) managers.add(selfManagerId)
      if (selfOperativeId) operatives.add(selfOperativeId)
    }
    return { managers: [...managers], operatives: [...operatives] }
  }, [
    includeManagers,
    includeOperatives,
    includeSelf,
    selectedManagers,
    selectedOperatives,
    selfManagerId,
    selfOperativeId,
  ])

  const canSave = Boolean(title.trim() && (assignment.managers.length || assignment.operatives.length) && dueDate && !saving)

  const openPicker = () => {
    if (includeManagers && includeOperatives) setPeopleRoute('combined')
    else if (includeManagers) setPeopleRoute('managers')
    else if (includeOperatives) setPeopleRoute('operatives')
  }

  const pickerSubtitle = () => {
    const m = selectedManagers.size
    const o = selectedOperatives.size
    if (includeManagers && includeOperatives) {
      return m === 0 && o === 0
        ? 'Click to choose people — search and trade filters inside'
        : `${m} manager(s), ${o} operative(s)`
    }
    if (includeManagers) return m === 0 ? 'Click to choose — tick names to build your list' : `${m} manager(s) selected`
    return o === 0 ? 'Click to choose — tick names to build your list' : `${o} operative(s) selected`
  }

  const handleSave = async () => {
    if (!canSave || !organization?.id) return
    setSaving(true)
    setError(null)
    try {
      const taskId = existing?.id || newUuid()
      const attachedImageURLs = [...(existing?.attachedImageURLs || [])]
      for (const file of imageFiles) {
        const url = await uploadFile(taskAttachmentPath(organization.id, taskId, file.name), file, file.type || 'image/jpeg')
        attachedImageURLs.push(url)
      }
      let attachedFileURL = existing?.attachedFileURL
      let attachedFileName = existing?.attachedFileName
      if (docFile) {
        attachedFileURL = await uploadFile(
          taskAttachmentPath(organization.id, taskId, docFile.name),
          docFile,
          docFile.type || 'application/octet-stream'
        )
        attachedFileName = docFile.name
      }
      const audit = projectAudits.find((row) => row.id === siteAuditId)
      await onSave({
        id: taskId,
        title: title.trim(),
        details: details.trim() || undefined,
        priority,
        dueDate: new Date(`${dueDate}T00:00:00`),
        assignedManagerIds: assignment.managers,
        assignedOperativeIds: assignment.operatives,
        items: checklist
          .map((item) => ({ id: item.id, title: item.title.trim() }))
          .filter((item) => item.title),
        attachedImageURLs,
        attachedFileURL,
        attachedFileName,
        attachedSiteAuditId: audit?.id,
        attachedSiteAuditTitle: audit ? audit.customTitle || audit.type : undefined,
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save task')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="flex h-[96vh] w-full max-w-2xl flex-col overflow-hidden bg-[var(--bg)] shadow-xl sm:h-auto sm:max-h-[92vh] sm:rounded-2xl">
        <header className="flex items-center justify-between border-b border-[#EEF0F3] bg-[var(--bg)] px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[#EEF0F3] bg-white px-3.5 py-1.5 text-[13px] font-medium text-slate-900"
          >
            Cancel
          </button>
          <p className="text-sm font-semibold text-slate-900">{existing ? 'Edit task' : 'New task'}</p>
          <span className="w-16" />
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-[18px] py-3 pb-6">
          {error && <ErrorBanner message={error} />}
          <div className="flex items-center gap-3.5 rounded-[18px] border border-[#EEF0F3] bg-white px-[18px] py-4">
            <div className="relative flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-gradient-to-br from-[#185FA5] to-[#378ADD] text-white">
              <ClipboardDocumentCheckIcon className="h-6 w-6" />
              <span className="absolute -bottom-1 -right-1 flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-[#F7F8FA] bg-white text-[var(--blue)]">
                <PlusIcon className="h-3 w-3" />
              </span>
            </div>
            <div>
              <p className="text-[16px] font-medium tracking-tight text-[#0B1020]">Create a new task</p>
              <p className="text-xs text-[#6B7280]">Assign to a manager or operative</p>
            </div>
          </div>

          <SectionHeader title="Task" required />
          <div className="space-y-2.5 rounded-2xl border border-[#EEF0F3] bg-white p-3.5">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title…"
              className="w-full bg-transparent text-[15px] font-medium text-[#0B1020] outline-none"
            />
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Add a description (optional)"
              rows={3}
              className="w-full resize-none bg-transparent text-xs text-[#0B1020] outline-none"
            />
          </div>
          <p className="px-1 text-[10px] text-[#6B7280]">
            Tip: Keep titles short and action-led — &quot;Replace fuse board&quot; not &quot;Some work to do&quot;.
          </p>

          <SectionHeader title="Checklist" subtitle="Optional" />
          <div className="rounded-2xl border border-[#EEF0F3] bg-white px-3.5">
            {checklist.map((item) => (
              <div key={item.id} className="flex items-center gap-3 border-b border-[#EEF0F3] py-2.5 last:border-0">
                <span className="h-[18px] w-[18px] rounded-[5px] border-[1.5px] border-[#C5C9D2]" />
                <input
                  value={item.title}
                  onChange={(e) =>
                    setChecklist((prev) => prev.map((row) => (row.id === item.id ? { ...row, title: e.target.value } : row)))
                  }
                  placeholder="Checklist item"
                  className="flex-1 bg-transparent text-[13px] outline-none"
                />
                <button
                  type="button"
                  onClick={() => setChecklist((prev) => prev.filter((row) => row.id !== item.id))}
                  className="text-[#C5C9D2]"
                  aria-label="Remove checklist item"
                >
                  <MinusCircleIcon className="h-[18px] w-[18px]" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setChecklist((prev) => [...prev, { id: newUuid(), title: '' }])}
              className="flex w-full items-center gap-3 py-2.5 text-[13px] font-medium text-[var(--blue)]"
            >
              <span className="flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border-[1.5px] border-dashed border-[#C5C9D2]">
                <PlusIcon className="h-3 w-3 text-[#C5C9D2]" />
              </span>
              Add checklist item
            </button>
          </div>
          <p className="px-1 text-[10px] text-[#6B7280]">Assignees must tick all items to complete the task.</p>

          <SectionHeader title="Assign to" required />
          <div className="grid grid-cols-3 gap-2">
            <AssignPill title="Myself" on={includeSelf} onToggle={() => setIncludeSelf((v) => !v)} icon={<UserIcon className="h-4 w-4" />} />
            <AssignPill
              title="Manager"
              on={includeManagers}
              onToggle={() => setIncludeManagers((v) => !v)}
              icon={<UserIcon className="h-4 w-4" />}
            />
            <AssignPill
              title="Operatives"
              on={includeOperatives}
              onToggle={() => setIncludeOperatives((v) => !v)}
              icon={<UsersIcon className="h-4 w-4" />}
            />
          </div>
          {(includeManagers || includeOperatives) && (
            <button
              type="button"
              onClick={openPicker}
              className="flex w-full items-center gap-3 rounded-2xl border border-[#EEF0F3] bg-white p-3.5 text-left"
            >
              <span className="flex h-[34px] w-[34px] items-center justify-center rounded-lg bg-[var(--blue-t)] text-[var(--blue)]">
                <UserGroupIcon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-[#0B1020]">
                  {includeManagers && includeOperatives
                    ? 'Managers & operatives'
                    : includeManagers
                      ? 'Select managers'
                      : 'Select operatives'}
                </span>
                <span className="block text-xs text-[#6B7280]">{pickerSubtitle()}</span>
              </span>
              <ChevronRightIcon className="h-4 w-4 text-[#C5C9D2]" />
            </button>
          )}
          <p className="px-1 text-[10px] text-[#6B7280]">
            {assignment.managers.length || assignment.operatives.length
              ? 'You can assign managers and operatives together. Open the picker to search, filter by trade, and tick people.'
              : 'Use Myself if you have a manager or operative profile, or enable Manager / Operative and pick people.'}
          </p>

          <SectionHeader title="Priority" />
          <div className="grid grid-cols-2 gap-2">
            {PRIORITY_CHIPS.map((chip) => {
              const selected = priority === chip.id
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setPriority(chip.id)}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-medium ${
                    selected && chip.id === 'Normal'
                      ? 'border-[#854F0B] bg-[#FAEEDA] text-[#854F0B]'
                      : selected
                        ? 'border-[var(--blue)] bg-white text-[#0B1020]'
                        : 'border-[#EEF0F3] bg-white text-[#6B7280]'
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      chip.id === 'Low'
                        ? 'bg-[#6B7280]'
                        : chip.id === 'Normal'
                          ? 'bg-[#854F0B]'
                          : chip.id === 'High'
                            ? 'bg-[#A32D2D]'
                            : 'bg-[#781414]'
                    }`}
                  />
                  {chip.label}
                </button>
              )
            })}
          </div>

          <SectionHeader title="Schedule" subtitle="Required" />
          <div className="rounded-2xl border border-[#EEF0F3] bg-white p-3.5">
            <FormInput type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <p className="px-1 text-[10px] text-[#6B7280]">Every task must have a due date.</p>

          <SectionHeader title="Attachments" subtitle="Optional" />
          <div className="grid grid-cols-4 gap-2">
            <label className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-[#EEF0F3] bg-white py-3 text-[10px] text-slate-600">
              <PhotoIcon className="h-5 w-5 text-[#0F6E56]" />
              Photos
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => setImageFiles(Array.from(e.target.files || []))}
              />
            </label>
            <label className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-[#EEF0F3] bg-white py-3 text-[10px] text-slate-600">
              <CameraIcon className="h-5 w-5 text-[#534AB7]" />
              Camera
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => setImageFiles((prev) => [...prev, ...Array.from(e.target.files || [])])}
              />
            </label>
            <label className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-[#EEF0F3] bg-white py-3 text-[10px] text-slate-600">
              <DocumentIcon className="h-5 w-5 text-[var(--blue)]" />
              File
              <input
                type="file"
                className="hidden"
                onChange={(e) => setDocFile(e.target.files?.[0] || null)}
              />
            </label>
            <button
              type="button"
              onClick={() => setShowAuditPicker(true)}
              className="flex flex-col items-center gap-1 rounded-xl border border-[#EEF0F3] bg-white py-3 text-[10px] text-slate-600"
            >
              <PaperClipIcon className="h-5 w-5 text-[var(--blue)]" />
              Site audit
            </button>
          </div>
          <p className="text-center text-[10px] text-[#6B7280]">Files up to 10MB. Photos, PDFs, drawings supported.</p>
          {imageFiles.length > 0 && (
            <p className="text-xs text-slate-600">{imageFiles.length} photo{imageFiles.length === 1 ? '' : 's'} selected</p>
          )}
          {docFile && <p className="text-xs text-slate-600">{docFile.name}</p>}
          {siteAuditId && (
            <p className="text-xs text-slate-600">
              Audit: {projectAudits.find((row) => row.id === siteAuditId)?.customTitle || projectAudits.find((row) => row.id === siteAuditId)?.type}
            </p>
          )}
        </div>

        <div className="border-t border-[#EEF0F3] bg-white px-4 py-3">
          <button
            type="button"
            disabled={!canSave}
            onClick={() => void handleSave()}
            className="w-full rounded-xl bg-[var(--blue)] py-3 text-sm font-semibold text-white disabled:bg-[#C5C9D2]"
          >
            {saving ? 'Saving…' : existing ? 'Save task' : canSave ? 'Create task' : 'Add a title and assignee to continue'}
          </button>
        </div>
      </div>

      {peopleRoute && (
        <PeoplePicker
          route={peopleRoute}
          managers={people.managers.filter((row) => row.isActive !== false)}
          operatives={people.operatives.filter((row) => row.isActive !== false)}
          selectedManagers={selectedManagers}
          selectedOperatives={selectedOperatives}
          onChangeManagers={setSelectedManagers}
          onChangeOperatives={setSelectedOperatives}
          onClose={() => setPeopleRoute(null)}
        />
      )}

      {showAuditPicker && (
        <div className="absolute inset-0 z-[80] flex items-end justify-center bg-black/30 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">Attach site audit</p>
            <div className="mt-3 max-h-64 space-y-1 overflow-y-auto">
              {projectAudits.length === 0 && <p className="text-sm text-slate-500">No site audits for this job.</p>}
              {projectAudits.map((audit) => (
                <button
                  key={audit.id}
                  type="button"
                  onClick={() => {
                    setSiteAuditId(audit.id)
                    setShowAuditPicker(false)
                  }}
                  className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-50"
                >
                  {audit.customTitle || audit.type}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setShowAuditPicker(false)} className="mt-3 text-sm text-slate-500">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function SectionHeader({ title, required, subtitle }: { title: string; required?: boolean; subtitle?: string }) {
  return (
    <div className="flex items-baseline gap-2 px-1">
      <p className="text-[11px] font-medium uppercase tracking-[0.4px] text-[#6B7280]">{title}</p>
      {required && (
        <span className="rounded-full bg-[#FCEBEB] px-1.5 py-px text-[9px] font-medium text-[#A32D2D]">REQUIRED</span>
      )}
      {subtitle && <span className="text-[11px] text-[#C5C9D2]">· {subtitle}</span>}
    </div>
  )
}

function AssignPill({
  title,
  on,
  onToggle,
  icon,
}: {
  title: string
  on: boolean
  onToggle: () => void
  icon: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-[14px] border py-2.5 ${
        on ? 'border-[var(--blue)] bg-[var(--blue-t)] text-[var(--blue)]' : 'border-[#EEF0F3] bg-white text-[#6B7280]'
      }`}
    >
      {icon}
      <span className={`text-[11px] font-medium ${on ? 'text-[var(--blue)]' : 'text-[#0B1020]'}`}>{title}</span>
    </button>
  )
}

function PeoplePicker({
  route,
  managers,
  operatives,
  selectedManagers,
  selectedOperatives,
  onChangeManagers,
  onChangeOperatives,
  onClose,
}: {
  route: PeopleRoute
  managers: Manager[]
  operatives: Operative[]
  selectedManagers: Set<string>
  selectedOperatives: Set<string>
  onChangeManagers: (next: Set<string>) => void
  onChangeOperatives: (next: Set<string>) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const [trade, setTrade] = useState('')
  const q = search.trim().toLowerCase()
  const showManagers = route !== 'operatives'
  const showOperatives = route !== 'managers'
  const trades = [
    ...new Set(
      [...(showManagers ? managers : []), ...(showOperatives ? operatives : [])]
        .map(tradeLabel)
        .filter(Boolean)
    ),
  ]
  const match = (row: { firstName: string; lastName: string; email: string; tradeTypePreset?: string; tradeTypeCustom?: string }) => {
    const name = personDisplayName(row).toLowerCase()
    if (q && !name.includes(q) && !row.email.toLowerCase().includes(q)) return false
    if (trade && tradeLabel(row) !== trade) return false
    return true
  }

  return (
    <div className="absolute inset-0 z-[80] flex items-end justify-center bg-black/30 p-4 sm:items-center">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white">
        <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <button type="button" onClick={onClose} className="text-sm text-[var(--blue)]">
            Done
          </button>
          <p className="text-sm font-semibold">
            {route === 'managers' ? 'Select managers' : route === 'operatives' ? 'Select operatives' : 'Managers & operatives'}
          </p>
          <span className="w-10" />
        </header>
        <div className="space-y-2 p-3">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
            <MagnifyingGlassIcon className="h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="w-full text-sm outline-none"
            />
          </div>
          {trades.length > 0 && (
            <select
              value={trade}
              onChange={(e) => setTrade(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">All trades</option>
              {trades.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          {showManagers &&
            managers.filter(match).map((row) => {
              const on = selectedManagers.has(row.id)
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => {
                    const next = new Set(selectedManagers)
                    if (on) next.delete(row.id)
                    else next.add(row.id)
                    onChangeManagers(next)
                  }}
                  className="flex w-full items-center justify-between border-b border-slate-50 px-1 py-2.5 text-left"
                >
                  <span>
                    <span className="block text-sm font-medium">{personDisplayName(row)}</span>
                    <span className="text-[11px] text-slate-500">{tradeLabel(row) || 'Manager'}</span>
                  </span>
                  {on && <CheckIcon className="h-4 w-4 text-[var(--blue)]" />}
                </button>
              )
            })}
          {showOperatives &&
            operatives.filter(match).map((row) => {
              const on = selectedOperatives.has(row.id)
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => {
                    const next = new Set(selectedOperatives)
                    if (on) next.delete(row.id)
                    else next.add(row.id)
                    onChangeOperatives(next)
                  }}
                  className="flex w-full items-center justify-between border-b border-slate-50 px-1 py-2.5 text-left"
                >
                  <span>
                    <span className="block text-sm font-medium">{personDisplayName(row)}</span>
                    <span className="text-[11px] text-slate-500">{tradeLabel(row) || 'Operative'}</span>
                  </span>
                  {on && <CheckIcon className="h-4 w-4 text-[var(--blue)]" />}
                </button>
              )
            })}
        </div>
      </div>
    </div>
  )
}
