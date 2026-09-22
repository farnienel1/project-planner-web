import type { Metadata } from 'next'
import { inter, jakarta } from '@/lib/fonts'
import './globals.css'
import './marketing.css'
import { StaleChunkReload } from '@/components/client/StaleChunkReload'
import { WebIdleSessionGuard } from '@/components/auth/WebIdleSessionGuard'
import { ThemeBoot } from '@/components/shell/AccountMenu'
import { THEME_BOOT_SCRIPT } from '@/lib/ui/theme'
import { EMAIL_ACTION_BOOT_SCRIPT } from '@/lib/auth/emailAction'

export const metadata: Metadata = {
  title: 'Project Planner',
  description:
    'Scheduling, timesheets, materials and health & safety for contractors. One platform on iOS, Android and web.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en-GB" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: EMAIL_ACTION_BOOT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className={`${inter.variable} ${jakarta.variable} ${inter.className}`}>
        <ThemeBoot />
        <StaleChunkReload />
        <WebIdleSessionGuard />
        {children}
      </body>
    </html>
  )
}
