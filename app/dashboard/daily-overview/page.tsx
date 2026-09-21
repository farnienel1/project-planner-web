/**
 * iOS parity source: Views/DailyOverviewView.swift
 * Spec: docs/ios-parity/sections/22-daily-overview.md
 */

'use client'

import { Suspense } from 'react'
import { DailyOverviewScreen } from '@/components/daily-overview/DailyOverviewScreen'

export default function DailyOverviewPage() {
  return (
    <Suspense fallback={<p className="py-8 text-center text-[14px] text-[var(--ink3)]">Opening daily overview…</p>}>
      <DailyOverviewScreen />
    </Suspense>
  )
}
