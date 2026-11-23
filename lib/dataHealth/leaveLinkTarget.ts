/**
 * Data health "Leave not linked to a person" (owner decision 23 Nov): which stored id a leave record is linked by —
 * its `userId`, else its `operativeId`, exactly as stored. An email (older iOS builds stored the account email as
 * `userId`, rulebook §9 / §10) is never offered: linking adds an id to `formerUserIds`, not an email. Display only;
 * the link itself is the rulebook's (`linkBookingPersonRefusal`, `linkBookingPersonWriteFields`).
 */

export type LeaveLinkTarget =
  | { reason: 'id'; id: string; key: string; value: string }
  | { reason: 'email' | 'blank'; id: ''; key: ''; value: string }

export function leaveLinkTarget(record: { userId?: string | null; operativeId?: string | null }): LeaveLinkTarget {
  const stored = (field: unknown) => (typeof field === 'string' ? field.trim() : '')
  const value = stored(record.userId) || stored(record.operativeId)
  if (!value) return { reason: 'blank', id: '', key: '', value: '' }
  if (value.includes('@')) return { reason: 'email', id: '', key: '', value }
  return { reason: 'id', id: value, key: value.toLowerCase(), value }
}
