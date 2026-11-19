/**
 * The web timesheet draft's sign-off fields in the rulebook's `TimesheetStatusFields` shape (`timesheetListBucket`).
 * User Timesheets → Awaiting / Signed off and the hub counts are the rulebook's `userTimesheetQueue` (1.66.0,
 * `lib/timesheets/timesheetQueue.ts`); the old current-pay-run helpers were removed with it.
 */
import type { TimesheetStatusFields } from '@/lib/canonical'
import type { TimesheetDraft } from '@/lib/timesheets/timesheetDraft'

export function timesheetStatusFieldsFromDraft(draft: TimesheetDraft): TimesheetStatusFields {
  return {
    operativeSignedAtMs: draft.operativeSignedAt?.getTime() ?? null,
    operativeSignedByName: draft.operativeSignedByName || '',
    operativeSignatureImageBase64: draft.operativeSignatureImageBase64 || '',
    managerSignedAtMs: draft.managerSignedAt?.getTime() ?? null,
    managerSignedByName: draft.managerSignedByName || '',
    managerSignedByUserId: draft.managerSignedByUserId || '',
    managerSignatureImageBase64: draft.managerSignatureImageBase64 || '',
    exportedAtMs: draft.exportedAt?.getTime() ?? null,
  }
}
