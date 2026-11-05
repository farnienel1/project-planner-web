/**
 * "N people have nothing booked today. Book labour" (owner decision 3, 5 Nov 2026). N is the length of the Book
 * labour list for this viewer (`bookLabourList`), so it always matches what Book labour then shows. Hidden at 0 and
 * while the list is not ready. Presentational.
 */

import Link from 'next/link'
import { ArrowTrendingUpIcon } from '@heroicons/react/24/outline'

export function UnbookedBanner({ count, standalone = false }: { count: number; standalone?: boolean }) {
  if (count <= 0) return null
  return (
    <div className={standalone ? 'dash-banner standalone' : 'dash-banner'} role="status">
      <ArrowTrendingUpIcon aria-hidden />
      <span>
        {count === 1 ? '1 person has' : `${count} people have`} nothing booked today.
      </span>
      <Link href="/dashboard/book-labour">Book labour</Link>
    </div>
  )
}
