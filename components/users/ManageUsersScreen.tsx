'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { useUserStore } from '@/lib/stores/userStore'
import { useInviteStore } from '@/lib/stores/inviteStore'
import { canManageUsers, getManageUsersLabel } from '@/lib/navigation/menuPermissions'
import {
  classifyManageUsersTab,
  filterUsersForManageTabAndSegment,
  type ManageUsersTab,
} from '@/lib/staff/manageUsersUtils'
import { matchesRosterSegment, type RosterSegment } from '@/lib/staff/userRosterUtils'
import { displayTradeType } from '@/lib/staff/staffTradeTypes'
import type { User } from '@/types'

const ROLE_TABS: { tab: ManageUsersTab; label: string; section: string }[] = [
  { tab: 'admins', label: 'Admins', section: 'Administrators' },
  { tab: 'managers', label: 'Managers', section: 'Managers' },
  { tab: 'operatives', label: 'Operatives', section: 'Operatives' },
]

const SEGMENTS: { key: RosterSegment; title: string }[] = [
  { key: 'active', title: 'Active' },
  { key: 'inactive', title: 'Inactive' },
  { key: 'pending', title: 'Pending' },
]

function displayName(user: User): string {
  return `${user.firstName} ${user.surname}`.trim() || user.email
}

function initialsOf(user: User): string {
  const initials = `${user.firstName?.[0] ?? ''}${user.surname?.[0] ?? ''}`.toUpperCase()
  return initials.trim() || user.email.slice(0, 2).toUpperCase()
}

function avatarGradient(user: User): string {
  if (user.permissions.operativeMode) return 'from-[#16A34A] to-[#0D9488]'
  if (user.permissions.adminAccess || user.isSuperAdmin) return 'from-[#4F46E5] to-[#2563EB]'
  return 'from-[#2563EB] to-[#3B82F6]'
}

type Badge = { label: string; cls: string }

function badgesFor(user: User, showAdminBadge: boolean): Badge[] {
  const out: Badge[] = []
  if (user.isSuperAdmin || user.permissions.adminAccess) {
    out.push({ label: 'Administrator', cls: 'bg-[#FDECF1] text-[#E11D48]' })
  } else if (user.permissions.manager) {
    out.push({ label: 'Manager', cls: 'bg-[#E6F1FB] text-[#185FA5]' })
  } else if (user.permissions.operativeMode) {
    out.push({ label: 'Operative', cls: 'bg-[#E9F9EF] text-[#15A34A]' })
  }

  const trade = displayTradeType(user.tradeTypePreset, user.tradeTypeCustom)
  if (trade && trade !== '—') {
    out.push({ label: trade, cls: 'bg-[#F9F9FB] text-slate-500 ring-1 ring-slate-200' })
  }

  if (!user.isActive && user.passwordSet) {
    out.push({ label: 'Inactive', cls: 'bg-[#ECECEF] text-slate-500' })
  } else if (user.passwordSet) {
    out.push({ label: 'Verified', cls: 'bg-[#E9F9EF] text-[#15A34A]' })
  } else {
    out.push({ label: 'Pending invite', cls: 'bg-[#FFF5E6] text-[#E08600]' })
  }

  if (showAdminBadge && !out.some((badge) => badge.label === 'Administrator')) {
    out.unshift({ label: 'Admin', cls: 'bg-[#FDECF1] text-[#E11D48]' })
  }

  return out
}

export function ManageUsersScreen() {
  const router = useRouter()
  const { user: currentUser, organization } = useAuthStore()
  const { users, loadUsers } = useOrgUserStore()
  const { sendPasswordReset, deleteUser } = useUserStore()
  const { inviteUser } = useInviteStore()

  const [tab, setTab] = useState<ManageUsersTab>('admins')
  const [segment, setSegment] = useState<RosterSegment>('active')
  const [search, setSearch] = useState('')
  const [busyRow, setBusyRow] = useState<string | null>(null)
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<User | null>(null)

  const canManage = canManageUsers(currentUser)
  const title = getManageUsersLabel(currentUser, organization)

  useEffect(() => {
    if (organization?.id) loadUsers(organization.id)
  }, [organization?.id, loadUsers])

  useEffect(() => {
    setSegment('active')
    setSearch('')
  }, [tab])

  const effectiveTab: ManageUsersTab = canManage ? tab : 'operatives'
  const section = ROLE_TABS.find((item) => item.tab === effectiveTab)?.section ?? 'Users'

  const tabUsers = useMemo(
    () => users.filter((user) => classifyManageUsersTab(user) === effectiveTab),
    [users, effectiveTab]
  )

  const counts = useMemo(() => {
    const result: Record<RosterSegment, number> = { active: 0, inactive: 0, pending: 0 }
    for (const item of SEGMENTS) {
      result[item.key] = tabUsers.filter((user) => matchesRosterSegment(user, item.key)).length
    }
    return result
  }, [tabUsers])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = filterUsersForManageTabAndSegment(users, effectiveTab, segment)
    if (q) {
      list = list.filter(
        (user) => displayName(user).toLowerCase().includes(q) || user.email.toLowerCase().includes(q)
      )
    }
    return list.sort((a, b) => displayName(a).localeCompare(displayName(b)))
  }, [users, effectiveTab, segment, search])

  function flash(kind: 'success' | 'error', msg: string) {
    setToast({ kind, msg })
    window.setTimeout(() => setToast(null), 3000)
  }

  function selectUser(user: User) {
    router.push(`/dashboard/users/${user.id}?from=users`)
  }

  function canDeleteUser(user: User): boolean {
    if (user.id === currentUser?.id) return false
    if (user.isSuperAdmin && !currentUser?.isSuperAdmin) return false
    return canManage
  }

  async function sendReset(user: User) {
    setBusyRow(user.id)
    try {
      await sendPasswordReset(user.email)
      flash('success', `Password reset email sent to ${user.email}.`)
    } catch (error) {
      flash('error', error instanceof Error ? error.message : 'Failed to send password reset.')
    } finally {
      setBusyRow(null)
    }
  }

  async function resendInvite(user: User) {
    if (!organization?.id) return
    setBusyRow(user.id)
    try {
      await inviteUser({
        email: user.email,
        organizationId: organization.id,
        organizationName: organization.name,
        firstName: user.firstName,
        surname: user.surname,
        mobileNumber: user.mobileNumber,
        permissions: user.permissions,
        assignedManagerUserId: user.assignedManagerUserId,
        dayRate: user.dayRate,
        tradeTypePreset: user.tradeTypePreset,
        tradeTypeCustom: user.tradeTypeCustom,
      })
      flash('success', `Sign-up email sent to ${user.email}.`)
      loadUsers(organization.id)
    } catch (error) {
      flash('error', error instanceof Error ? error.message : 'Failed to send sign-up email.')
    } finally {
      setBusyRow(null)
    }
  }

  async function doDelete(user: User) {
    setConfirmDelete(null)
    setBusyRow(user.id)
    try {
      await deleteUser(user.id)
      if (organization?.id) loadUsers(organization.id)
      flash('success', `${displayName(user)} deleted.`)
    } catch (error) {
      flash('error', error instanceof Error ? error.message : 'Failed to delete user.')
    } finally {
      setBusyRow(null)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-1 pb-16 pt-2">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          <p className="text-sm text-slate-500">Roles, access and invitations for your organisation.</p>
        </div>
        {canManage && (
          <Link
            href="/dashboard/settings/users/new"
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            + Add user
          </Link>
        )}
      </div>

      {toast && (
        <div
          className={`mb-4 rounded-2xl border px-4 py-3 text-sm font-semibold ${
            toast.kind === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {canManage && (
        <div className="mb-3 inline-flex w-full rounded-xl bg-[#E9E9EC] p-0.5">
          {ROLE_TABS.map(({ tab: roleTab, label }) => (
            <button
              key={roleTab}
              type="button"
              onClick={() => setTab(roleTab)}
              className={`flex-1 rounded-[9px] px-4 py-2.5 text-sm font-semibold transition ${
                tab === roleTab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-700/80 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="mb-3 grid grid-cols-3 gap-2">
        {SEGMENTS.map(({ key, title: segmentTitle }) => {
          const selected = segment === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSegment(key)}
              className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                selected
                  ? 'border-blue-600 bg-blue-600 text-white shadow-[0_2px_8px_rgba(37,99,235,0.25)]'
                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
              }`}
            >
              {segmentTitle}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                  selected ? 'bg-white/25 text-white' : 'bg-black/[0.07] text-slate-600'
                }`}
              >
                {counts[key]}
              </span>
            </button>
          )
        })}
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-xl bg-[#E9E9EC] px-3 py-2.5">
        <svg className="h-4 w-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
          />
        </svg>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none"
        />
      </div>

      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{section}</span>
        {filtered.length > 0 && (
          <span className="text-xs text-slate-500">
            {filtered.length} {filtered.length === 1 ? 'person' : 'people'}
          </span>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-16 text-center">
          <p className="text-base font-semibold text-slate-600">
            No {segment} {section.toLowerCase()}
          </p>
          <p className="mt-1 max-w-xs text-sm text-slate-400">
            Try another filter or add someone new from Add user.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {filtered.map((user) => {
            const showAdmin =
              effectiveTab === 'managers' && (user.permissions.adminAccess || user.isSuperAdmin)
            const badgeList = badgesFor(user, !!showAdmin)
            const showReset = user.passwordSet
            const isMgrOrOp =
              (user.permissions.manager || user.permissions.operativeMode) &&
              !user.permissions.adminAccess &&
              !user.isSuperAdmin
            const showInvite = !user.passwordSet && isMgrOrOp
            const busy = busyRow === user.id

            return (
              <div
                key={user.id}
                className="group relative rounded-2xl border border-black/[0.04] bg-white p-4 shadow-sm transition hover:shadow-md"
              >
                <button type="button" onClick={() => selectUser(user)} className="flex w-full items-center gap-3 text-left">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br ${avatarGradient(
                      user
                    )} text-base font-bold text-white`}
                  >
                    {initialsOf(user)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-bold text-slate-900">{displayName(user)}</div>
                    <div className="truncate text-sm text-slate-500">{user.email}</div>
                  </div>
                  <svg
                    className="h-4 w-4 shrink-0 text-slate-300"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                </button>

                {badgeList.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {badgeList.map((badge, index) => (
                      <span key={index} className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${badge.cls}`}>
                        {badge.label}
                      </span>
                    ))}
                  </div>
                )}

                {canManage && (
                  <div className="absolute right-14 top-4 flex items-center gap-2">
                    {showReset && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => sendReset(user)}
                        title="Send password reset email"
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EEEDFE] text-[#534AB7] hover:brightness-95 disabled:opacity-50"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M15.75 1.5a6.75 6.75 0 0 0-6.651 7.906c.067.39-.032.717-.221.906l-6.5 6.499a3 3 0 0 0-.878 2.121v2.818c0 .414.336.75.75.75H6a.75.75 0 0 0 .75-.75v-1.5h1.5A.75.75 0 0 0 9 19.5V18h1.5a.75.75 0 0 0 .53-.22l2.658-2.658c.19-.189.517-.288.906-.22A6.75 6.75 0 1 0 15.75 1.5Zm0 3a.75.75 0 0 0 0 1.5A2.25 2.25 0 0 1 18 8.25a.75.75 0 0 0 1.5 0 3.75 3.75 0 0 0-3.75-3.75Z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    )}
                    {showInvite && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => resendInvite(user)}
                        title="Resend sign-up email"
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E6F1FB] text-[#2563EB] hover:brightness-95 disabled:opacity-50"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M1.5 8.67v8.58a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3V8.67l-8.928 5.493a3 3 0 0 1-3.144 0L1.5 8.67Z" />
                          <path d="M22.5 6.908V6.75a3 3 0 0 0-3-3h-15a3 3 0 0 0-3 3v.158l9.714 5.978a1.5 1.5 0 0 0 1.572 0L22.5 6.908Z" />
                        </svg>
                      </button>
                    )}
                    {canDeleteUser(user) && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setConfirmDelete(user)}
                        title="Delete user"
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600 opacity-0 transition hover:bg-red-100 group-hover:opacity-100 disabled:opacity-50"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setConfirmDelete(null)}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900">Delete user</h2>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to delete {displayName(confirmDelete)}? This action cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => doDelete(confirmDelete)}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
