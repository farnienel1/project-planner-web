/**
 * Rulebook 1.26.1 §8 (`payEditorStartingValues`): a pay editor (Edit User, the catalogue operative form) works out its
 * starting pay and its save baseline when it opens (`payEditorRecord`). When `privatePay` changes for the open
 * organisation while the editor is open, the starting record is read again so the editor never saves from the old
 * baseline: the pay fields the admin has not touched take the reloaded values, and the baseline (the save diff and the
 * rate-history "previous" row) moves to the reloaded pay. Save stays disabled until the reload finishes.
 *
 * No `lib/canonical` change: the starting values are still `payEditorStartingValues`, reached through
 * `payEditorRecord`. While the switch does not change, nothing here reads anything.
 */
import { onSecuritySwitchChange } from '@/lib/access/securitySwitches'
import { currentOrganizationId, PAY_PROFILE_FIELDS, type SecuritySwitch } from '@/lib/canonical'

type Fields = ReadonlyArray<string>

function comparable(value: unknown): unknown {
  if (value == null || value === '') return null
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'object' && typeof (value as { toDate?: unknown }).toDate === 'function') {
    const date = (value as { toDate: () => Date }).toDate()
    return date instanceof Date ? date.getTime() : value
  }
  return value
}

/** Whether two pay values are the same (missing, null and '' are one value; dates compare by instant). */
export function samePayValue(a: unknown, b: unknown): boolean {
  return Object.is(comparable(a), comparable(b))
}

/**
 * The editor's `current` values after a reload: each pay field still equal to the old starting value `start` (not
 * touched by the admin) takes the reloaded value from `next`; a field the admin changed keeps the admin's value.
 * Every other field is left as it is.
 */
export function reseedUntouchedPayFields<T extends object>(current: T, start: T, next: T, fields: Fields = PAY_PROFILE_FIELDS): T {
  const out = { ...current } as Record<string, unknown>
  const before = start as Record<string, unknown>
  const after = next as Record<string, unknown>
  for (const key of fields) {
    if (!samePayValue(out[key], before[key])) continue
    if (Object.prototype.hasOwnProperty.call(after, key) && after[key] !== undefined) out[key] = after[key]
    else delete out[key]
  }
  return out as T
}

/** The save baseline `base` with its pay fields taken from the reloaded record `next` (other fields unchanged). */
export function withPayFieldsFrom<T extends object>(base: T, next: T, fields: Fields = PAY_PROFILE_FIELDS): T {
  const out = { ...base } as Record<string, unknown>
  const after = next as Record<string, unknown>
  for (const key of fields) {
    if (Object.prototype.hasOwnProperty.call(after, key) && after[key] !== undefined) out[key] = after[key]
    else delete out[key]
  }
  return out as T
}

export type PayEditorSwitchWatch<T> = {
  /** The organisation the editor belongs to. */
  organizationId: () => string | null | undefined
  /** Reads the editor's starting record again (`payEditorRecord` underneath). Null when it could not be read. */
  reload: () => Promise<T | null>
  /** True when a reload starts (disable Save), false when it finished and was applied. */
  onReloading: (reloading: boolean) => void
  /** The reloaded starting record, for the latest switch change only. */
  onReloaded: (next: T) => void
  /** The reload failed or found nothing: Save stays disabled; the editor should be reopened. */
  onFailed?: (error: unknown) => void
  /** Tests only. */
  subscribe?: (listener: (name: SecuritySwitch) => void) => () => void
}

/**
 * Subscribes to `onSecuritySwitchChange` and reloads the editor's starting record when `privatePay` changes for the
 * editor's organisation. Only the latest change is applied. Returns the unsubscribe (call it when the editor closes).
 */
export function watchPayEditorPrivatePay<T>(options: PayEditorSwitchWatch<T>): () => void {
  const subscribe = options.subscribe ?? onSecuritySwitchChange
  let generation = 0
  let disposed = false
  const unsubscribe = subscribe((name) => {
    if (disposed || name !== 'privatePay') return
    const organizationId = (options.organizationId() || '').trim()
    if (!organizationId) return
    const open = currentOrganizationId()
    if (open && open !== organizationId) return
    const mine = ++generation
    options.onReloading(true)
    void options
      .reload()
      .then((next) => {
        if (disposed || mine !== generation) return
        if (next == null) {
          options.onFailed?.(new Error('The pay editor could not be reloaded.'))
          return
        }
        options.onReloaded(next)
        options.onReloading(false)
      })
      .catch((error: unknown) => {
        if (disposed || mine !== generation) return
        options.onFailed?.(error)
      })
  })
  return () => {
    disposed = true
    unsubscribe()
  }
}
