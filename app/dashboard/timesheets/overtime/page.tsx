/**
 * Rulebook 1.29.0 §25: Timesheets → Overtime, Expenses & Price Work.
 */
'use client'

import { Suspense } from 'react'
import { OvertimeScreen } from '@/components/overtime/OvertimeScreen'

export default function OvertimePage() {
  return (
    <Suspense fallback={<p className="muted">Loading…</p>}>
      <OvertimeScreen />
    </Suspense>
  )
}
