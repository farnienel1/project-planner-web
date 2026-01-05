'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useEffect } from 'react'
import { format } from 'date-fns'

export default function OperativeDetailPage() {
  const params = useParams()
  const { organization } = useAuthStore()
  const { operatives, loadOperatives } = useOperativeStore()
  const operative = operatives.find(o => o.id === params.id)

  useEffect(() => {
    if (organization?.id) {
      loadOperatives(organization.id)
    }
  }, [organization, loadOperatives])

  if (!operative) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-gray-500">Operative not found</p>
          <Link href="/dashboard/operatives" className="text-blue-600 hover:underline mt-2 inline-block">
            Back to Operatives
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/dashboard/operatives" className="text-blue-600 hover:underline flex items-center space-x-2 mb-4">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Back to Operatives</span>
        </Link>
        
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{operative.firstName} {operative.lastName}</h1>
            <p className="text-gray-600 mt-1">{operative.email}</p>
          </div>
          <Link
            href={`/dashboard/operatives/${operative.id}/edit`}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Edit Operative
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Contact Information</h2>
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

          {operative.skills && operative.skills.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Skills</h2>
              <div className="flex flex-wrap gap-2">
                {operative.skills.map((skill, idx) => (
                  <span key={idx} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
                    {typeof skill === 'string' ? skill : skill.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {operative.qualifications && operative.qualifications.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Qualifications</h2>
              <div className="space-y-2">
                {operative.qualifications.map((qual, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
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
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Status</h3>
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
              operative.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}>
              {operative.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
