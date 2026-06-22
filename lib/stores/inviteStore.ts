'use client'

import { create } from 'zustand'
import { auth } from '@/lib/firebase/config'
import type { UserPermissions } from '@/types'
import { inviteUserCore, type InviteUserCoreInput } from '@/lib/orgSetup/inviteUserCore'

export type InviteUserInput = {
  email: string
  organizationId: string
  firstName: string
  surname: string
  mobileNumber?: string
  permissions: UserPermissions
  assignedManagerUserId?: string
  dayRate?: number
  tradeTypePreset?: string
  tradeTypeCustom?: string
}

interface InviteState {
  saving: boolean
  error: string | null
  inviteUser: (input: InviteUserInput) => Promise<{ invitationId: string; userId: string }>
}

export const useInviteStore = create<InviteState>(() => ({
  saving: false,
  error: null,

  inviteUser: async (input) => {
    const invitedBy = auth.currentUser?.uid || ''
    return inviteUserCore({ ...input, invitedBy } satisfies InviteUserCoreInput)
  },
}))
