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
  assignedManagerUserId?: string
  dayRate?: number
  tradeTypePreset?: string
  tradeTypeCustom?: string
  employmentType?: 'paye' | 'selfEmployed'
  timesheetsEnabled?: boolean
  vatNumber?: string
  utrNumber?: string
  annualLeaveEnabled?: boolean
  annualLeaveDaysPerYear?: number
  annualLeaveYearStartMonth?: number
  annualLeaveYearEndMonth?: number
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
    return inviteUserCore({ ...input, invitedBy } satisfies InviteUserCoreInput)
  },
}))
