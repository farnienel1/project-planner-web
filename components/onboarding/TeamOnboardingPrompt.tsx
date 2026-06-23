'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { doc, updateDoc } from 'firebase/firestore'
import { useAuthStore } from '@/lib/stores/authStore'
import { getFirebaseDb } from '@/lib/firebase/ensureFirebase'
import type { TeamOnboardingState } from '@/lib/orgSetup/teamOnboarding'
import { shouldShowTeamOnboarding } from '@/lib/orgSetup/teamOnboarding'

async function markUsersGuideShown(organizationId: string, onboarding: TeamOnboardingState) {
  const db = getFirebaseDb()
  await updateDoc(doc(db, 'organizations', organizationId), {
    teamOnboarding: {
      ...onboarding,
      status: 'complete',
      addUsersGuideShown: true,
    },
    updatedAt: new Date(),
  })
}

export function TeamOnboardingPrompt() {
  const { user, organization } = useAuthStore()
  const [open, setOpen] = useState(false)
  const onboarding = organization?.teamOnboarding

  useEffect(() => {
    if (shouldShowTeamOnboarding(onboarding, Boolean(user?.permissions.adminAccess || user?.isSuperAdmin))) {
      setOpen(true)
    } else {
      setOpen(false)
    }
  }, [onboarding, user])

  if (!open || !organization?.id || !onboarding || !user) return null

  async function handleDismiss() {
    await markUsersGuideShown(organization!.id, onboarding!)
    setOpen(false)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="border-b border-slate-100 bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-100">Next step</p>
          <h2 className="mt-1 text-2xl font-extrabold">Set up your team</h2>
          <p className="mt-2 text-sm text-blue-100">
            Your organisation data is ready. Now add managers and operatives from the Manage Users page.
          </p>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4 text-sm text-blue-900">
            Once you are signed into the web app, you will be guided to the <strong>Manage Users</strong> page. In
            here, you will be able to set up all users for your organisation. Admin, manager and operative levels are
            available.
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-900">Administrator</p>
              <p className="mt-2 text-xs text-slate-600">
                You (the org creator) have full access — users, settings, billing, and all modules.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-900">Manager</p>
              <p className="mt-2 text-xs text-slate-600">
                A lighter version of admin — schedules teams, runs projects, approves timesheets and leave.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-900">Operative</p>
              <p className="mt-2 text-xs text-slate-600">
                Field access: their schedule, tasks, timesheets and snag lists — tuned per person.
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Skills, qualifications, day rate, VAT and UTR can be added to each person once they are in the app — keeping
            this setup flow simple.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 border-t border-slate-100 px-6 py-4">
          <Link
            href="/dashboard/settings/users"
            onClick={() => void handleDismiss()}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Go to Manage Users
          </Link>
          <button
            type="button"
            onClick={() => void handleDismiss()}
            className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            I&apos;ll do this later
          </button>
        </div>
      </div>
    </div>
  )
}
