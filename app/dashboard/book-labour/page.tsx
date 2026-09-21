'use client'

import { Suspense } from 'react'
import { BookLabourFlowScreen } from '@/components/book-labour/BookLabourFlowScreen'

export default function BookLabourPage() {
  return (
    <Suspense fallback={<p className="py-8 text-center text-[14px] text-[var(--ink3)]">Opening book labour…</p>}>
      <BookLabourFlowScreen />
    </Suspense>
  )
}
