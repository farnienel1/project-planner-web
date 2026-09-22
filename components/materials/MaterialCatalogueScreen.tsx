/**
 * iOS parity source: Views/MaterialsCatalogueFlow.swift, Core/MaterialCatalogCSV.swift
 * Spec: docs/ios-parity/sections/07-material-catalogue.md
 */
'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
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
import { MATERIAL_CATEGORY_SUGGESTIONS } from '@/lib/materials/materialCategorySuggestions'

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
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[var(--blue)]" />
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title="Material catalogue"
        subtitle="Items you order for site"
        hue="ts"
        actions={
          <div className="flex gap-3">
            <button type="button" onClick={() => setCsvOpen(true)} className="btn">
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
              className="btn primary"
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
          className="mt-4 w-full rounded-xl border-0 px-4 py-2.5 text-[15px] text-[var(--ink)]"
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
                  <span className="text-[11px] font-semibold uppercase tracking-[0.4px] text-[var(--ink3)]">{category}</span>
                  <span className="text-[12px] text-[var(--ink3)]">
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
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-[var(--blue-t)] text-[var(--blue)]">
                          <CubeIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[15px] font-medium">{item.name}</p>
                          <p className="text-[13px] text-[var(--ink3)]">{item.brand || 'Custom'}</p>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {item.productCode ? (
                              <span className="rounded bg-[var(--blue-t)] px-1.5 py-0.5 font-mono text-[11px] font-medium text-[var(--blue)]">
                                {item.productCode}
                              </span>
                            ) : null}
                            <span className="rounded bg-[var(--soft)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--ink3)]">
                              {item.defaultUnit}
                            </span>
                            {item.size ? (
                              <span className="rounded bg-[var(--soft)] px-1.5 py-0.5 text-[11px] text-[var(--ink3)]">
                                Size {item.size}
                              </span>
                            ) : null}
                            {item.length ? (
                              <span className="rounded bg-[var(--soft)] px-1.5 py-0.5 text-[11px] text-[var(--ink3)]">
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
        <button type="submit" form="material-editor" disabled={!form.name.trim() || saving} className="w-full rounded-xl bg-[var(--blue)] py-3 font-semibold text-white disabled:opacity-50">
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
        <p className="text-[11px] font-semibold uppercase text-[var(--ink3)]">Default type</p>
        <div className="flex flex-wrap gap-2">
          {MATERIAL_UNITS.map((unit) => (
            <button
              key={unit}
              type="button"
              onClick={() => setForm({ ...form, defaultUnit: unit })}
              className={`rounded-full px-3 py-1.5 text-[13px] font-medium ${
                form.defaultUnit === unit ? 'bg-[var(--blue-t)] text-[var(--blue)]' : 'bg-[var(--soft)] text-[var(--ink)]'
              }`}
            >
              {unit}
            </button>
          ))}
        </div>
        <p className="text-[12px] text-[var(--ink3)]">{TYPE_HINTS[form.defaultUnit]}</p>
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
  const [replacePrompt, setReplacePrompt] = useState(false)
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const updateInputRef = useRef<HTMLInputElement>(null)
  const replaceInputRef = useRef<HTMLInputElement>(null)
  const downloadBtn =
    'mt-2 flex h-11 w-full max-w-[320px] items-center justify-center rounded-xl px-4 text-[14.5px] font-semibold'

  const pickFile = async (mode: 'update' | 'replace', file: File | undefined, input: HTMLInputElement | null) => {
    if (!file) return
    setBusy(true)
    try {
      await onUpdate(mode, file)
    } finally {
      setBusy(false)
      if (input) input.value = ''
    }
  }

  return (
    <IosFormModal title="Catalogue CSV" onCancel={onClose} width="md">
      <div className="space-y-6 text-sm">
        {replacePrompt ? (
          <section className="space-y-4">
            <p className="text-[16px] font-semibold text-[var(--ink)]">Replace entire catalogue?</p>
            <p className="text-[15px] leading-6 text-[var(--ink2)]">
              Are you sure you want to replace your entire catalogue? This step can&apos;t be undone, so please download
              your current material catalogue and save it so you can revert back if required.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="h-11 rounded-xl bg-[var(--soft)] px-4 font-semibold text-[var(--ink)]"
                onClick={() => setReplacePrompt(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="h-11 rounded-xl bg-[var(--blue)] px-5 font-semibold text-white"
                onClick={() => {
                  setReplacePrompt(false)
                  replaceInputRef.current?.click()
                }}
              >
                Accept
              </button>
            </div>
          </section>
        ) : (
          <>
            <section>
              <button
                type="button"
                className={`${downloadBtn} mt-0 border-[1.5px] border-[var(--blue)] bg-white text-[var(--blue)]`}
                onClick={() => setSuggestionsOpen(true)}
              >
                Material Category Suggestions
              </button>
              <p className="mt-2 text-[var(--ink3)]">
                Optional names you can type in the Category column. You can also use your own.
              </p>
            </section>
            <section>
              <p className="text-[11px] font-semibold uppercase text-[var(--ink3)]">Step 1 · Download</p>
              <p className="mt-1 text-[var(--ink3)]">
                Download your current catalogue, edit it in a spreadsheet, then save the file as .csv (not Excel or
                Numbers).
              </p>
              <button
                type="button"
                className={`${downloadBtn} bg-[var(--blue)] text-white`}
                onClick={() => downloadTextFile(CATALOGUE_CSV_FILENAME, exportCatalogueCsv(items))}
              >
                Download Material Catalogue
              </button>
              <p className="mt-2 text-amber-800">⚠️ CSV Warning — save the file as csv and not .xls (excel) or .numbers.</p>
              <button
                type="button"
                className={`${downloadBtn} border-[1.5px] border-[var(--blue)] bg-white text-[var(--blue)]`}
                onClick={() => downloadTextFile(CATALOGUE_TEMPLATE_FILENAME, exportCatalogueTemplateCsv())}
              >
                Download blank template
              </button>
              <p className="mt-2 text-[var(--ink3)]">Headers only — use this to start a brand new list.</p>
            </section>
            <section>
              <p className="text-[11px] font-semibold uppercase text-[var(--ink3)]">Step 2 · Upload updated catalogue</p>
              <p className="mt-1 text-[var(--ink3)]">
                Choose the CSV you edited. Matching items keep their IDs. Rows in the file are saved; items missing from
                the file are removed.
              </p>
              <input
                ref={updateInputRef}
                type="file"
                accept=".csv,text/csv"
                className="mt-3 block w-full max-w-[320px] text-sm"
                disabled={busy}
                onChange={(e) => void pickFile('update', e.target.files?.[0], updateInputRef.current)}
              />
              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-[var(--line)]" />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink3)]">or</span>
                <div className="h-px flex-1 bg-[var(--line)]" />
              </div>
              <p className="text-[11px] font-semibold uppercase text-[var(--ink3)]">Step 2 · Replace entire catalogue</p>
              <p className="mt-1 text-[var(--ink3)]">
                Use this only when you want to throw away the current list and load a brand new file. You will be asked
                to confirm before your computer&apos;s file picker opens.
              </p>
              <button
                type="button"
                disabled={busy}
                className={`${downloadBtn} border-[1.5px] border-[var(--line2)] bg-[var(--card)] text-[var(--ink)]`}
                onClick={() => setReplacePrompt(true)}
              >
                Choose file
              </button>
              <input
                ref={replaceInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                disabled={busy}
                onChange={(e) => void pickFile('replace', e.target.files?.[0], replaceInputRef.current)}
              />
            </section>
            <p className="text-[var(--ink3)]">
              Edit on a laptop if you can, then save as .csv and upload here. Leave Catalogue ID blank for brand new
              rows.
            </p>
            <p className="text-[var(--ink3)]">Max 5MB · 5,000 items</p>
          </>
        )}
      </div>
      {suggestionsOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(10,20,40,.45)] p-4"
          onClick={() => setSuggestionsOpen(false)}
        >
          <div
            role="dialog"
            aria-labelledby="category-suggestions-title"
            className="flex max-h-[85vh] w-full max-w-[620px] flex-col overflow-hidden rounded-[24px] bg-[var(--card)] shadow-[var(--sh-pop)]"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="px-6 pb-3 pt-[22px]">
              <h3 id="category-suggestions-title" className="text-xl font-extrabold tracking-tight">
                Material Category Suggestions
              </h3>
            </header>
            <div className="overflow-y-auto px-6 py-4">
              <div className="grid gap-5 sm:grid-cols-2">
                {MATERIAL_CATEGORY_SUGGESTIONS.map((group) => (
                  <section key={group.section}>
                    <p className="text-[15px] font-bold">{group.section}:</p>
                    <ul className="mt-1.5 space-y-0.5">
                      {group.items.map((name) => (
                        <li key={`${group.section}-${name}`} className="text-[14px] leading-5 text-[var(--ink2)]">
                          {name}
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </div>
            <div className="border-t border-[var(--line)] px-6 py-4">
              <button
                type="button"
                className="w-full rounded-xl bg-[var(--blue)] py-3 text-[16px] font-semibold text-white"
                onClick={() => setSuggestionsOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </IosFormModal>
  )
}
