import { Suspense } from 'react'
import { DeveloperUsersScreen } from '@/components/developer/DeveloperUsers'

export const metadata = { title: 'Users | Owner console' }

export default function DeveloperUsersPage() {
  return (
    <Suspense fallback={<p className="text-sm text-(--ink3)">Loading users…</p>}>
      <DeveloperUsersScreen />
    </Suspense>
  )
}
