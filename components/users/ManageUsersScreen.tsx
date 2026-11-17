'use client'

import { PAY_RATE_REQUIRED_MESSAGE, ghostBadgeLabel, isGhostUser } from '@/lib/canonical'
import { usersWithoutPayRate } from '@/lib/staff/payRateRequired'
import { useEffect, useMemo, useState } from 'react'
import { usePendingNavigation } from '@/lib/navigation/usePendingNavigation'
import { PendingSpinner } from '@/components/shell/PendingSpinner'
import Link from 'next/link'
import { useAuthStore } from '@/lib/stores/authStore'
import { resendInvitationEmail } from '@/lib/orgSetup/resendInvitation'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { useUserStore } from '@/lib/stores/userStore'
import { canManageUsers, getAddUserLabel, getManageUsersLabel, manageUsersAddButtonShown } from '@/lib/navigation/menuPermissions'
import {
  filterUsersForManageTab,
  filterUsersForManageTabAndSegment,
  manageUsersListPhase,
  type ManageUsersTab,
} from '@/lib/staff/manageUsersUtils'
import {
  filterRosterByNameQuery,
  getOperativeModeUsers,
  matchesRosterSegment,
  type RosterSegment,
} from '@/lib/staff/userRosterUtils'
import { displayTradeType } from '@/lib/staff/staffTradeTypes'
import type { User } from '@/types'
import { UserAvatar } from '@/components/users/UserAvatar'
import { ChevronRightIcon, EnvelopeIcon, KeyIcon, MagnifyingGlassIcon, PlusIcon, UserGroupIcon } from '@heroicons/react/24/solid'
import {
  Card,
  Chip,
  DataTable,
  EmptyState,
  IconTile,
  Note,
  PageBand,
  PageShell,
  SegmentedTabs,
  type PuTone,
} from '@/components/ui/page'
import { staffAccountRole } from '@/lib/permissions'
import { usersWithoutRequiredLineManager } from '@/lib/annualLeave/holidayApprovalUtils'
import { accountTypeSyncState } from '@/lib/canonical/permissionLevels'
import { accountTypeSubject } from '@/lib/staff/accountTypeChange'
import { useOrganizationDocument } from '@/lib/stores/organizationDocumentStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { findOperativeForUser } from '@/lib/operatives/operativeRosterUtils'

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

/** A person's profile, opened from Manage users or the Operatives page (Back returns to the page it came from). */
function userHref(user: User, from: 'users' | 'operatives'): string {
  return `/dashboard/users/${user.id}?from=${from}`
}

/**
 * Which list the screen shows:
 *   - `all`: Manage users at `/dashboard/settings/users` (admins; Admins / Managers / Operatives tabs).
 *   - `operatives`: the one Operatives page at `/dashboard/operatives` (admins and Operatives managers). Its rows are
 *     the rulebook's Operatives list (`rosterListFor('operatives')` via `getOperativeModeUsers`), searched by name,
 *     email or phone, exactly as the old Operatives list was.
 */
export type ManageUsersScope = 'all' | 'operatives'

function displayName(user: User): string {
  return `${user.firstName} ${user.surname}`.trim() || user.email
}

function avatarGradient(user: User): string {
  if (user.isSuperAdmin || user.permissions.adminAccess || user.role === 'admin') return 'from-[#4F46E5] to-[#2563EB]'
  if (user.permissions.operativeMode) return 'from-[#16A34A] to-[#0D9488]'
  return 'from-[#2563EB] to-[#3B82F6]'
}

type BadgeKind = 'role' | 'trade' | 'status'
type Badge = { label: string; tone: PuTone; kind: BadgeKind }

function badgesFor(user: User, showAdminBadge: boolean): Badge[] {
  const out: Badge[] = []
  if (user.isSuperAdmin) {
    out.push({ label: 'Super Admin', tone: 'amber', kind: 'role' })
  } else if (user.permissions.adminAccess) {
    out.push({ label: 'Administrator', tone: 'purple', kind: 'role' })
  } else if (user.permissions.manager) {
    out.push({ label: 'Manager', tone: 'blue', kind: 'role' })
  } else if (user.permissions.operativeMode) {
    out.push({ label: 'Operative', tone: 'green', kind: 'role' })
  }

  const trade = displayTradeType(user.tradeTypePreset, user.tradeTypeCustom)
  if (trade && trade !== '—') {
    out.push({ label: trade, tone: 'outline', kind: 'trade' })
  }

  if (isGhostUser(user)) {
    // Rulebook 1.34.0 `ghostBadgeLabel`: "No app login" (· Invited once an admin gave app access).
    out.push({ label: ghostBadgeLabel(user), tone: 'slate', kind: 'status' })
    if (!user.isActive) out.push({ label: 'Inactive', tone: 'slate', kind: 'status' })
  } else if (!user.isActive && user.passwordSet) {
    out.push({ label: 'Inactive', tone: 'slate', kind: 'status' })
  } else if (user.passwordSet) {
    out.push({ label: 'Verified', tone: 'green', kind: 'status' })
  } else {
    out.push({ label: 'Pending invite', tone: 'amber', kind: 'status' })
  }

  if (showAdminBadge && !out.some((badge) => badge.label === 'Administrator')) {
    out.unshift({ label: 'Admin', tone: 'purple', kind: 'role' })
  }

  return out
}

function BadgeCell({ badges, kind }: { badges: Badge[]; kind: BadgeKind }) {
  const shown = badges.filter((badge) => badge.kind === kind)
  if (shown.length === 0) return <span className="pu-muted">—</span>
  return (
    <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {shown.map((badge, index) => (
        <Chip key={index} tone={badge.tone}>
          {badge.label}
        </Chip>
      ))}
    </span>
  )
}

function PeopleNotice({
  title,
  detail,
  people,
  onOpen,
}: {
  title: string
  detail: string
  people: User[]
  onOpen: (user: User) => void
}) {
  return (
    <Note tone="amber">
      <b>{title}</b>
      <span style={{ display: 'block', fontSize: 12.5, marginTop: 2 }}>{detail}</span>
      <span style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: 6 }}>
        {people.map((user) => (
          <button key={user.id} type="button" onClick={() => onOpen(user)} className="pu-link" style={{ color: 'inherit' }}>
            {displayName(user)}
          </button>
        ))}
      </span>
    </Note>
  )
}

export function ManageUsersScreen({ scope = 'all' }: { scope?: ManageUsersScope } = {}) {
  const { navigate: navigateTo, prefetch, pendingHref } = usePendingNavigation()
  const { user: currentUser, organization } = useAuthStore()
  const { users, error: rosterError, rosterLoadedOrgId, claimedEmails, loadUsers } = useOrgUserStore()
  const { sendPasswordReset } = useUserStore()
  const operativesScope = scope === 'operatives'
  const { operatives, loadOperatives } = useOperativeStore()
  const from = operativesScope ? 'operatives' : 'users'

  const [tab, setTab] = useState<ManageUsersTab>('admins')
  const [segment, setSegment] = useState<RosterSegment>('active')
  const [search, setSearch] = useState('')
  const [busyRow, setBusyRow] = useState<string | null>(null)
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null)

  const canManage = canManageUsers(currentUser)
  // The role tabs are Manage users (admins) only; the Operatives page is one list.
  const showRoleTabs = canManage && !operativesScope
  const title = operativesScope ? 'Manage operatives' : getManageUsersLabel(currentUser, organization)
  const addLabel = getAddUserLabel(currentUser)
  const canAdd = manageUsersAddButtonShown(scope, currentUser)

  const [rosterAttempt, setRosterAttempt] = useState(0)

  useEffect(() => {
    if (organization?.id) loadUsers(organization.id)
  }, [organization?.id, loadUsers])

  // The Operatives page searches phone numbers too (the `operatives` row's phone, else the account's mobile).
  useEffect(() => {
    if (operativesScope && organization?.id) loadOperatives(organization.id)
  }, [operativesScope, organization?.id, loadOperatives])

  useEffect(() => {
    if (!organization?.id) return
    if (users.length > 0) return
    // Still waiting on the first read. A settled empty list, or an error, is retried.
    if (rosterLoadedOrgId !== organization.id && !rosterError) return
    if (rosterAttempt >= 4) return
    const timer = window.setTimeout(() => {
      setRosterAttempt((attempt) => attempt + 1)
      void loadUsers(organization.id, { force: true })
    }, 500)
    return () => window.clearTimeout(timer)
  }, [organization?.id, users.length, rosterLoadedOrgId, rosterError, rosterAttempt, loadUsers])

  useEffect(() => {
    setSegment('active')
    setSearch('')
  }, [tab])

  const effectiveTab: ManageUsersTab = showRoleTabs ? tab : 'operatives'
  const section = ROLE_TABS.find((item) => item.tab === effectiveTab)?.section ?? 'Users'

  const tabUsers = useMemo(
    () =>
      operativesScope
        ? getOperativeModeUsers(users, claimedEmails)
        : filterUsersForManageTab(users, effectiveTab, claimedEmails),
    [operativesScope, users, effectiveTab, claimedEmails]
  )
  const phones = useMemo(() => {
    const map: Record<string, string> = {}
    if (!operativesScope) return map
    for (const row of tabUsers) {
      const op = findOperativeForUser(row, operatives)
      map[row.id] = op?.phone || row.mobileNumber || ''
    }
    return map
  }, [operativesScope, tabUsers, operatives])

  const counts = useMemo(() => {
    const result: Record<RosterSegment, number> = { active: 0, inactive: 0, pending: 0 }
    for (const item of SEGMENTS) {
      result[item.key] = tabUsers.filter((user) => matchesRosterSegment(user, item.key)).length
    }
    return result
  }, [tabUsers])

  const filtered = useMemo(() => {
    if (operativesScope) {
      const bySegment = tabUsers.filter((user) => matchesRosterSegment(user, segment))
      return filterRosterByNameQuery(bySegment, search, phones).sort((a, b) => displayName(a).localeCompare(displayName(b)))
    }
    const q = search.trim().toLowerCase()
    let list = filterUsersForManageTabAndSegment(users, effectiveTab, segment, claimedEmails)
    if (q) {
      list = list.filter(
        (user) => displayName(user).toLowerCase().includes(q) || user.email.toLowerCase().includes(q)
      )
    }
    return list.sort((a, b) => displayName(a).localeCompare(displayName(b)))
  }, [operativesScope, tabUsers, phones, users, effectiveTab, segment, search, claimedEmails])

  // `usersMissingLineManager`: active people saved before the line-manager rule who still need one. Admins only.
  const viewerRole = staffAccountRole(currentUser)
  const isAdminViewer = (viewerRole.isAdmin || viewerRole.isSuperAdmin) && !viewerRole.isOperativeMode
  // Rulebook 1.12.2 `accountTypeSyncState`: people whose user type was only partly saved (users document vs
  // `members.{uid}`). Opening the person and pressing Save finishes it.
  const liveOrganization = useOrganizationDocument()
  const liveMembers =
    liveOrganization.loaded && liveOrganization.data && typeof liveOrganization.data.members === 'object'
      ? (liveOrganization.data.members as Record<string, unknown>)
      : null
  const typeOutOfSync = useMemo(
    () =>
      isAdminViewer && liveMembers && organization?.id
        ? users.filter(
            (user) =>
              matchesRosterSegment(user, 'active') &&
              !accountTypeSyncState({ person: accountTypeSubject(user), organizationId: organization.id, members: liveMembers }).inSync
          )
        : [],
    [isAdminViewer, liveMembers, organization?.id, users]
  )
  const missingLineManager = useMemo(
    () =>
      isAdminViewer
        ? usersWithoutRequiredLineManager(users).filter((user) => matchesRosterSegment(user, 'active'))
        : [],
    [isAdminViewer, users]
  )

  // Rulebook 1.14.0 `usersMissingPayRate`: active self-employed people saved before the pay-rate rule with no rate.
  const missingPayRate = useMemo(
    () => (isAdminViewer ? usersWithoutPayRate(users).filter((user) => matchesRosterSegment(user, 'active')) : []),
    [isAdminViewer, users]
  )

  const listPhase = manageUsersListPhase({
    organizationId: organization?.id,
    rosterLoadedOrgId,
    userCount: users.length,
    filteredCount: filtered.length,
    error: rosterError,
  })

  function flash(kind: 'success' | 'error', msg: string) {
    setToast({ kind, msg })
    window.setTimeout(() => setToast(null), 3000)
  }

  function selectUser(user: User) {
    navigateTo(userHref(user, from))
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
      // Sends the existing invitation again (as iOS); never re-runs Add User or rewrites the placeholder.
      await resendInvitationEmail({
        organizationId: organization.id,
        organizationName: organization.name || '',
        person: user,
        actor: currentUser,
      })
      flash('success', `Sign-up email sent to ${user.email}.`)
    } catch (error) {
      flash('error', error instanceof Error ? error.message : 'Failed to send sign-up email.')
    } finally {
      setBusyRow(null)
    }
  }

  return (
    <PageShell className="pb-16">
      <PageBand
        eyebrow="Team"
        title={title}
        subtitle={
          operativesScope
            ? 'Your field team: details, trades and invitations.'
            : 'Roles, access and invitations for your organisation.'
        }
        actions={
          canAdd ? (
            <Link href="/dashboard/settings/users/new" className="pu-btn white">
              <PlusIcon width={16} height={16} aria-hidden="true" />
              {addLabel}
            </Link>
          ) : undefined
        }
      >
        {showRoleTabs ? (
          <SegmentedTabs
            dark
            ariaLabel="User level"
            items={ROLE_TABS.map(({ tab: roleTab, label }) => ({ id: roleTab, label }))}
            value={tab}
            onChange={setTab}
          />
        ) : null}
      </PageBand>

      {toast ? (
        <Note tone={toast.kind === 'success' ? 'green' : 'red'} role="status">
          <b>{toast.msg}</b>
        </Note>
      ) : null}

      {typeOutOfSync.length > 0 ? (
        <PeopleNotice
          title={
            typeOutOfSync.length === 1
              ? "1 person's user type was only partly saved"
              : `${typeOutOfSync.length} people's user type was only partly saved`
          }
          detail="Open the person and press Save to finish it on every record."
          people={typeOutOfSync}
          onOpen={selectUser}
        />
      ) : null}

      {missingLineManager.length > 0 ? (
        <PeopleNotice
          title={
            missingLineManager.length === 1
              ? '1 person needs a line manager'
              : `${missingLineManager.length} people need a line manager`
          }
          detail="Every operative and manager needs a line manager, and so does an admin unless Annual Leave Management and Timesheet self-sign are both on (PAYE: Annual Leave Management). Until fixed, their timesheets and annual leave requests go to the other admins."
          people={missingLineManager}
          onOpen={selectUser}
        />
      ) : null}

      {missingPayRate.length > 0 ? (
        <PeopleNotice
          title={
            missingPayRate.length === 1
              ? '1 self-employed person needs a pay rate'
              : `${missingPayRate.length} self-employed people need a pay rate`
          }
          detail={PAY_RATE_REQUIRED_MESSAGE}
          people={missingPayRate}
          onOpen={selectUser}
        />
      ) : null}

      <Card
        title={<span className="pu-label">{section}</span>}
        count={filtered.length > 0 ? `${filtered.length} ${filtered.length === 1 ? 'person' : 'people'}` : undefined}
      >
        <div className="pu-toolbar">
          <SegmentedTabs
            ariaLabel="Status"
            items={SEGMENTS.map(({ key, title: segmentTitle }) => ({
              id: key,
              label: segmentTitle,
              count: listPhase !== 'loading' ? counts[key] : undefined,
            }))}
            value={segment}
            onChange={setSegment}
          />
          <label className="pu-field">
            <MagnifyingGlassIcon width={16} height={16} aria-hidden="true" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label={
                effectiveTab === 'admins'
                  ? 'Search admins by name'
                  : effectiveTab === 'managers'
                    ? 'Search managers by name'
                    : 'Search operatives by name'
              }
              placeholder={
                effectiveTab === 'admins'
                  ? 'Search admins by name'
                  : effectiveTab === 'managers'
                    ? 'Search managers by name'
                    : 'Search operatives by name'
              }
            />
          </label>
        </div>

        {listPhase === 'loading' ? (
          <EmptyState title="Loading users..." />
        ) : listPhase === 'error' ? (
          <EmptyState title="Could not load users" description={rosterError ?? undefined} />
        ) : listPhase === 'empty' ? (
          <EmptyState
            tile={<IconTile tone="slate" size="lg"><UserGroupIcon /></IconTile>}
            title={`No ${segment} ${section.toLowerCase()}`}
            description={canAdd ? `Try another filter or add someone new from ${addLabel}.` : 'Try another filter.'}
          />
        ) : (
          <DataTable
            columns={[
              { key: 'user', label: 'User' },
              { key: 'role', label: 'Role' },
              { key: 'trade', label: 'Trade' },
              { key: 'status', label: 'Status' },
              { key: 'actions', label: 'Actions', align: 'right' },
            ]}
          >
            {filtered.map((user) => {
              const showAdmin =
                effectiveTab === 'managers' && (user.permissions.adminAccess || user.isSuperAdmin)
              const badgeList = badgesFor(user, !!showAdmin)
              // Rulebook 1.34.0: a ghost has no login — no password reset or sign-up email (Give app access is on its profile).
              const isGhost = isGhostUser(user)
              const showReset = user.passwordSet && !isGhost
              const isMgrOrOp =
                (user.permissions.manager || user.permissions.operativeMode) &&
                !user.permissions.adminAccess &&
                !user.isSuperAdmin
              const showInvite = !user.passwordSet && isMgrOrOp && !isGhost
              const busy = busyRow === user.id

              return (
                <tr
                  key={user.id}
                  className="click"
                  onClick={() => selectUser(user)}
                  onPointerEnter={() => prefetch(userHref(user, from))}
                  aria-busy={pendingHref === userHref(user, from) || undefined}
                >
                  <td>
                    <span className="pu-who">
                      <UserAvatar user={user} size={36} className="rounded-full" gradient={avatarGradient(user)} />
                      <span style={{ minWidth: 0 }}>
                        <button
                          type="button"
                          className="pu-rowbtn"
                          onFocus={() => prefetch(userHref(user, from))}
                          onClick={(event) => {
                            event.stopPropagation()
                            selectUser(user)
                          }}
                        >
                          <b className="truncate">{displayName(user)}</b>
                        </button>
                        <small className="truncate">{user.email || ghostBadgeLabel(user)}</small>
                      </span>
                    </span>
                  </td>
                  <td>
                    <BadgeCell badges={badgeList} kind="role" />
                  </td>
                  <td>
                    <BadgeCell badges={badgeList} kind="trade" />
                  </td>
                  <td>
                    <BadgeCell badges={badgeList} kind="status" />
                  </td>
                  <td className="actions">
                    <span style={{ display: 'inline-flex', gap: 6 }} onClick={(event) => event.stopPropagation()}>
                      {canManage && showReset ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => sendReset(user)}
                          title="Send password reset email"
                          aria-label={`Send password reset email to ${displayName(user)}`}
                          className="pu-btn icon sm"
                        >
                          <KeyIcon width={16} height={16} aria-hidden="true" />
                        </button>
                      ) : null}
                      {canManage && showInvite ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => resendInvite(user)}
                          title="Resend sign-up email with verification code"
                          aria-label={`Resend sign-up email with verification code to ${displayName(user)}`}
                          className="pu-btn icon sm"
                        >
                          <EnvelopeIcon width={16} height={16} aria-hidden="true" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => selectUser(user)}
                        onFocus={() => prefetch(userHref(user, from))}
                        aria-label={`Open ${displayName(user)}`}
                        aria-busy={pendingHref === userHref(user, from) || undefined}
                        className="pu-btn icon sm"
                      >
                        {pendingHref === userHref(user, from) ? (
                          <PendingSpinner />
                        ) : (
                          <ChevronRightIcon width={16} height={16} aria-hidden="true" />
                        )}
                      </button>
                    </span>
                  </td>
                </tr>
              )
            })}
          </DataTable>
        )}
      </Card>
    </PageShell>
  )
}
