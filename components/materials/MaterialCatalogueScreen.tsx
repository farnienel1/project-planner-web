/**
 * iOS parity source: Views/MaterialsCatalogueFlow.swift, Core/MaterialCatalogCSV.swift
 * Spec: docs/ios-parity/sections/07-material-catalogue.md
 */
'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CubeIcon } from '@heroicons/react/24/solid'
import type { MaterialCatalogItem } from '@/types'
import { MATERIAL_ORDER_UNIT_DETAILS, materialBrandStored, materialBrandText, materialContentText, materialSizeText } from '@/lib/canonical'
import { useAuthStore } from '@/lib/stores/authStore'
import { useMaterialCatalogStore } from '@/lib/stores/materialCatalogStore'
import { OrderUnitFields, orderUnitDraftFrom, orderUnitDraftValues, type OrderUnitDraft } from '@/components/materials/OrderUnitFields'
import { canManageMaterialCatalogue } from '@/lib/permissions'
import { consumeCreateQuery } from '@/lib/navigation/createMenu'
import { newUuid } from '@/lib/firebase/firestoreUtils'
import { duplicateKey, filterCatalogueItems } from '@/lib/materials/materialCatalogSearch'
import {
  CATALOGUE_CSV_FILENAME,
  CATALOGUE_TEMPLATE_FILENAME,
  downloadTextFile,
  exportCatalogueCsv,
  exportCatalogueTemplateCsv,
  parseCatalogueCsv,
  readCatalogueCsvFile,
} from '@/lib/materials/materialCatalogCSV'
import { STARTER_CATALOGUE_FILENAME, starterCatalogueCsv } from '@/lib/materials/starterCatalogue'
import { EmptyState, IosFormModal, PageHeader } from '@/components/ios/primitives'
import { MATERIAL_CATEGORY_SUGGESTIONS } from '@/lib/materials/materialCategorySuggestions'

const emptyDraft = (): Omit<MaterialCatalogItem, 'createdAt'> => ({
  id: newUuid(),
  name: '',
  brand: '',
  productCode: '',
  defaultUnit: 'Number',
  orderUnit: 'Each',
  size: '',
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

  const filtered = useMemo(() => filterCatalogueItems(search, items), [items, search])
  const searching = Boolean(search.trim())

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

  const brands = new Set(items.map((item) => materialBrandStored(item.brand)).filter(Boolean)).size
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
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-(--blue)" />
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

      <div className="rounded-2xl bg-linear-to-br from-[#185FA5] to-[#0F4C81] p-5 text-white shadow-xs">
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
          placeholder="Try 2.5mm LS — name, brand, code or size"
          className="mt-4 w-full rounded-xl border-0 px-4 py-2.5 text-[15px] text-(--ink)"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-white p-6 shadow-xs">
          <EmptyState
            icon={<CubeIcon className="h-[60px] w-[60px] text-gray-400" />}
            title={searching ? 'No items match' : 'No catalogue items yet'}
            subtitle={
              searching
                ? 'Try a shorter token such as 2.5mm or LS, or a product code.'
                : 'Add materials manually or update the catalogue from a CSV.'
            }
          />
        </div>
      ) : searching ? (
        <div className="overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.10)]">
          <div className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.4px] text-(--ink3)">
            {filtered.length} match{filtered.length === 1 ? '' : 'es'}
          </div>
          <div className="space-y-2 border-t border-[#E5E5EA] px-3 py-3">
            {filtered.map((item) => {
              const [lengthLabel, sizeLabel] = [materialContentText(item), materialSizeText(item.size)]
              return (
                <button
                  key={item.id}
                  type="button"
                  className="flex w-full items-start gap-3 rounded-xl px-2 py-2 text-left hover:bg-slate-50"
                  onClick={() => {
                    setExistingId(item.id)
                    setEditor({ ...item })
                  }}
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-(--blue-t) text-(--blue)">
                    <CubeIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-medium">{item.name}</p>
                    <p className="text-[13px] text-(--ink3)">{materialBrandText(item.brand)}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {item.productCode ? (
                        <span className="rounded-sm bg-(--blue-t) px-1.5 py-0.5 font-mono text-[11px] font-medium text-(--blue)">
                          {item.productCode}
                        </span>
                      ) : null}
                      <span className="rounded-sm bg-(--soft) px-1.5 py-0.5 text-[11px] font-medium text-(--ink3)">
                        {MATERIAL_ORDER_UNIT_DETAILS[item.orderUnit].label}
                      </span>
                      {sizeLabel ? (
                        <span className="rounded-sm bg-(--soft) px-1.5 py-0.5 text-[11px] text-(--ink3)">
                          Size: {sizeLabel}
                        </span>
                      ) : null}
                      {lengthLabel ? (
                        <span className="rounded-sm bg-(--soft) px-1.5 py-0.5 text-[11px] text-(--ink3)">
                          In one: {lengthLabel}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
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
                  <span className="text-[11px] font-semibold uppercase tracking-[0.4px] text-(--ink3)">{category}</span>
                  <span className="text-[12px] text-(--ink3)">
                    {rows.length} item{rows.length === 1 ? '' : 's'}
                  </span>
                </button>
                {open ? (
                  <div className="space-y-2 border-t border-[#E5E5EA] px-3 py-3">
                    {rows.map((item) => {
                      const [lengthLabel, sizeLabel] = [materialContentText(item), materialSizeText(item.size)]
                      return (
                      <button
                        key={item.id}
                        type="button"
                        className="flex w-full items-start gap-3 rounded-xl px-2 py-2 text-left hover:bg-slate-50"
                        onClick={() => {
                          setExistingId(item.id)
                          setEditor({ ...item })
                        }}
                      >
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-(--blue-t) text-(--blue)">
                          <CubeIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[15px] font-medium">{item.name}</p>
                          <p className="text-[13px] text-(--ink3)">{materialBrandText(item.brand)}</p>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {item.productCode ? (
                              <span className="rounded-sm bg-(--blue-t) px-1.5 py-0.5 font-mono text-[11px] font-medium text-(--blue)">
                                {item.productCode}
                              </span>
                            ) : null}
                            <span className="rounded-sm bg-(--soft) px-1.5 py-0.5 text-[11px] font-medium text-(--ink3)">
                              {MATERIAL_ORDER_UNIT_DETAILS[item.orderUnit].label}
                            </span>
                            {sizeLabel ? (
                              <span className="rounded-sm bg-(--soft) px-1.5 py-0.5 text-[11px] text-(--ink3)">
                                Size: {sizeLabel}
                              </span>
                            ) : null}
                            {lengthLabel ? (
                              <span className="rounded-sm bg-(--soft) px-1.5 py-0.5 text-[11px] text-(--ink3)">
                                In one: {lengthLabel}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </button>
                      )
                    })}
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
                brand: materialBrandStored(next.brand),
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
            // Rulebook 1.48.0 §28: .csv only, at most 2 MB, UTF-8 text with no binary data; read in the browser and
            // never uploaded. Then the rulebook parser (field caps, plain text, old and new columns).
            const read = await readCatalogueCsvFile(file)
            if ('error' in read) {
              window.alert(read.error)
              return
            }
            const parsed = parseCatalogueCsv(read.text)
            if (parsed.errors.length > 0 && parsed.rows.length === 0) {
              window.alert(parsed.errors.slice(0, 10).join('\n'))
              return
            }
            if (parsed.errors.length > 0) {
              const ok = window.confirm(
                `${parsed.errors.length} row${parsed.errors.length === 1 ? '' : 's'} could not be read and will be left out:\n\n${parsed.errors
                  .slice(0, 10)
                  .join('\n')}${parsed.errors.length > 10 ? `\n…and ${parsed.errors.length - 10} more` : ''}\n\nImport the other ${parsed.rows.length} rows?`
              )
              if (!ok) return
            }
            const actor = { createdByUserId: user.id, createdByName: `${user.firstName} ${user.surname}`.trim() || user.email }
            if (parsed.rows.length === 0) {
              window.alert('That CSV has no materials. The current catalogue was left unchanged.')
              return
            }
            if (mode === 'replace') {
              // Rulebook 1.8.0 `materialCatalogueWrites`: a row matching a stored item keeps its id, so only
              // changed items are written and only items missing from the file are deleted.
              const storedById = new Map(items.map((item) => [item.id.toLowerCase(), item]))
              await replaceAllItems(
                organization.id,
                parsed.rows.map((row) => ({
                  id:
                    (row.id && storedById.get(row.id.toLowerCase())?.id) ||
                    items.find((item) => duplicateKey(item.name, item.productCode) === duplicateKey(row.name, row.productCode))?.id ||
                    newUuid(),
                  name: row.name,
                  brand: row.brand,
                  productCode: row.productCode || undefined,
                  defaultUnit: MATERIAL_ORDER_UNIT_DETAILS[row.orderUnit].legacyUnit,
                  orderUnit: row.orderUnit,
                  contentAmount: row.contentAmount ?? undefined,
                  contentMeasure: row.contentMeasure ?? undefined,
                  size: row.size || undefined,
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
                  productCode: row.productCode || undefined,
                  defaultUnit: MATERIAL_ORDER_UNIT_DETAILS[row.orderUnit].legacyUnit,
                  orderUnit: row.orderUnit,
                  contentAmount: row.contentAmount ?? undefined,
                  contentMeasure: row.contentMeasure ?? undefined,
                  size: row.size || undefined,
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
  const [quantityDraft, setQuantityDraft] = useState<OrderUnitDraft>(() => orderUnitDraftFrom(draft))
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.name.trim()) return
    // Rulebook 1.48.0 §28: the order unit and what is in one; the old unit and length are written from them.
    const values = orderUnitDraftValues(quantityDraft)
    if ('error' in values) {
      setFormError(values.error)
      return
    }
    setFormError(null)
    setSaving(true)
    try {
      await onSave({
        ...form,
        orderUnit: quantityDraft.orderUnit,
        defaultUnit: MATERIAL_ORDER_UNIT_DETAILS[quantityDraft.orderUnit].legacyUnit,
        contentAmount: values.contentAmount ?? undefined,
        contentMeasure: values.contentMeasure ?? undefined,
      })
    } finally {
      setSaving(false)
    }
  }
  return (
    <IosFormModal
      title={isNew ? 'New material' : 'Edit material'}
      onCancel={onCancel}
      footer={
        <button type="submit" form="material-editor" disabled={!form.name.trim() || saving} className="w-full rounded-xl bg-(--blue) py-3 font-semibold text-white disabled:opacity-50">
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
        <OrderUnitFields draft={quantityDraft} onChange={setQuantityDraft} label="Default order unit" />
        <label className="block text-sm font-medium">
          Size
          <input
            value={materialSizeText(form.size)}
            onChange={(e) => setForm({ ...form, size: e.target.value })}
            placeholder="Optional, e.g. 2400x1200mm or 25kg"
            className="mt-1 w-full rounded-lg border px-3 py-2"
          />
        </label>
        {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
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
            <p className="text-[16px] font-semibold text-(--ink)">Replace entire catalogue?</p>
            <p className="text-[15px] leading-6 text-(--ink2)">
              Are you sure you want to replace your entire catalogue? This step can&apos;t be undone, so please download
              your current material catalogue and save it so you can revert back if required.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="h-11 rounded-xl bg-(--soft) px-4 font-semibold text-(--ink)"
                onClick={() => setReplacePrompt(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="h-11 rounded-xl bg-(--blue) px-5 font-semibold text-white"
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
                className={`${downloadBtn} mt-0 border-[1.5px] border-(--blue) bg-white text-(--blue)`}
                onClick={() => setSuggestionsOpen(true)}
              >
                Material Category Suggestions
              </button>
              <p className="mt-2 text-(--ink3)">
                Optional names you can type in the Category column. You can also use your own.
              </p>
            </section>
            <section>
              <p className="text-[11px] font-semibold uppercase text-(--ink3)">Step 1 · Download</p>
              <p className="mt-1 text-(--ink3)">
                Download your current catalogue, the Project Planner starter list, or a blank template. Edit in a
                spreadsheet, then save as .csv (not Excel or Numbers).
              </p>
              <button
                type="button"
                className={`${downloadBtn} bg-(--blue) text-white`}
                onClick={() => downloadTextFile(CATALOGUE_CSV_FILENAME, exportCatalogueCsv(items))}
              >
                Download Material Catalogue
              </button>
              <p className="mt-2 text-amber-800">⚠️ CSV Warning — save the file as csv and not .xls (excel) or .numbers.</p>
              <button
                type="button"
                className={`${downloadBtn} border-[1.5px] border-(--blue) bg-white text-(--blue)`}
                onClick={() => downloadTextFile(STARTER_CATALOGUE_FILENAME, starterCatalogueCsv())}
              >
                Download starter catalogue
              </button>
              <p className="mt-2 text-(--ink3)">
                The standard list seeded on new organisations. Update it and upload, or use it to restore the defaults.
              </p>
              <button
                type="button"
                className={`${downloadBtn} border-[1.5px] border-(--blue) bg-white text-(--blue)`}
                onClick={() => downloadTextFile(CATALOGUE_TEMPLATE_FILENAME, exportCatalogueTemplateCsv())}
              >
                Download blank template
              </button>
              <p className="mt-2 text-(--ink3)">Headers only — use this to start a brand new list.</p>
            </section>
            <section>
              <p className="text-[11px] font-semibold uppercase text-(--ink3)">Step 2 · Upload updated catalogue</p>
              <p className="mt-1 text-(--ink3)">
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
                <div className="h-px flex-1 bg-(--line)" />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-(--ink3)">or</span>
                <div className="h-px flex-1 bg-(--line)" />
              </div>
              <p className="text-[11px] font-semibold uppercase text-(--ink3)">Step 2 · Replace entire catalogue</p>
              <p className="mt-1 text-(--ink3)">
                Use this only when you want to throw away the current list and load a brand new file. You will be asked
                to confirm before your computer&apos;s file picker opens.
              </p>
              <button
                type="button"
                disabled={busy}
                className={`${downloadBtn} border-[1.5px] border-(--line2) bg-(--card) text-(--ink)`}
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
            <p className="text-(--ink3)">
              Edit on a laptop if you can, then save as .csv and upload here. Leave Catalogue ID blank for brand new
              rows.
            </p>
            <p className="text-(--ink3)">
              .csv files only (UTF-8) · max 2 MB · 10,000 items. The file is read on this device and never uploaded.
              Columns: Order unit is Each, Box, Pack, Drum, Reel, Coil, Pallet, Length or Metre; Contents amount and
              Contents measure (m, mm or pcs) say what is in one. Older files with Default Type and Length still work.
            </p>

          </>
        )}
      </div>
      {suggestionsOpen ? (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-[rgba(10,20,40,.45)] p-4"
          onClick={() => setSuggestionsOpen(false)}
        >
          <div
            role="dialog"
            aria-labelledby="category-suggestions-title"
            className="flex max-h-[85vh] w-full max-w-[620px] flex-col overflow-hidden rounded-[24px] bg-(--card) shadow-(color:--sh-pop)"
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
                        <li key={`${group.section}-${name}`} className="text-[14px] leading-5 text-(--ink2)">
                          {name}
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </div>
            <div className="border-t border-(--line) px-6 py-4">
              <button
                type="button"
                className="w-full rounded-xl bg-(--blue) py-3 text-[16px] font-semibold text-white"
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
