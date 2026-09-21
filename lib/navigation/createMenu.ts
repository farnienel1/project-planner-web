/**
 * Shell "+ New" menu. Operatives see nothing. Managers only see items they
 * can create. Admins see the full list.
 */

import type { PermissionUser } from '@/lib/permissions'
import {
  canAccessWholesalers,
  canInviteOperatives,
  canManageJobTypes,
  canManageMaterialCatalogue,
  canManageOrganisationQualifications,
  canManageSubcontractors,
  canManageWorkCatalogue,
  canViewClients,
  isOperativeMode,
} from '@/lib/permissions'

export type CreateMenuItem = {
  id: string
  label: string
  href: string
}

export const CREATE_MENU_CATALOG: CreateMenuItem[] = [
  { id: 'project', label: 'Project', href: '/dashboard/projects/new' },
  { id: 'small-works', label: 'Small Works', href: '/dashboard/small-works/new' },
  { id: 'user', label: 'User', href: '/dashboard/settings/users/new' },
  { id: 'client', label: 'Client', href: '/dashboard/clients?new=1' },
  { id: 'qualification', label: 'Qualification', href: '/dashboard/qualifications?new=1' },
  { id: 'job-type', label: 'Job Type', href: '/dashboard/job-types?new=1' },
  { id: 'sub-contractor', label: 'Sub Contractor', href: '/dashboard/sub-contractors?new=1' },
  { id: 'wholesaler', label: 'Wholesaler', href: '/dashboard/wholesalers?new=1' },
  { id: 'material', label: 'Material', href: '/dashboard/materials?new=1' },
]

export function canCreateMenuItem(user: PermissionUser, id: string): boolean {
  if (!user || isOperativeMode(user)) return false
  switch (id) {
    case 'project':
      return canManageWorkCatalogue(user, 'projects')
    case 'small-works':
      return canManageWorkCatalogue(user, 'smallWorks')
    case 'user':
      return canInviteOperatives(user)
    case 'client':
      return canViewClients(user)
    case 'qualification':
      return canManageOrganisationQualifications(user)
    case 'job-type':
      return canManageJobTypes(user)
    case 'sub-contractor':
      return canManageSubcontractors(user)
    case 'wholesaler':
      return canAccessWholesalers(user)
    case 'material':
      return canManageMaterialCatalogue(user)
    default:
      return false
  }
}

export function createMenuItems(user: PermissionUser): CreateMenuItem[] {
  if (!user || isOperativeMode(user)) return []
  return CREATE_MENU_CATALOG.filter((item) => canCreateMenuItem(user, item.id))
}

/** Open the in-page create sheet when arriving from + New (`?new=1`). */
export function consumeCreateQuery(): boolean {
  if (typeof window === 'undefined') return false
  const url = new URL(window.location.href)
  if (url.searchParams.get('new') !== '1') return false
  url.searchParams.delete('new')
  const search = url.searchParams.toString()
  window.history.replaceState(null, '', `${url.pathname}${search ? `?${search}` : ''}${url.hash}`)
  return true
}
