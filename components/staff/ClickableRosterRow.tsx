'use client'

import { useRouter } from 'next/navigation'
import type { KeyboardEvent, ReactNode } from 'react'

export function ClickableRosterRow({
  href,
  children,
}: {
  href: string
  children: ReactNode
}) {
  const router = useRouter()

  const navigate = () => router.push(href)

  const onKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      navigate()
    }
  }

  return (
    <tr
      role="button"
      tabIndex={0}
      onClick={navigate}
      onKeyDown={onKeyDown}
      className="cursor-pointer transition-colors hover:bg-blue-50/60 focus:bg-blue-50/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
    >
      {children}
    </tr>
  )
}
