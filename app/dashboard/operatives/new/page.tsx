'use client'

import Link from 'next/link'

export default function NewOperativePage() {
  return (
    <div>
      <div className="mb-6">
        <Link href="/dashboard/operatives" className="text-blue-600 hover:underline flex items-center space-x-2 mb-4">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Back to Operatives</span>
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Add New Operative</h1>
      </div>

      <div className="bg-white rounded-lg shadow p-8 text-center">
        <p className="text-gray-600">Operative creation form coming soon...</p>
        <p className="text-sm text-gray-500 mt-2">This feature will allow you to add new team members.</p>
      </div>
    </div>
  )
}
