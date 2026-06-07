'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { useMaterialCatalogStore } from '@/lib/stores/materialCatalogStore'
import { useMaterialProjectStore } from '@/lib/stores/materialProjectStore'
import { searchMaterialCatalogue, type MaterialSuggestion } from '@/lib/materials/materialCatalogSearch'
import { FormInput, FormLabel, FormSelect, FormTextarea } from '@/components/forms/FormShell'
import { ErrorBanner } from '@/components/dashboard/PageShell'
import type { Project } from '@/types'

const UNITS = ['Number', 'Box', 'Length', 'Drum', 'Pallet', 'm', 'mm', 'kg']

type Props = {
  project: Project
  selectedDate: Date
  onClose: () => void
  onSaved: () => void
}

export function MaterialsAddSheet({ project, selectedDate, onClose, onSaved }: Props) {
  const { organization, user } = useAuthStore()
  const { items: catalogue, loadItems } = useMaterialCatalogStore()
  const { materials, saveMaterialLine, error: storeError } = useMaterialProjectStore()

  const [query, setQuery] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unit, setUnit] = useState('Number')
  const [brand, setBrand] = useState('')
  const [productCode, setProductCode] = useState('')
  const [notes, setNotes] = useState('')
  const [catalogueItemId, setCatalogueItemId] = useState<string | undefined>()
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [saving, setSaving] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const projectMaterials = useMemo(
    () => materials.filter((m) => m.projectId === project.id),
    [materials, project.id]
  )

  const suggestions = useMemo(
    () => searchMaterialCatalogue(query, catalogue, projectMaterials, 10),
    [query, catalogue, projectMaterials]
  )

  useEffect(() => {
    if (organization?.id) loadItems(organization.id)
  }, [organization, loadItems])

  const applySuggestion = (s: MaterialSuggestion) => {
    setQuery(s.name)
    setBrand(s.brand)
    setProductCode(s.productCode || '')
    setUnit(s.unit || 'Number')
    setCatalogueItemId(s.catalogueItem?.id)
    setShowSuggestions(false)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!organization?.id || !user) return
    const name = query.trim()
    if (!name) {
      setLocalError('Enter a material name')
      return
    }
    setSaving(true)
    setLocalError(null)
    try {
      const displayName =
        `${user.firstName || ''} ${user.surname || ''}`.trim() || user.email.split('@')[0]
      await saveMaterialLine(organization.id, {
        quantity: Number(quantity) || 1,
        unit,
        material: name,
        addedBy: displayName,
        addedByUserId: user.id,
        projectId: project.id,
        date: selectedDate,
        status: 'draft',
        brand: brand.trim() || undefined,
        productCode: productCode.trim() || undefined,
        catalogueItemId,
        notes: notes.trim() || undefined,
      })
      onSaved()
      onClose()
    } catch (err: unknown) {
      setLocalError(err instanceof Error ? err.message : 'Could not save material')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-base font-bold text-slate-900">Add material</p>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>

        {(localError || storeError) && (
          <div className="mb-3">
            <ErrorBanner message={localError || storeError || ''} />
          </div>
        )}

        <form onSubmit={submit} className="space-y-3">
          <div className="relative">
            <FormLabel>Material</FormLabel>
            <FormInput
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setCatalogueItemId(undefined)
                setShowSuggestions(true)
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => {
                blurTimer.current = setTimeout(() => setShowSuggestions(false), 150)
              }}
              placeholder="Search catalogue or recent materials"
              required
              autoComplete="off"
              autoFocus
            />
            {showSuggestions && suggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                {suggestions.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applySuggestion(s)}
                    >
                      <span className="font-medium text-slate-900">{s.name}</span>
                      <span className="ml-2 text-xs text-slate-500">
                        {s.brand}
                        {s.productCode ? ` · ${s.productCode}` : ''}
                        {s.source === 'catalogue' ? ' · Catalogue' : ' · Recent'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <FormLabel>Quantity</FormLabel>
              <FormInput
                type="number"
                min={0}
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div>
              <FormLabel>Unit</FormLabel>
              <FormSelect value={unit} onChange={(e) => setUnit(e.target.value)}>
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </FormSelect>
            </div>
          </div>

          <FormInput
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="Brand (optional)"
          />
          <FormInput
            value={productCode}
            onChange={(e) => setProductCode(e.target.value)}
            placeholder="Product code (optional)"
          />
          <FormTextarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            rows={2}
          />

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-[#185FA5] py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Add material'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
