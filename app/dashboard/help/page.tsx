'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { HelpSupportScreen } from '@/components/help/HelpSupportScreen'
import { useAuthStore } from '@/lib/stores/authStore'
import { canViewHelp } from '@/lib/navigation/menuPermissions'

export default function HelpSupportPage() {
  const router = useRouter()
  const { user, loading } = useAuthStore()

  useEffect(() => {
    if (user && !canViewHelp(user)) router.replace('/dashboard')
  }, [user, router])

  if (loading || !user || !canViewHelp(user)) return null
  return <HelpSupportScreen />
}
