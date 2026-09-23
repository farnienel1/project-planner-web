export type PlatformOrganisation = {
  id: string
  name: string
  memberCount: number
  createdAt?: Date
  updatedAt?: Date
  unfinishedSetup?: boolean
  isInternal?: boolean
  billing?: import('@/lib/stripe/billing').OrgBilling | null
}
