'use client'

import { create } from 'zustand'
import { auth } from '@/lib/firebase/config'
import type { UserPermissions } from '@/types'
import { inviteUserCore, type InviteUserCoreInput } from '@/lib/orgSetup/inviteUserCore'

export type InviteUserInput = {
  email: string
  organizationId: string
  organizationName?: string
  firstName: string
  surname: string
  mobileNumber?: string
  permissions: UserPermissions
  /** Rulebook 1.11.0: the Add User level, stored on the invitation (`invitationCreateFields` `role`). */
  role?: 'admin' | 'manager' | 'operative'
  assignedManagerUserId?: string
  assignedManagerUserIds?: string[]
  dayRate?: number
  hourlyRate?: number
  payBasis?: 'day' | 'hourly'
  tradeTypePreset?: string
  tradeTypeCustom?: string
  employmentType?: 'paye' | 'self_employed' | 'selfEmployed'
  timesheetsEnabled?: boolean
  vatNumber?: string
  utrNumber?: string
  annualLeaveEnabled?: boolean
  annualLeaveDaysPerYear?: number
  annualLeaveYearStartMonth?: number
  annualLeaveYearEndMonth?: number
  annualLeaveCarriesOver?: boolean
  annualLeaveYearAllowance?: number
  annualLeaveYearAllowanceKey?: string
  hasNoLineManager?: boolean
}

interface InviteState {
  saving: boolean
  error: string | null
  inviteUser: (input: InviteUserInput) => Promise<{ invitationId: string; userId: string; inviteType: 'new_user' | 'existing_user_org_add' }>
}

export const useInviteStore = create<InviteState>(() => ({
  saving: false,
  error: null,

  inviteUser: async (input) => {
    const invitedBy = auth.currentUser?.uid || ''
    const result = await inviteUserCore({ ...input, invitedBy } satisfies InviteUserCoreInput)
    // Rulebook 1.31.0 §13 (owner decision 7): the admins hear that an operative was added (`operative_created`,
    // company activity, never the actor) — by an admin or by a manager with the Operatives permission. Best effort.
    const operative = input.role === 'operative' || (input.role == null && input.permissions.operativeMode === true)
    if (operative && result.inviteType === 'new_user') {
      void (async () => {
        const [{ notifyCompanyActivity }, { useAuthStore }, { useOrgUserStore }] = await Promise.all([
          import('@/lib/notifications/companyActivity'),
          import('@/lib/stores/authStore'),
          import('@/lib/stores/siteAuditStore'),
        ])
        const name = `${input.firstName} ${input.surname}`.trim() || input.email
        await notifyCompanyActivity({
          organizationId: input.organizationId,
          type: 'operative_created',
          title: 'Operative added',
          message: `${name} was added as an operative.`,
          relatedId: result.userId,
          actor: useAuthStore.getState().user,
          users: useOrgUserStore.getState().users,
        })
      })().catch((error) => console.warn('[inviteStore] operative_created notice skipped', error))
    }
    return result
  },
}))
