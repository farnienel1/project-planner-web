'use client'

import Link from 'next/link'

export default function NewSmallWorkPage() {
  return (
    <div>
      <div className="mb-6">
        <Link href="/dashboard/small-works" className="text-blue-600 hover:underline flex items-center space-x-2 mb-4">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Back to Small Works</span>
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Create New Small Work</h1>
      </div>

      <div className="bg-white rounded-lg shadow p-8 text-center">
        <p className="text-gray-600">Small work creation form coming soon...</p>
        <p className="text-sm text-gray-500 mt-2">This feature will allow you to create new small work projects.</p>
      </div>
    </div>
  )
}
