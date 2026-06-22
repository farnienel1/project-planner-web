'use client'

import { useEffect, useMemo, useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { useAuthStore } from '@/lib/stores/authStore'
import { useUserStore } from '@/lib/stores/userStore'
import { getFirebaseDb } from '@/lib/firebase/ensureFirebase'
import {
  MANAGER_PERMISSION_TOGGLES,
  OPERATIVE_PERMISSION_TOGGLES,
} from '@/lib/staff/userPermissionDescriptions'
import { permissionsForAccountType } from '@/lib/orgSetup/accountPermissions'
import type { TeamOnboardingState } from '@/lib/orgSetup/teamOnboarding'
import { PermissionToggleList } from '@/components/users/ProfileExpandablePermissionToggle'
import type { User, UserPermissions } from '@/types'
import { UserRole } from '@/types'

const LEVEL_GUIDE = [
  {
    title: 'Administrator',
    body: 'You (the org creator) have full access — users, settings, billing, and all modules.',
  },
  {
    title: 'Manager',
    body: 'Schedules operatives, runs projects and small works, and can be given extra tools (skills, qualifications, reports) below.',
  },
  {
    title: 'Operative',
    body: 'Field access: their schedule, tasks, materials lists, and site audits — tuned per person.',
  },
]

function buildUserFromDefaults(
  partial: {
    id: string
    email: string
    firstName: string
    surname: string
    organizationId: string
    assignedManagerUserId?: string
  },
  accountType: 'manager' | 'operative'
): User {
  const now = new Date()
  return {
    id: partial.id,
    email: partial.email,
    firstName: partial.firstName,
    surname: partial.surname,
    organizationId: partial.organizationId,
    role: accountType === 'operative' ? UserRole.OPERATIVE : UserRole.MANAGER,
    isActive: true,
    passwordSet: false,
    isSuperAdmin: false,
    permissions: permissionsForAccountType(accountType),
    assignedManagerUserId: partial.assignedManagerUserId,
    policyAccepted: false,
    createdAt: now,
    updatedAt: now,
  }
}

async function patchTeamOnboarding(
  organizationId: string,
  patch: TeamOnboardingState
) {
  const db = getFirebaseDb()
  await updateDoc(doc(db, 'organizations', organizationId), {
    teamOnboarding: patch,
    updatedAt: new Date(),
  })
}

export function TeamOnboardingPrompt() {
  const { user, organization } = useAuthStore()
  const { getUser, saveUser } = useUserStore()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [targetUser, setTargetUser] = useState<User | null>(null)
  const [permissions, setPermissions] = useState<UserPermissions | null>(null)

  const onboarding = organization?.teamOnboarding

  const step = useMemo(() => {
    if (!onboarding || onboarding.status === 'complete') return null
    if (onboarding.status === 'pending_manager' && onboarding.managerUserId) return 'manager'
    if (onboarding.status === 'pending_operative' && onboarding.operativeUserId) return 'operative'
    return null
  }, [onboarding])

  useEffect(() => {
    let cancelled = false

    async function loadTarget() {
      if (!organization?.id || !step || !user?.permissions.adminAccess) {
        setOpen(false)
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      const userId =
        step === 'manager' ? onboarding?.managerUserId : onboarding?.operativeUserId
      if (!userId) {
        setLoading(false)
        return
      }

      try {
        const loaded = await getUser(userId)
        if (cancelled) return
        if (loaded) {
          setTargetUser(loaded)
          setPermissions({ ...loaded.permissions })
          setOpen(true)
        } else {
          const name =
            step === 'manager' ? onboarding?.managerName || 'Manager' : onboarding?.operativeName || 'Operative'
          const [firstName, ...rest] = name.split(' ')
          const fallback = buildUserFromDefaults(
            {
              id: userId,
              email: '',
              firstName: firstName || name,
              surname: rest.join(' '),
              organizationId: organization.id,
              assignedManagerUserId:
                step === 'operative' ? onboarding?.managerUserId || user.id : user.id,
            },
            step
          )
          setTargetUser(fallback)
          setPermissions({ ...fallback.permissions })
          setOpen(true)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load team member')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadTarget()
    return () => {
      cancelled = true
    }
  }, [organization?.id, onboarding, step, user, getUser])

  if (!user?.permissions.adminAccess || loading || !open || !step || !targetUser || !permissions) {
    return null
  }

  const isManagerStep = step === 'manager'
  const title = isManagerStep
    ? `Set up ${onboarding?.managerName || 'your manager'}`
    : `Set up ${onboarding?.operativeName || 'your operative'}`
  const subtitle = isManagerStep
    ? 'Choose what this manager can access in the app. You can change this later under Settings → Users.'
    : 'Choose what this operative can access. They will appear under Operatives once permissions are saved.'
  const toggles = isManagerStep ? MANAGER_PERMISSION_TOGGLES : OPERATIVE_PERMISSION_TOGGLES

  async function handleSave() {
    if (!organization?.id || !onboarding || !targetUser || !permissions) return
    setSaving(true)
    setError(null)
    try {
      const updated: User = {
        ...targetUser,
        permissions: { ...permissions },
        updatedAt: new Date(),
      }
      await saveUser(updated)

      if (isManagerStep) {
        await patchTeamOnboarding(organization.id, {
          ...onboarding,
          status: onboarding.operativeUserId ? 'pending_operative' : 'complete',
          managerPermissionsConfigured: true,
        })
      } else {
        await patchTeamOnboarding(organization.id, {
          ...onboarding,
          status: 'complete',
          operativePermissionsConfigured: true,
        })
      }

      setOpen(false)
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save permissions')
    } finally {
      setSaving(false)
    }
  }

  async function handleSkip() {
    if (!organization?.id || !onboarding) return
    if (isManagerStep) {
      await patchTeamOnboarding(organization.id, {
        ...onboarding,
        status: onboarding.operativeUserId ? 'pending_operative' : 'complete',
        managerPermissionsConfigured: true,
      })
    } else {
      await patchTeamOnboarding(organization.id, {
        ...onboarding,
        status: 'complete',
        operativePermissionsConfigured: true,
      })
    }
    setOpen(false)
    window.location.reload()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="border-b border-slate-100 bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-100">Finish team setup</p>
          <h2 className="mt-1 text-2xl font-extrabold">{title}</h2>
          <p className="mt-2 text-sm text-blue-100">{subtitle}</p>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">User levels in Project Planner</p>
            <ul className="mt-3 space-y-3">
              {LEVEL_GUIDE.map((item) => (
                <li key={item.title} className="text-sm text-slate-600">
                  <span className="font-semibold text-slate-900">{item.title}:</span> {item.body}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <strong>Invite emails:</strong> Web setup creates their account as{' '}
            <em>Pending</em> in Firestore. Password emails are sent via the iOS invite / Resend flow — not
            automatically from this web app yet.
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="border-b border-slate-100 bg-white px-5 py-3">
              <p className="text-sm font-bold text-slate-900">Permissions</p>
              <p className="text-xs text-slate-500">
                {isManagerStep
                  ? 'Managers can schedule people even if project/small-works toggles are off.'
                  : 'Operatives typically need materials and site audit for site work.'}
              </p>
            </div>
            <PermissionToggleList
              defs={toggles}
              permissions={permissions}
              onChange={(patch) => setPermissions((prev) => (prev ? { ...prev, ...patch } : prev))}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving
              ? 'Saving…'
              : isManagerStep
                ? 'Save manager & continue'
                : 'Save operative & finish'}
          </button>
          <button
            type="button"
            onClick={() => void handleSkip()}
            disabled={saving}
            className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Use defaults for now
          </button>
        </div>
      </div>
    </div>
  )
}
