'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { useProjectStore } from '@/lib/stores/projectStore'
import { format } from 'date-fns'
import Link from 'next/link'

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { organization } = useAuthStore()
  const { projects, loadProjects } = useProjectStore()
  const project = projects.find(p => p.id === params.id)

  useEffect(() => {
    if (organization?.id) {
      loadProjects(organization.id)
    }
  }, [organization, loadProjects])

  if (!project) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-gray-500">Project not found</p>
          <Link href="/dashboard/projects" className="text-blue-600 hover:underline mt-2 inline-block">
            Back to Projects
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/dashboard/projects" className="text-blue-600 hover:underline flex items-center space-x-2 mb-4">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Back to Projects</span>
        </Link>
        
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{project.siteName}</h1>
            <p className="text-gray-600 mt-1">Job #{project.jobNumber}</p>
          </div>
          <Link
            href={`/dashboard/projects/${project.id}/edit`}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Edit Project
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Project Details */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Project Details</h2>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Site Name</dt>
                <dd className="mt-1 text-sm text-gray-900">{project.siteName}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Job Number</dt>
                <dd className="mt-1 text-sm text-gray-900">{project.jobNumber}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-gray-500">Address</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {project.addressLine1}
                  {project.addressLine2 && `, ${project.addressLine2}`}
                  <br />
                  {project.townCity}, {project.postcode}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Start Date</dt>
                <dd className="mt-1 text-sm text-gray-900">{format(new Date(project.startDate), 'MMMM d, yyyy')}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">End Date</dt>
                <dd className="mt-1 text-sm text-gray-900">{format(new Date(project.endDate), 'MMMM d, yyyy')}</dd>
              </div>
              {project.description && (
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-gray-500">Description</dt>
                  <dd className="mt-1 text-sm text-gray-900">{project.description}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Notes */}
          {project.notes && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Notes</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{project.notes}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Status</h3>
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
              project.isLive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}>
              {project.isLive ? 'Active' : 'Inactive'}
            </span>
          </div>

          {/* Client */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Client</h3>
            <p className="text-gray-900">{project.client.name}</p>
            {project.client.email && (
              <p className="text-sm text-gray-600 mt-1">{project.client.email}</p>
            )}
            {project.client.phone && (
              <p className="text-sm text-gray-600 mt-1">{project.client.phone}</p>
            )}
          </div>

          {/* Manager */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Manager</h3>
            <p className="text-gray-900">{project.manager.name}</p>
            {project.manager.email && (
              <p className="text-sm text-gray-600 mt-1">{project.manager.email}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
