/**
 * Pay strip (final check #342 item 3): the weekly report and the Payrun Snapshot price or label every person in them
 * from their pay (rate, employment type). They are built only when every person's pay is known — the organisation's
 * status first, then each person's (`payProfilesStatusForPerson`: their own read, and anyone added since the last read).
 * Otherwise they are refused, naming who is still loading or could not be read. Never priced from a stripped record.
 */
import type { PayProfilesStatus } from '@/lib/pay/payProfileOverlay'

export const PAY_PROFILES_FAILED_MESSAGE = 'Could not load pay details, so this report cannot be built yet. Try again.'

export type ReportPayGate = {
  status: PayProfilesStatus
  loadingNames: string[]
  failedNames: string[]
  /** What the screen shows instead of the report (null when ready, or while the organisation itself loads). */
  message: string | null
}

export function reportPayGate<P>(input: {
  organizationStatus: PayProfilesStatus
  people: ReadonlyArray<P>
  statusOf: (person: P) => PayProfilesStatus
  nameOf: (person: P) => string
}): ReportPayGate {
  if (input.organizationStatus === 'failed') {
    return { status: 'failed', loadingNames: [], failedNames: [], message: PAY_PROFILES_FAILED_MESSAGE }
  }
  if (input.organizationStatus === 'loading') return { status: 'loading', loadingNames: [], failedNames: [], message: null }
  const loadingNames: string[] = []
  const failedNames: string[] = []
  for (const person of input.people) {
    const status = input.statusOf(person)
    if (status === 'failed') failedNames.push(input.nameOf(person))
    else if (status === 'loading') loadingNames.push(input.nameOf(person))
  }
  if (failedNames.length > 0) {
    return {
      status: 'failed',
      loadingNames,
      failedNames,
      message: `Could not load pay details for ${failedNames.join(', ')}, so this report cannot be built yet. Try again.`,
    }
  }
  if (loadingNames.length > 0) {
    return { status: 'loading', loadingNames, failedNames, message: `Waiting for pay details for ${loadingNames.join(', ')}…` }
  }
  return { status: 'ready', loadingNames, failedNames, message: null }
}

/**
 * Review #342: the people a report waits for — only those it prices or lists (`ids`: the weekly report's
 * `pricedUserIds`, the Payrun Snapshot's row people). Someone with no rows never blocks it.
 */
export function reportGatePeople<P extends { id: string }>(users: ReadonlyArray<P>, ids: Iterable<string>): P[] {
  const wanted = new Set(ids)
  return users.filter((user) => wanted.has(user.id))
}
