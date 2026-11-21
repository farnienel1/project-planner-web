'use client'

/**
 * Order unit and "What's in one" (rulebook 1.48.0 §28). The units, their help, the measures each unit offers and the
 * checks are the rulebook's (`MATERIAL_ORDER_UNITS`, `MATERIAL_ORDER_UNIT_DETAILS`, `materialContentError`); this
 * component only draws them. Used by the catalogue editor and the job Add material sheet.
 */
import {
  MATERIAL_ORDER_UNIT_DETAILS,
  MATERIAL_ORDER_UNITS,
  materialContentError,
  type MaterialContentMeasure,
  type MaterialOrderUnit,
} from '@/lib/canonical'

export type OrderUnitDraft = {
  orderUnit: MaterialOrderUnit
  /** As typed ('' when blank). */
  contentAmount: string
  contentMeasure: MaterialContentMeasure | ''
}

/** A draft for a unit change: keep what is in one when the new unit offers that measure, else its first measure. */
export function orderUnitDraftAfterUnitChange(draft: OrderUnitDraft, orderUnit: MaterialOrderUnit): OrderUnitDraft {
  const measures = MATERIAL_ORDER_UNIT_DETAILS[orderUnit].measures
  if (measures.length === 0) return { orderUnit, contentAmount: '', contentMeasure: '' }
  const measure = draft.contentMeasure && measures.includes(draft.contentMeasure) ? draft.contentMeasure : measures[0]
  return { orderUnit, contentAmount: draft.contentAmount, contentMeasure: measure }
}

/** The draft's "What's in one" as stored values, or the reason it cannot be saved. */
export function orderUnitDraftValues(
  draft: OrderUnitDraft
): { contentAmount: number | null; contentMeasure: MaterialContentMeasure | null } | { error: string } {
  const amount = draft.contentAmount.trim()
  if (!amount || draft.orderUnit === 'Metre') return { contentAmount: null, contentMeasure: null }
  const measure = draft.contentMeasure || MATERIAL_ORDER_UNIT_DETAILS[draft.orderUnit].measures[0] || null
  const normalized = amount.replace(',', '.')
  const error = materialContentError(normalized, measure, draft.orderUnit)
  if (error) return { error }
  return { contentAmount: Number(normalized), contentMeasure: measure }
}

/** A draft from a stored item or line (the rulebook reader's values). */
export function orderUnitDraftFrom(model: {
  orderUnit: MaterialOrderUnit
  contentAmount?: number | null
  contentMeasure?: MaterialContentMeasure | null
}): OrderUnitDraft {
  return {
    orderUnit: model.orderUnit,
    contentAmount: model.contentAmount != null ? String(model.contentAmount) : '',
    contentMeasure: model.contentMeasure || MATERIAL_ORDER_UNIT_DETAILS[model.orderUnit].measures[0] || '',
  }
}

export function OrderUnitFields({
  draft,
  onChange,
  label = 'Order unit',
}: {
  draft: OrderUnitDraft
  onChange: (next: OrderUnitDraft) => void
  label?: string
}) {
  const detail = MATERIAL_ORDER_UNIT_DETAILS[draft.orderUnit]
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase text-(--ink3)">{label}</p>
      <div className="flex flex-wrap gap-2">
        {MATERIAL_ORDER_UNITS.map((unit) => (
          <button
            key={unit}
            type="button"
            aria-pressed={draft.orderUnit === unit}
            onClick={() => onChange(orderUnitDraftAfterUnitChange(draft, unit))}
            className={`rounded-full px-3 py-1.5 text-[13px] font-medium ${
              draft.orderUnit === unit ? 'bg-(--blue-t) text-(--blue)' : 'bg-(--soft) text-(--ink)'
            }`}
          >
            {MATERIAL_ORDER_UNIT_DETAILS[unit].label}
          </button>
        ))}
      </div>
      <p className="text-[12px] text-(--ink3)">{detail.hint}</p>
      {detail.measures.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium">
            What&apos;s in one
            <input
              inputMode="decimal"
              value={draft.contentAmount}
              onChange={(event) => onChange({ ...draft, contentAmount: event.target.value })}
              placeholder="Optional"
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium">
            Measure
            <select
              value={draft.contentMeasure || detail.measures[0]}
              onChange={(event) => onChange({ ...draft, contentMeasure: event.target.value as MaterialContentMeasure })}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            >
              {detail.measures.map((measure) => (
                <option key={measure} value={measure}>
                  {measure}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
    </div>
  )
}
