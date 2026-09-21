import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { StaleChunkReload } from '@/components/client/StaleChunkReload'
import { WebIdleSessionGuard } from '@/components/auth/WebIdleSessionGuard'

const inter = Inter({ subsets: ['latin'] })

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
    <html lang="en">
      <body className={inter.className}>
        <StaleChunkReload />
        <WebIdleSessionGuard />
        {children}
      </body>
    </html>
  )
}




