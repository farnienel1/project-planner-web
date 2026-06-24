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
  {
    key: 'wholesalersOrderHistory',
    title: 'Wholesalers (order & quote history)',
    description: 'Can view wholesaler order and quote history.',
  },
]

export const MANAGER_PERMISSION_TOGGLES: PermissionToggleDef[] = [
  {
    key: 'adminAccess',
    title: 'Admin access',
    description: 'Can add and manage users.',
  },
  {
    key: 'projects',
    title: 'Projects',
    description:
      'Can create and manage projects. If unselected, this manager can still schedule operatives and sub contractors.',
  },
  {
    key: 'smallWorks',
    title: 'Small works',
    description:
      'Can create and manage small works. If unselected, this manager can still schedule operatives and sub contractors.',
  },
  {
    key: 'operatives',
    title: 'Operatives',
    description:
      'Can manage operatives and view their details. If turned off, they can still assign operatives to projects and small works, but will not see full operative profiles.',
  },
  {
    key: 'skills',
    title: 'Skills',
    description: 'Can create and alter existing skills.',
  },
  {
    key: 'qualifications',
    title: 'Qualifications',
    description: 'Can create and alter existing qualifications.',
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
    description: 'Can open and pull weekly reports.',
  },
  {
    key: 'dailyOverview',
    title: 'Daily overview',
    description: 'Can open daily overview from the home screen and menus.',
  },
  {
    key: 'annualLeaveSelfBook',
    title: 'Annual leave',
    description: 'Can book their own annual leave. If off, this manager requests leave for approval.',
  },
  {
    key: 'materials',
    title: 'Materials',
    description: 'Can access material lists in projects and small works.',
  },
  {
    key: 'siteAudit',
    title: 'Site audit',
    description: 'Can view and submit site audits.',
  },
]
