'use client'

import Link from 'next/link'

export default function HelpSupportPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
        <h1 className="text-3xl font-bold text-slate-900">Help & support</h1>
        <p className="mt-1 text-slate-600">Guides for using Project Planner on web and iOS</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Firebase sync</h2>
          <p className="mt-2 text-sm text-slate-600">
            The web app uses the same Firebase project as iOS. Changes you make here are written to your
            organisation&apos;s Firestore collections and appear on mobile after a refresh or realtime listener.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Permissions</h2>
          <p className="mt-2 text-sm text-slate-600">
            Menu items respect the same permission flags as iOS (projects, operatives, admin access, skills,
            qualifications). If a link is missing, ask an admin to enable that permission on your user.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Password</h2>
          <p className="mt-2 text-sm text-slate-600">
            To change your password while signed in, use Reset password in the sidebar or account settings.
          </p>
          <Link href="/dashboard/settings/password" className="mt-3 inline-block text-sm font-medium text-blue-600 hover:text-blue-800">
            Go to password settings →
          </Link>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Contact</h2>
          <p className="mt-2 text-sm text-slate-600">
            For organisation-specific support, contact your company administrator. Technical issues with the
            web app can be raised with your development team.
          </p>
        </div>
      </div>
    </div>
  )
}
