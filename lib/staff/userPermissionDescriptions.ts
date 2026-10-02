import type { UserPermissions } from '@/types'

export type PermissionToggleDef = {
  key: keyof UserPermissions
  title: string
  description: string
}

export const OPERATIVE_PERMISSION_TOGGLES: PermissionToggleDef[] = [
  {
    key: 'materials',
    title: 'Materials',
    description:
      'Can access material lists in projects and small works. They will not be able to send quotes or place orders.',
  },
  {
    key: 'siteAudit',
    title: 'Site audit',
    description: 'Can view and submit site audits.',
  },
]

export const ADMIN_ACCESS_LOCKED_MESSAGE =
  'Change user type at the bottom of their profile, to enable admin level access.'

export const MANAGER_PERMISSION_TOGGLES: PermissionToggleDef[] = [
  {
    key: 'adminAccess',
    title: 'Admin access',
    description: 'Gives Manage Users.',
  },
  {
    key: 'projects',
    title: 'Projects',
    description: 'Can create, edit, and add projects. Off hides that capability. They may still see assigned jobs.',
  },
  {
    key: 'smallWorks',
    title: 'Small works',
    description: 'Can create, edit, and add small works. Off hides that capability. They may still see assigned jobs.',
  },
  {
    key: 'operatives',
    title: 'Operatives',
    description:
      'Can see the Operatives page and add a new operative-only user. Off hides that page. They can still book active operatives on projects and small works.',
  },
  {
    key: 'qualifications',
    title: 'Qualifications',
    description:
      'Can add and manage the organisation qualifications list. Off means they cannot manage that list. It does not delete stored qualifications.',
  },
  {
    key: 'subContractors',
    title: 'Sub contractors',
    description:
      'Can add and manage sub contractors. If unselected they can still book sub contractors in, but not manage their records.',
  },
  {
    key: 'weeklyReports',
    title: 'Weekly report',
    description: 'Can view and use the page. Off means the page is not shown.',
  },
  {
    key: 'dailyOverview',
    title: 'Daily overview',
    description: 'Can view and use the page. Off means the page is not shown.',
  },
  {
    key: 'annualLeaveSelfBook',
    title: 'Annual Leave Management',
    description:
      'On means they book their own leave without a request. Off means they must request and it goes to the line manager.',
  },
  {
    key: 'wholesalersOrderHistory',
    title: 'Wholesalers',
    description: 'Can view and manage the wholesalers page. Off means the page is not available.',
  },
]
