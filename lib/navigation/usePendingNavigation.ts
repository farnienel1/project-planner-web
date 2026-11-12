'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { navigationMayStart } from '@/lib/navigation/pendingNavigation'

/**
 * `router.push` with a pending state, for buttons and rows that navigate in code (Back, a person's row, a client).
 *
 * The push runs in a React transition, so `pendingHref` stays set until the next page has rendered; while it is set,
 * further presses are ignored, so double clicks never stack navigations. `prefetch` warms a route on hover or focus.
 * Display only: the destinations and URLs are exactly what the callers pushed before.
 */
export function usePendingNavigation() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const pendingRef = useRef<string | null>(null)
  const [target, setTarget] = useState<string | null>(null)

  useEffect(() => {
    if (!isPending && pendingRef.current) {
      pendingRef.current = null
      setTarget(null)
    }
  }, [isPending])

  const navigate = useCallback(
    (href: string) => {
      if (!navigationMayStart(pendingRef.current)) return
      pendingRef.current = href
      setTarget(href)
      startTransition(() => router.push(href))
    },
    [router]
  )

  const prefetch = useCallback(
    (href: string) => {
      try {
        router.prefetch(href)
      } catch {
        // A prefetch is only a warm-up; the click still navigates.
      }
    },
    [router]
  )

  const pendingHref = target
  return { navigate, prefetch, pending: pendingHref != null, pendingHref }
}
