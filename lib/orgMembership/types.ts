export type OrgMembershipStatus = 'pending' | 'active'

export type OrgMembership = {
  organizationId: string
  organizationName: string
  role: string
  status: OrgMembershipStatus
  invitedAt: Date
  acceptedAt?: Date
}

export type UserOrgMembershipRecord = {
  organizationId: string
  role: string
  status: OrgMembershipStatus
  permissions?: Record<string, boolean>
  invitedAt: Date
  acceptedAt?: Date
}
