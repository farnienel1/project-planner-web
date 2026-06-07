'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getDashboardQuickActions } from '@/lib/navigation/dashboardQuickActions'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, organization, loading, signOut } = useAuthStore()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const navItems = getDashboardQuickActions(user, organization)

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-[1800px] px-4 sm:px-6 lg:px-10">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-slate-900">Project Planner</h1>
              <span className="ml-4 text-sm text-slate-500">{organization?.name}</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-slate-600">
                {user.firstName || user.email}
              </span>
              <button
                onClick={() => signOut()}
                className="rounded-md px-3 py-1 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1800px] items-start gap-6 px-4 py-6 sm:px-6 lg:px-10">
        {/* Sidebar Navigation */}
        <aside className="sticky top-[88px] w-[320px] rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 px-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Main menu</h2>
            <p className="mt-1 text-sm text-slate-600">Quick actions mirrored from the app</p>
          </div>
          <nav className="space-y-3">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`group flex items-center gap-3 rounded-xl border px-4 py-3 transition ${
                    isActive
                      ? 'border-blue-200 bg-blue-50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${item.tileClasses}`}
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.iconPath} />
                    </svg>
                  </span>
                  <span className="min-w-0">
                    <span
                      className={`block text-sm font-semibold ${
                        isActive ? 'text-blue-700' : 'text-slate-900'
                      }`}
                    >
                      {item.label}
                    </span>
                    <span className="block truncate text-xs text-slate-500">{item.subtitle}</span>
                  </span>
                </Link>
              )
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="min-h-[calc(100vh-7rem)] flex-1 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}




