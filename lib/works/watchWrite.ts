import { isTimeoutError, withTimeout } from '@/lib/client/withTimeout'

/**
 * A Firestore write the screen does not wait for (iOS PR #210, `FirebaseBackend+WorksListPicks.swift`): the write is
 * handed to Firestore and the sheet closes at once; this watches the server confirmation for up to `timeoutMs`.
 * Firestore keeps the write queued and the live listener already shows it (latency compensation), so a slow link is
 * "pending", not a failure; a refusal (rules, bad data) is "refused" and the listener rolls the local copy back.
 */
export type WriteStatus = { status: 'saved' } | { status: 'pending' } | { status: 'refused'; message: string }

/** How long a save waits for the server before it is shown as pending (the iOS value). */
export const WRITE_CONFIRM_TIMEOUT_MS = 15_000

function refusalMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'The save was refused.'
}

/**
 * Calls `onChange` with `pending` when `write` has not settled within `timeoutMs`, then once with `saved` or
 * `refused` when it settles (also after a pending). Never throws. Resolves with the final status.
 */
export async function watchWrite(
  write: Promise<unknown>,
  onChange: (status: WriteStatus) => void,
  timeoutMs: number = WRITE_CONFIRM_TIMEOUT_MS
): Promise<WriteStatus> {
  let final: WriteStatus
  try {
    await withTimeout(write, timeoutMs, 'write-confirm')
    final = { status: 'saved' }
  } catch (error) {
    if (!isTimeoutError(error)) {
      final = { status: 'refused', message: refusalMessage(error) }
    } else {
      onChange({ status: 'pending' })
      try {
        await write
        final = { status: 'saved' }
      } catch (late) {
        final = { status: 'refused', message: refusalMessage(late) }
      }
    }
  }
  onChange(final)
  return final
}

/**
 * Waits for `write` for up to `timeoutMs` (owner bug 17 Nov: Edit user stuck on "Saving…" although the change showed).
 * Confirmed in time → `'saved'`. Refused in time → throws the refusal, so the screen shows the error and re-enables
 * Save. Not answered in time → `'pending'`: the write stays queued in Firestore (the local copy already shows it) and
 * `onLater` is called once with the final outcome (`saved` or `refused`). Never waits longer than `timeoutMs`.
 */
export async function confirmWriteWithin(
  write: Promise<unknown>,
  onLater: (status: Exclude<WriteStatus, { status: 'pending' }>) => void,
  timeoutMs: number = WRITE_CONFIRM_TIMEOUT_MS
): Promise<'saved' | 'pending'> {
  return new Promise<'saved' | 'pending'>((resolve, reject) => {
    let answered = false
    void watchWrite(
      write,
      (status) => {
        if (!answered) {
          answered = true
          if (status.status === 'refused') reject(new Error(status.message))
          else resolve(status.status)
          return
        }
        if (status.status !== 'pending') onLater(status)
      },
      timeoutMs
    )
  })
}
