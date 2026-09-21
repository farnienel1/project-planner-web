/**
 * iOS parity source: Views/MaterialsCatalogueFlow.swift, Core/MaterialCatalogCSV.swift
 * Spec: docs/ios-parity/sections/07-material-catalogue.md
 */
'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CubeIcon } from '@heroicons/react/24/solid'
import type { MaterialCatalogItem, MaterialLengthUnit, MaterialUnit } from '@/types'
import { useAuthStore } from '@/lib/stores/authStore'
import { MATERIAL_UNITS, useMaterialCatalogStore } from '@/lib/stores/materialCatalogStore'
import { canManageMaterialCatalogue } from '@/lib/permissions'
import { consumeCreateQuery } from '@/lib/navigation/createMenu'
import { newUuid } from '@/lib/firebase/firestoreUtils'
import { duplicateKey } from '@/lib/materials/materialCatalogSearch'
import {
  CATALOGUE_CSV_FILENAME,
  CATALOGUE_CSV_MAX_BYTES,
  CATALOGUE_TEMPLATE_FILENAME,
  downloadTextFile,
  exportCatalogueCsv,
  exportCatalogueTemplateCsv,
  parseCatalogueCsv,
} from '@/lib/materials/materialCatalogCSV'
import { EmptyState, IosFormModal, PageHeader } from '@/components/ios/primitives'

const TYPE_HINTS: Record<MaterialUnit, string> = {
  Number: 'Each / piece',
  Length: 'Metres / runs',
  Box: 'Pack of 100',
  Drum: 'Cable drum',
  Pallet: 'Pallet load',
}

const emptyDraft = (): Omit<MaterialCatalogItem, 'createdAt'> => ({
  id: newUuid(),
  name: '',
  brand: '',
  productCode: '',
  defaultUnit: 'Number',
  size: '',
  length: '',
  lengthUnit: undefined,
  category: '',
  createdByUserId: '',
  createdByName: '',
})

export function MaterialCatalogueScreen() {
  const router = useRouter()
  const { user, organization } = useAuthStore()
  const { items, loading, error, loadItems, saveItem, deleteItem, replaceAllItems } = useMaterialCatalogStore()
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState<ReturnType<typeof emptyDraft> | null>(null)
  const [existingId, setExistingId] = useState<string | null>(null)
  const [csvOpen, setCsvOpen] = useState(false)
  const [alert, setAlert] = useState<string | null>(null)
  const canManage = canManageMaterialCatalogue(user)

  useEffect(() => {
    if (user && !canManage) router.replace('/dashboard')
  }, [user, canManage, router])

  useEffect(() => {
    if (!canManage || !user) return
    if (consumeCreateQuery()) {
      setExistingId(null)
      setEditor({
        ...emptyDraft(),
        createdByUserId: user.id,
        createdByName: `${user.firstName} ${user.surname}`.trim() || user.email,
      })
    }
  }, [canManage, user])

  useEffect(() => {
    if (organization?.id) loadItems(organization.id)
  }, [organization?.id, loadItems])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return items.filter((item) => {
      if (!query) return true
      return (
        item.name.toLowerCase().includes(query) ||
        item.brand.toLowerCase().includes(query) ||
        (item.productCode || '').toLowerCase().includes(query)
      )
    })
  }, [items, search])

  const grouped = useMemo(() => {
    const map = new Map<string, MaterialCatalogItem[]>()
    for (const item of [...filtered].sort((a, b) => a.name.localeCompare(b.name))) {
      const key = (item.category || 'Other').trim() || 'Other'
      map.set(key, [...(map.get(key) || []), item])
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])
  const [expanded, setExpanded] = useState<string[]>([])

  useEffect(() => {
    setExpanded(grouped.map(([category]) => category))
  }, [grouped])

  const brands = new Set(items.map((item) => item.brand)).size
  const categories = new Set(items.map((item) => item.category || 'Other')).size
  const addedToday = items.filter((item) => {
    const d = item.createdAt
    const now = new Date()
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
  }).length

  if (!user || !canManage) return null
  if (loading && items.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[#185FA5]" />
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title="Material catalogue"
        actions={
          <div className="flex gap-3">
            <button type="button" onClick={() => setCsvOpen(true)} className="text-[15px] font-semibold text-[#185FA5]">
              CSV
            </button>
            <button
              type="button"
              onClick={() => {
                setExistingId(null)
                setEditor({
                  ...emptyDraft(),
                  createdByUserId: user.id,
                  createdByName: `${user.firstName} ${user.surname}`.trim() || user.email,
                })
              }}
              className="text-[15px] font-semibold text-[#185FA5]"
            >
              Add
            </button>
          </div>
        }
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {alert ? <p className="text-sm text-red-600">{alert}</p> : null}

      <div className="rounded-2xl bg-gradient-to-br from-[#185FA5] to-[#0F4C81] p-5 text-white shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.4px] text-white/80">Catalogue</p>
            <p className="mt-1 text-[28px] font-bold">{items.length} items</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
            <CubeIcon className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <StatTile value={String(brands)} label="Brands" />
          <StatTile value={String(categories)} label="Categories" />
          <StatTile value={String(addedToday)} label="Added today" />
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, brand or code"
          className="mt-4 w-full rounded-xl border-0 px-4 py-2.5 text-[15px] text-ios-ink"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <EmptyState
            icon={<CubeIcon className="h-[60px] w-[60px] text-gray-400" />}
            title="No catalogue items yet"
            subtitle="Add materials manually or update the catalogue from a CSV."
          />
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(([category, rows]) => {
            const open = expanded.includes(category)
            return (
              <div key={category} className="overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.10)]">
                <button
                  type="button"
                  onClick={() =>
                    setExpanded((current) =>
                      current.includes(category) ? current.filter((name) => name !== category) : [...current, category]
                    )
                  }
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                >
                  <span className="text-[11px] font-semibold uppercase tracking-[0.4px] text-ios-muted">{category}</span>
                  <span className="text-[12px] text-ios-muted">
                    {rows.length} item{rows.length === 1 ? '' : 's'}
                  </span>
                </button>
                {open ? (
                  <div className="space-y-2 border-t border-[#E5E5EA] px-3 py-3">
                    {rows.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="flex w-full items-start gap-3 rounded-xl px-2 py-2 text-left hover:bg-slate-50"
                        onClick={() => {
                          setExistingId(item.id)
                          setEditor({ ...item })
                        }}
                      >
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-[#E6F1FB] text-[#185FA5]">
                          <CubeIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[15px] font-medium">{item.name}</p>
                          <p className="text-[13px] text-ios-muted">{item.brand || 'Custom'}</p>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {item.productCode ? (
                              <span className="rounded bg-[#E6F1FB] px-1.5 py-0.5 font-mono text-[11px] font-medium text-[#185FA5]">
                                {item.productCode}
                              </span>
                            ) : null}
                            <span className="rounded bg-[#F2F2F7] px-1.5 py-0.5 text-[11px] font-medium text-ios-muted">
                              {item.defaultUnit}
                            </span>
                            {item.size ? (
                              <span className="rounded bg-[#F2F2F7] px-1.5 py-0.5 text-[11px] text-ios-muted">
                                Size {item.size}
                              </span>
                            ) : null}
                            {item.length ? (
                              <span className="rounded bg-[#F2F2F7] px-1.5 py-0.5 text-[11px] text-ios-muted">
                                {item.length}
                                {item.lengthUnit || ''}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}

      {editor ? (
        <MaterialEditor
          draft={editor}
          isNew={!existingId}
          onCancel={() => setEditor(null)}
          onSave={async (next, force) => {
            if (!organization?.id || !user) return
            const key = duplicateKey(next.name, next.productCode)
            const dup = items.find((item) => item.id !== next.id && duplicateKey(item.name, item.productCode) === key)
            if (dup && !force) {
              const ok = window.confirm(
                `"${next.name}" with code "${next.productCode || ''}" is already in your catalogue. Add anyway?`
              )
              if (!ok) return
            }
            try {
              await saveItem(organization.id, {
                ...next,
                brand: next.brand.trim() || 'Custom',
                category: next.category.trim() || 'Other',
                createdByUserId: next.createdByUserId || user.id,
                createdByName: next.createdByName || `${user.firstName} ${user.surname}`.trim() || user.email,
              })
              setEditor(null)
            } catch {
              setAlert('Could not save material')
            }
          }}
          onDelete={
            existingId
              ? async () => {
                  if (!organization?.id) return
                  if (!window.confirm('Remove from catalogue?')) return
                  try {
                    await deleteItem(organization.id, existingId)
                    setEditor(null)
                  } catch {
                    setAlert('Could not delete material')
                  }
                }
              : undefined
          }
        />
      ) : null}

      {csvOpen ? (
        <CsvSheet
          items={items}
          onClose={() => setCsvOpen(false)}
          onUpdate={async (mode, file) => {
            if (!organization?.id || !user) return
            if (file.size > CATALOGUE_CSV_MAX_BYTES) {
              window.alert('Import error: maximum 5MB.')
              return
            }
            const text = await file.text()
            const parsed = parseCatalogueCsv(text)
            if (parsed.errors.length > 0 && parsed.rows.length === 0) {
              window.alert(parsed.errors[0])
              return
            }
            const actor = { createdByUserId: user.id, createdByName: `${user.firstName} ${user.surname}`.trim() || user.email }
            if (parsed.rows.length === 0) {
              window.alert('That CSV has no materials. The current catalogue was left unchanged.')
              return
            }
            if (mode === 'replace') {
              if (!window.confirm('Replace the entire catalogue with this CSV? Existing items not in the file will be removed.')) return
              await replaceAllItems(
                organization.id,
                parsed.rows.map((row) => ({
                  id: newUuid(),
                  name: row.name,
                  brand: row.brand,
                  productCode: row.productCode,
                  defaultUnit: row.defaultUnit,
                  size: row.size,
                  length: row.length,
                  lengthUnit: row.lengthUnit,
                  category: row.category,
                  ...actor,
                }))
              )
            } else {
              const byId = new Map(items.map((item) => [item.id, item]))
              const keepIds = new Set<string>()
              for (const row of parsed.rows) {
                const existing =
                  (row.id && byId.get(row.id)) ||
                  items.find((item) => duplicateKey(item.name, item.productCode) === duplicateKey(row.name, row.productCode))
                const id = existing?.id || newUuid()
                keepIds.add(id)
                await saveItem(organization.id, {
                  id,
                  name: row.name,
                  brand: row.brand,
                  productCode: row.productCode,
                  defaultUnit: row.defaultUnit,
                  size: row.size,
                  length: row.length,
                  lengthUnit: row.lengthUnit,
                  category: row.category,
                  createdAt: existing?.createdAt,
                  createdByUserId: existing?.createdByUserId || actor.createdByUserId,
                  createdByName: existing?.createdByName || actor.createdByName,
                })
              }
              for (const item of items) {
                if (!keepIds.has(item.id)) await deleteItem(organization.id, item.id)
              }
            }
            setCsvOpen(false)
          }}
        />
      ) : null}
    </div>
  )
}

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-[9px] bg-white/15 px-2 py-1.5">
      <p className="text-[14px] font-medium">{value}</p>
      <p className="text-[10px] text-white/85">{label}</p>
    </div>
  )
}

function MaterialEditor({
  draft,
  isNew,
  onCancel,
  onSave,
  onDelete,
}: {
  draft: Omit<MaterialCatalogItem, 'createdAt'>
  isNew: boolean
  onCancel: () => void
  onSave: (next: Omit<MaterialCatalogItem, 'createdAt'>, force?: boolean) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const [form, setForm] = useState(draft)
  const [saving, setSaving] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try {
      await onSave(form)
    } finally {
      setSaving(false)
    }
  }
  return (
    <IosFormModal
      title={isNew ? 'New material' : 'Edit material'}
      onCancel={onCancel}
      footer={
        <button type="submit" form="material-editor" disabled={!form.name.trim() || saving} className="w-full rounded-xl bg-[#185FA5] py-3 font-semibold text-white disabled:opacity-50">
          Save
        </button>
      }
    >
      <form id="material-editor" onSubmit={submit} className="space-y-3">
        <label className="block text-sm font-medium">
          Name
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" />
        </label>
        <label className="block text-sm font-medium">
          Category
          <input required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Electrical" className="mt-1 w-full rounded-lg border px-3 py-2" />
        </label>
        <label className="block text-sm font-medium">
          Manufacturer / Brand
          <input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" />
        </label>
        <label className="block text-sm font-medium">
          Product code
          <input value={form.productCode || ''} onChange={(e) => setForm({ ...form, productCode: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" />
        </label>
        <p className="text-[11px] font-semibold uppercase text-ios-muted">Default type</p>
        <div className="flex flex-wrap gap-2">
          {MATERIAL_UNITS.map((unit) => (
            <button
              key={unit}
              type="button"
              onClick={() => setForm({ ...form, defaultUnit: unit })}
              className={`rounded-full px-3 py-1.5 text-[13px] font-medium ${
                form.defaultUnit === unit ? 'bg-[#E6F1FB] text-[#185FA5]' : 'bg-[#F2F2F7] text-ios-ink'
              }`}
            >
              {unit}
            </button>
          ))}
        </div>
        <p className="text-[12px] text-ios-muted">{TYPE_HINTS[form.defaultUnit]}</p>
        <label className="block text-sm font-medium">
          Size
          <input value={form.size || ''} onChange={(e) => setForm({ ...form, size: e.target.value })} placeholder="Optional" className="mt-1 w-full rounded-lg border px-3 py-2" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium">
            Length
            <input value={form.length || ''} onChange={(e) => setForm({ ...form, length: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" />
          </label>
          <label className="block text-sm font-medium">
            Length unit
            <select
              value={form.lengthUnit || ''}
              onChange={(e) => setForm({ ...form, lengthUnit: (e.target.value || undefined) as MaterialLengthUnit | undefined })}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            >
              <option value="">—</option>
              <option value="M">M</option>
              <option value="MM">MM</option>
            </select>
          </label>
        </div>
        {onDelete ? (
          <button type="button" onClick={() => void onDelete()} className="text-sm font-semibold text-red-600">
            Remove
          </button>
        ) : null}
      </form>
    </IosFormModal>
  )
}

function CsvSheet({
  items,
  onClose,
  onUpdate,
}: {
  items: MaterialCatalogItem[]
  onClose: () => void
  onUpdate: (mode: 'update' | 'replace', file: File) => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  return (
    <IosFormModal title="Catalogue CSV" onCancel={onClose} width="md">
      <div className="space-y-6 text-sm">
        <section>
          <p className="text-[11px] font-semibold uppercase text-ios-muted">Step 1 · Download</p>
          <button
            type="button"
            className="mt-2 rounded-xl bg-[#185FA5] px-4 py-2 font-semibold text-white"
            onClick={() => downloadTextFile(CATALOGUE_CSV_FILENAME, exportCatalogueCsv(items))}
          >
            Download Material Catalogue
          </button>
          <p className="mt-2 text-amber-800">⚠️ CSV Warning — save the file as csv and not .xls (excel) or .numbers.</p>
          <button
            type="button"
            className="mt-3 text-[#185FA5] font-semibold"
            onClick={() => downloadTextFile(CATALOGUE_TEMPLATE_FILENAME, exportCatalogueTemplateCsv())}
          >
            Download blank template
          </button>
          <p className="text-ios-muted">Headers only — use this to start a brand new list</p>
        </section>
        <section>
          <p className="text-[11px] font-semibold uppercase text-ios-muted">Step 2 · Upload updated catalogue</p>
          <p className="mt-1 text-ios-muted">Use this to upload your updated catalogue</p>
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={busy}
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              setBusy(true)
              try {
                await onUpdate('update', file)
              } finally {
                setBusy(false)
              }
            }}
          />
        </section>
        <section>
          <p className="text-[11px] font-semibold uppercase text-ios-muted">Step 3 · Replace entire catalogue</p>
          <p className="mt-1 text-ios-muted">Use this to upload a brand new catalogue</p>
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={busy}
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              setBusy(true)
              try {
                await onUpdate('replace', file)
              } finally {
                setBusy(false)
              }
            }}
          />
        </section>
        <p className="text-ios-muted">
          Edit on a laptop if you can, then save as .csv and upload here. Leave Catalogue ID blank for brand new rows.
        </p>
        <p className="text-ios-muted">Drop CSV or tap to browse · Max 5MB · 5,000 items</p>
      </div>
    </IosFormModal>
  )
}
