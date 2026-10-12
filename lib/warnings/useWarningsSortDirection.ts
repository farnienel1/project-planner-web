'use client'

import { useCallback, useLayoutEffect, useState } from 'react'
import { DEFAULT_WARNINGS_SORT_DIRECTION, type WarningsSortDirection } from '@/lib/canonical'
import { readWarningsSortDirection, writeWarningsSortDirection } from '@/lib/warnings/warningsSortPreference'

/**
 * Load the signed-in user's Warnings sort before the list paints, persist
 * immediately on change, and never reset to the default unless this user
 * has never chosen a sort on this device.
 */
export function useWarningsSortDirection(userId: string): {
  sortDirection: WarningsSortDirection
  setSortDirection: (direction: WarningsSortDirection) => void
} {
  const id = String(userId || '').trim()
  const [sortDirection, setSortDirectionState] = useState<WarningsSortDirection>(() =>
    id ? readWarningsSortDirection(id) : DEFAULT_WARNINGS_SORT_DIRECTION
  )
  const [loadedUserId, setLoadedUserId] = useState(id)

  if (id !== loadedUserId) {
    setLoadedUserId(id)
    setSortDirectionState(id ? readWarningsSortDirection(id) : DEFAULT_WARNINGS_SORT_DIRECTION)
  }

  useLayoutEffect(() => {
    if (!id) return
    setSortDirectionState(readWarningsSortDirection(id))
  }, [id])

  const setSortDirection = useCallback(
    (direction: WarningsSortDirection) => {
      if (!id) return
      writeWarningsSortDirection(id, direction)
      setSortDirectionState(direction)
    },
    [id]
  )

  return { sortDirection, setSortDirection }
}
