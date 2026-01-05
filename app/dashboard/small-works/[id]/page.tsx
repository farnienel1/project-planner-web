'use client'

import { useParams } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { useProjectStore } from '@/lib/stores/projectStore'
import { useEffect } from 'react'
import { format } from 'date-fns'
import Link from 'next/link'

export default function SmallWorkDetailPage() {
  const params = useParams()
  const { organization } = useAuthStore()
  const { projects, loadProjects } = useProjectStore()
  const work = projects.find(p => p.id === params.id && (p.jobType === 'smallWork' || p.jobType === 'smallWorks'))

  useEffect(() => {
    if (organization?.id) {
      loadProjects(organization.id)
    }
  }, [organization, loadProjects])

  if (!work) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-gray-500">Small work not found</p>
          <Link href="/dashboard/small-works" className="text-blue-600 hover:underline mt-2 inline-block">
            Back to Small Works
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/dashboard/small-works" className="text-blue-600 hover:underline flex items-center space-x-2 mb-4">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Back to Small Works</span>
        </Link>
        
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{work.siteName}</h1>
            <p className="text-gray-600 mt-1">Job #{work.jobNumber}</p>
          </div>
          <Link
            href={`/dashboard/small-works/${work.id}/edit`}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Edit Small Work
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Details</h2>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Site Name</dt>
                <dd className="mt-1 text-sm text-gray-900">{work.siteName}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Job Number</dt>
                <dd className="mt-1 text-sm text-gray-900">{work.jobNumber}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-gray-500">Address</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {work.addressLine1}
                  {work.addressLine2 && `, ${work.addressLine2}`}
                  <br />
                  {work.townCity}, {work.postcode}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Start Date</dt>
                <dd className="mt-1 text-sm text-gray-900">{format(new Date(work.startDate), 'MMMM d, yyyy')}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">End Date</dt>
                <dd className="mt-1 text-sm text-gray-900">{format(new Date(work.endDate), 'MMMM d, yyyy')}</dd>
              </div>
              {work.description && (
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-gray-500">Description</dt>
                  <dd className="mt-1 text-sm text-gray-900">{work.description}</dd>
                </div>
              )}
            </dl>
          </div>

          {work.notes && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Notes</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{work.notes}</p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Status</h3>
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
              work.isLive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}>
              {work.isLive ? 'Active' : 'Inactive'}
            </span>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Client</h3>
            <p className="text-gray-900">{work.client.name}</p>
            {work.client.email && (
              <p className="text-sm text-gray-600 mt-1">{work.client.email}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
