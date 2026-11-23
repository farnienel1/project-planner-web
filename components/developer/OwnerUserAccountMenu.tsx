'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { User } from '@/types'

/**
 * Row menu on the organisation page. Owner console PR 5: the person actions (password reset, change name, change
 * login email, sign out everywhere) live on the person page, with their confirmation, reason and fresh-code step; the
 * menu opens it.
 */
export function OwnerUserAccountMenu({
  user,
  onDone,
  extra,
}: {
  user: User
  onDone: (message: string) => void
  extra?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0, dropUp: false })

  function toggleMenu() {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) {
      setOpen((value) => !value)
      return
    }
    const menuHeight = 160
    const dropUp = rect.bottom + menuHeight > window.innerHeight - 12
    setMenuPos({
      top: dropUp ? rect.top - 8 : rect.bottom + 4,
      right: Math.max(12, window.innerWidth - rect.right),
      dropUp,
    })
    setOpen((value) => !value)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const onClick = (event: MouseEvent) => {
      if (buttonRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onClick)
    }
  }, [open])

  const menu = open ? (
    <div
      className="fixed z-80 w-56 rounded-xl border border-(--line) bg-(--card) p-1 shadow-lg"
      style={{
        top: menuPos.dropUp ? undefined : menuPos.top,
        bottom: menuPos.dropUp ? Math.max(12, window.innerHeight - menuPos.top) : undefined,
        right: menuPos.right,
      }}
    >
      <Link
        href={`/developer/users/${encodeURIComponent(user.id)}`}
        className="block rounded-lg px-3 py-2 text-left text-sm hover:bg-(--soft)"
      >
        Open person (actions)
      </Link>
      {extra}
      <button
        type="button"
        className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-(--soft)"
        onClick={() => {
          void navigator.clipboard.writeText(user.id)
          onDone('User id copied.')
          setOpen(false)
        }}
      >
        Copy user ID
      </button>
    </div>
  ) : null

  return (
    <td className="relative px-4 py-3">
      <button ref={buttonRef} type="button" className="btn sm ghost" onClick={toggleMenu} aria-haspopup="menu" aria-expanded={open}>
        ⋯
      </button>
      {typeof document !== 'undefined' && menu ? createPortal(menu, document.body) : menu}
    </td>
  )
}
