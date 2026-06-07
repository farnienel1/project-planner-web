'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useEffect, useMemo } from 'react'
import { format } from 'date-fns'
import { dedupeOperativesByEmail } from '@/lib/operatives/operativeRosterUtils'
import { resolveOperativeSkillLabels } from '@/lib/staff/skillDisplayUtils'

export default function OperativeDetailPage() {
  const params = useParams()
  const { organization } = useAuthStore()
  const { operatives, skills, loadOperatives, loadSkills } = useOperativeStore()

  const operative = useMemo(
    () => dedupeOperativesByEmail(operatives).find((entry) => entry.id === params.id),
    [operatives, params.id]
  )

  useEffect(() => {
    if (organization?.id) {
      loadOperatives(organization.id)
      loadSkills(organization.id)
    }
  }, [organization, loadOperatives, loadSkills])

  const skillLabels = operative ? resolveOperativeSkillLabels(operative, skills) : []

  if (!operative) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Operative not found</p>
          <Link href="/dashboard/operatives" className="mt-2 inline-block text-blue-600 hover:underline">
            Back to Operatives
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/dashboard/operatives" className="mb-4 flex items-center space-x-2 text-blue-600 hover:underline">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Back to Operatives</span>
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {operative.firstName} {operative.lastName}
            </h1>
            <p className="mt-1 text-gray-600">{operative.email}</p>
          </div>
          <Link
            href={`/dashboard/operatives/${operative.id}/edit`}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Edit Operative
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">Contact Information</h2>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Email</dt>
                <dd className="mt-1 text-sm text-gray-900">{operative.email}</dd>
              </div>
              {operative.phone && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Phone</dt>
                  <dd className="mt-1 text-sm text-gray-900">{operative.phone}</dd>
                </div>
              )}
              <div>
                <dt className="text-sm font-medium text-gray-500">Start Date</dt>
                <dd className="mt-1 text-sm text-gray-900">{format(new Date(operative.startDate), 'MMMM d, yyyy')}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Hourly Rate</dt>
                <dd className="mt-1 text-sm text-gray-900">£{operative.hourlyRate.toFixed(2)}/hr</dd>
              </div>
            </dl>
          </div>

          {skillLabels.length > 0 && (
            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="mb-4 text-xl font-semibold text-gray-900">Skills</h2>
              <div className="flex flex-wrap gap-2">
                {skillLabels.map((label) => (
                  <span key={label} className="rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700">
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {operative.qualifications && operative.qualifications.length > 0 && (
            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="mb-4 text-xl font-semibold text-gray-900">Qualifications</h2>
              <div className="space-y-2">
                {operative.qualifications.map((qual, idx) => (
                  <div key={idx} className="flex items-center justify-between border-b border-gray-100 py-2 last:border-0">
                    <span className="text-gray-900">{typeof qual === 'string' ? qual : qual.name}</span>
                    {typeof qual === 'object' && qual.endDate && (
                      <span className="text-sm text-gray-500">
                        Expires: {format(new Date(qual.endDate), 'MMM d, yyyy')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Status</h3>
            <span
              className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${
                operative.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}
            >
              {operative.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
