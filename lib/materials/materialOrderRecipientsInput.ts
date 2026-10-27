/**
 * Input for the rulebook's `materialOrderRecipients` and the inbox copy for a
 * new material line, from web types. No Firebase here, so it is testable.
 */

import { type MaterialOrderRecipientsInput } from '@/lib/canonical'
import { staffAccountRole } from '@/lib/permissions'
import type { Manager, Project, User } from '@/types'

function emailKey(value?: string | null): string {
  return (value || '').trim().toLowerCase()
}

export const MATERIAL_ORDER_PLACED_TYPE = 'material_order_placed'

/** The rulebook input: the job's `managerIds`, the managers rows, this organisation's accounts, and every id of the adder. */
export function materialOrderRecipientsInput(params: {
  project: Pick<Project, 'managerIds'>
  managers: ReadonlyArray<Pick<Manager, 'id' | 'email'>>
  users: readonly User[]
  adder: Pick<User, 'id' | 'email' | 'formerUserIds'>
}): MaterialOrderRecipientsInput {
  const sameEmail = (user: Pick<User, 'id' | 'email'>) => {
    const key = emailKey(user.email)
    return key ? params.users.filter((row) => row.id !== user.id && emailKey(row.email) === key).map((row) => row.id) : []
  }
  return {
    jobManagerIds: params.project.managerIds ?? [],
    managers: params.managers.map((row) => ({ id: row.id, email: row.email })),
    accounts: params.users.map((user) => ({
      id: user.id,
      email: user.email,
      isActive: user.isActive !== false,
      formerIds: user.formerUserIds ?? [],
      aliasIds: sameEmail(user),
      role: staffAccountRole(user),
    })),
    adderIds: [params.adder.id, ...(params.adder.formerUserIds ?? []), ...sameEmail(params.adder)],
  }
}

/** Same title and message as iOS: "<adder> added <material> on <site>." */
export function materialOrderPlacedCopy(params: { addedByName: string; materialName: string; siteName: string }) {
  const material = params.materialName.trim() || 'a material'
  return {
    title: 'Material added',
    message: `${params.addedByName} added ${material} on ${params.siteName}.`,
  }
}

