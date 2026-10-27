/**
 * Who receives the "New material order" inbox row (`material_order_placed`)
 * when a line is added to a job's material list: the active staff accounts
 * that are the managers assigned to that project or small works, never the
 * person who added the line. Admins are not added unless they are one of the
 * job's managers. iOS calls this through `MaterialOrderRecipientsRulebook`.
 *
 * A job's `managerIds` name rows of the organisation's managers list. An
 * account matches by id (own, former, or same-email alias) or by that managers
 * row's email.
 */

import { isStaffAccount, type StaffAccountRole } from './staffAccess'

export type MaterialOrderManagerRow = {
  id: string
  email?: string | null
}

export type MaterialOrderAccount = {
  id: string
  email?: string | null
  isActive?: boolean | null
  formerIds?: readonly string[] | null
  aliasIds?: readonly string[] | null
  role: StaffAccountRole
}

export type MaterialOrderRecipientsInput = {
  /** The project's or small works' `managerIds`. */
  jobManagerIds: readonly string[]
  managers: readonly MaterialOrderManagerRow[]
  accounts: readonly MaterialOrderAccount[]
  /** Every id of the person who added the line. */
  adderIds?: readonly string[] | null
}

export type MaterialOrderRecipientRow = {
  userId: string
}

function key(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function accountKeys(account: MaterialOrderAccount): string[] {
  return [account.id, ...(account.formerIds ?? []), ...(account.aliasIds ?? [])].map(key).filter(Boolean)
}

/** Account ids to notify, in account order, without duplicates. */
export function materialOrderRecipients(input: MaterialOrderRecipientsInput): MaterialOrderRecipientRow[] {
  const jobIds = new Set((input.jobManagerIds ?? []).map(key).filter(Boolean))
  if (jobIds.size === 0) return []
  const jobEmails = new Set(
    (input.managers ?? [])
      .filter((row) => jobIds.has(key(row.id)))
      .map((row) => key(row.email))
      .filter(Boolean)
  )
  const adder = new Set((input.adderIds ?? []).map(key).filter(Boolean))
  const seen = new Set<string>()
  const rows: MaterialOrderRecipientRow[] = []
  for (const account of input.accounts ?? []) {
    const id = key(account.id)
    if (!id || seen.has(id)) continue
    if (account.isActive === false || !isStaffAccount(account.role)) continue
    const ids = accountKeys(account)
    if (ids.some((value) => adder.has(value))) continue
    const named = ids.some((value) => jobIds.has(value)) || (key(account.email) !== '' && jobEmails.has(key(account.email)))
    if (!named) continue
    seen.add(id)
    rows.push({ userId: account.id })
  }
  return rows
}
