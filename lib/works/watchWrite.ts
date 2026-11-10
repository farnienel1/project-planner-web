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
