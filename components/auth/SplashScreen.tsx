/**
 * iOS parity source: AppBranding.swift AppLaunchSplashView
 * Spec: docs/ios-parity/IOS_APP_BLUEPRINT.md §1.2
 */

export function SplashScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-5">
        <div
          className="flex h-[120px] w-[120px] items-center justify-center rounded-[26px] bg-gradient-to-br from-[#185FA5] to-[#378ADD] text-3xl font-black text-white"
          style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
        >
          PP
        </div>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#185FA5] border-t-transparent" />
      </div>
    </div>
  )
}
