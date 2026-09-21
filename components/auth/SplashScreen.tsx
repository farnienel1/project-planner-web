/**
 * iOS parity source: AppBranding.swift AppLaunchSplashView
 * Spec: docs/ios-parity/IOS_APP_BLUEPRINT.md §1.2
 */

import { AppLogoMark } from '@/components/ui/AppLogoMark'

export function SplashScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-5">
        <AppLogoMark
          size={120}
          radius={26}
          className="shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
        />
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--blue)] border-t-transparent" />
      </div>
    </div>
  )
}
