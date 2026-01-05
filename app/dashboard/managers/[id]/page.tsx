'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useEffect } from 'react'

export default function ManagerDetailPage() {
  const params = useParams()
  const { organization } = useAuthStore()
  const { managers, loadManagers } = useOperativeStore()
  const manager = managers.find(m => m.id === params.id)

  useEffect(() => {
    if (organization?.id) {
      loadManagers(organization.id)
    }
  }, [organization, loadManagers])

  if (!manager) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-gray-500">Manager not found</p>
          <Link href="/dashboard/managers" className="text-blue-600 hover:underline mt-2 inline-block">
            Back to Managers
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/dashboard/managers" className="text-blue-600 hover:underline flex items-center space-x-2 mb-4">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Back to Managers</span>
        </Link>
        
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{manager.firstName} {manager.lastName}</h1>
            <p className="text-gray-600 mt-1">{manager.email}</p>
          </div>
          <Link
            href={`/dashboard/managers/${manager.id}/edit`}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Edit Manager
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-gray-500">Email</dt>
            <dd className="mt-1 text-sm text-gray-900">{manager.email}</dd>
          </div>
          {(manager.phone || manager.mobile) && (
            <div>
              <dt className="text-sm font-medium text-gray-500">Phone</dt>
              <dd className="mt-1 text-sm text-gray-900">{manager.phone || manager.mobile}</dd>
            </div>
          )}
          {manager.department && (
            <div>
              <dt className="text-sm font-medium text-gray-500">Department</dt>
              <dd className="mt-1 text-sm text-gray-900">{manager.department}</dd>
            </div>
          )}
          <div>
            <dt className="text-sm font-medium text-gray-500">Status</dt>
            <dd className="mt-1">
              <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                manager.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {manager.isActive ? 'Active' : 'Inactive'}
              </span>
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
