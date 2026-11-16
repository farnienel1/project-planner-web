/**
 * Pay strip: whose timesheet reminder this browser sends. `timesheetParticipant` (rulebook 1.10.0 M12) decides on each
 * person's employment type, which is pay data: while `privatePay` is on it is read from the pay profiles, and a
 * viewer who is not an admin cannot read anyone else's. So:
 *   - `privatePay` off: the whole roster, exactly as before;
 *   - on, the viewer reads every pay profile (`payProfileReadPlan` kind `all`, admins) and the roster has been laid over
 *     (`payProfilesStatusFor` ready): the whole roster, the viewer's own row from their own pay record;
 *   - otherwise: only the viewer, from their own pay record (`useOwnPayUser`), once it has been read.
 * Never someone whose employment type could not be read (they would read as self-employed after the strip).
 */
import type { PayProfilesStatus } from '@/lib/pay/payProfileOverlay'
import { withOwnPay, type OwnPayState } from '@/lib/pay/ownPayRecord'
import type { User } from '@/types'

export function timesheetReminderAudience(input: {
  privatePay: boolean
  viewerReadsEveryPay: boolean
  payProfiles: PayProfilesStatus
  roster: ReadonlyArray<User>
  own: OwnPayState
}): User[] {
  if (!input.privatePay) return [...input.roster]
  const own = input.own.status === 'ready' ? input.own.user : null
  if (input.viewerReadsEveryPay && input.payProfiles === 'ready') {
    return input.roster.map((row) => withOwnPay(row, input.own))
  }
  return own ? [own] : []
}
