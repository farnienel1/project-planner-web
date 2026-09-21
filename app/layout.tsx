import type { Metadata } from 'next'
import { Inter, Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import { StaleChunkReload } from '@/components/client/StaleChunkReload'
import { WebIdleSessionGuard } from '@/components/auth/WebIdleSessionGuard'
import { ThemeBoot } from '@/components/shell/AccountMenu'
import { THEME_BOOT_SCRIPT } from '@/lib/ui/theme'

const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-body' })
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-head',
})

export const metadata: Metadata = {
  title: 'Project Planner',
  description: 'Construction project management platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en-GB" suppressHydrationWarning>
      <head>
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
