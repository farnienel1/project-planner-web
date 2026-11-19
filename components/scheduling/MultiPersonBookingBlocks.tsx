'use client'

/**
 * Rulebook 1.60.0 §5: the people in a multi-person booking who already have hours booked on a selected day. The save
 * waits until each is removed from the selection (`multiPersonBookingBlocks`, `MULTI_PERSON_ALREADY_BOOKED_MESSAGE`).
 */

import { MULTI_PERSON_ALREADY_BOOKED_REMOVE_LABEL, type MultiPersonBookingBlock } from '@/lib/canonical'

export function MultiPersonBookingBlocks({
  blocks,
  daysText,
  onRemove,
}: {
  blocks: MultiPersonBookingBlock[]
  daysText: (dayKeys: string[]) => string
  onRemove: (personKey: string) => void
}) {
  if (blocks.length === 0) return null
  return (
    <div role="alert" className="space-y-2 rounded-xl border border-[#F4C0C0] bg-[#FCEBEB] px-4 py-3 text-[13px] text-[#A32D2D]">
      {blocks.map((block) => (
        <div key={block.personKey} className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              {block.name} · {daysText(block.dayKeys)}
            </p>
            <p>{block.message}</p>
          </div>
          <button
            type="button"
            onClick={() => onRemove(block.personKey)}
            className="shrink-0 rounded-full border border-[#A32D2D]/40 bg-white px-3 py-1 text-[12px] font-semibold text-[#A32D2D]"
          >
            {MULTI_PERSON_ALREADY_BOOKED_REMOVE_LABEL}
          </button>
        </div>
      ))}
    </div>
  )
}
