'use client'

import { LoginBrandScreen } from '@/components/auth/LoginBrandScreen'
import { WebLoginScreen } from '@/components/auth/WebLoginScreen'

export default function LoginPage() {
  return (
    <>
      <div className="lg:hidden">
        <LoginBrandScreen />
      </div>
      <div className="hidden lg:block">
        <WebLoginScreen />
      </div>
    </>
  )
}
