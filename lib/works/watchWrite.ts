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

/** A write's outcome after the screen stopped waiting: confirmed, refused, or still not answered at the upper limit. */
export type LaterWriteStatus = { status: 'saved' } | { status: 'refused'; message: string } | { status: 'unconfirmed' }

/**
 * The upper limit of "waiting for the server" (review of #371): Firestore retries a write that fails with UNKNOWN,
 * INTERNAL, UNAVAILABLE or ABORTED for ever, so its promise may never settle. After this long the screen stops saying
 * "waiting" and says the change is not confirmed.
 */
export const WRITE_UNCONFIRMED_AFTER_MS = 90_000

/**
 * Waits for `write` for up to `timeoutMs` (owner bug 17 Nov: Edit user stuck on "Saving…" although the change showed).
 * Start it only once the write has been handed to Firestore (`batch.commit()` called), never while reads that come
 * before it are still running. Confirmed in time → `'saved'`. Refused in time → throws the refusal, so the screen shows
 * the error and re-enables Save. Not answered in time → `'pending'`: the write stays queued in Firestore (the local copy
 * already shows it) and `onLater` is called with `saved` or `refused` when it settles. When it has still not settled
 * `giveUpMs` after the start, `onLater` is called with `unconfirmed` (once); a later answer is still reported.
 * Never waits longer than `timeoutMs`; never throws after it has returned.
 */
export async function confirmWriteWithin(
  write: Promise<unknown>,
  onLater: (status: LaterWriteStatus) => void,
  timeoutMs: number = WRITE_CONFIRM_TIMEOUT_MS,
  giveUpMs: number = WRITE_UNCONFIRMED_AFTER_MS
): Promise<'saved' | 'pending'> {
  return new Promise<'saved' | 'pending'>((resolve, reject) => {
    let answered = false
    let settled = false
    const report = (status: LaterWriteStatus) => {
      try {
        onLater(status)
      } catch (error) {
        console.warn('[confirmWriteWithin] onLater failed', error)
      }
    }
    const pendingTimer = setTimeout(() => {
      if (settled || answered) return
      answered = true
      resolve('pending')
    }, timeoutMs)
    const giveUpTimer = setTimeout(() => {
      if (!settled) report({ status: 'unconfirmed' })
    }, Math.max(giveUpMs, timeoutMs))
    // Never keeps a Node process (tests) alive for the long limit; a no-op in the browser.
    ;(giveUpTimer as unknown as { unref?: () => void }).unref?.()
    const finish = (status: { status: 'saved' } | { status: 'refused'; message: string }) => {
      settled = true
      clearTimeout(pendingTimer)
      clearTimeout(giveUpTimer)
      if (!answered) {
        answered = true
        if (status.status === 'refused') reject(new Error(status.message))
        else resolve('saved')
        return
      }
      report(status)
    }
    Promise.resolve(write).then(
      () => finish({ status: 'saved' }),
      (error: unknown) => finish({ status: 'refused', message: refusalMessage(error) })
    )
  })
}
