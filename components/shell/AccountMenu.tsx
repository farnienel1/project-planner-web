'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRightOnRectangleIcon,
  Cog6ToothIcon,
  QuestionMarkCircleIcon,
  KeyIcon,
  ShieldCheckIcon,
  ArrowsRightLeftIcon,
  UserCircleIcon,
  MoonIcon,
  SunIcon,
} from '@heroicons/react/24/solid'
import type { User } from '@/types'
import { UserAvatar } from '@/components/users/UserAvatar'
import { applyTheme, persistTheme, readStoredTheme, systemTheme, themeToggleCopy, type ThemePreference } from '@/lib/ui/theme'
import { IconChip } from '@/components/ui/IconChip'
import { Pill } from '@/components/ui/controls'
import { hasAdminAccess, isOperativeMode } from '@/lib/permissions'

function roleLabel(user: User): string {
  if (user.isSuperAdmin) return 'Super admin'
  if (hasAdminAccess(user)) return 'Admin'
  if (isOperativeMode(user)) return 'Operative'
  if (user.permissions.manager) return 'Manager'
  return user.role
}

export function AccountMenu({
  user,
  onSignOut,
}: {
  user: User
  onSignOut: () => void
}) {
  const [open, setOpen] = useState(false)
  const [theme, setTheme] = useState<ThemePreference>('light')

  useEffect(() => {
    setTheme(readStoredTheme() || systemTheme())
  }, [open])

  const toggle = themeToggleCopy(theme === 'dark')
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    persistTheme(next)
    setTheme(next)
    setOpen(false)
  }

  return (
    <div className="relative">
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-30 cursor-default bg-transparent"
          aria-label="Close account menu"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative z-40 overflow-hidden rounded-[14px] shadow-[var(--sh)]"
        aria-label="Account menu"
        aria-expanded={open}
      >
        <UserAvatar user={user} size={44} />
      </button>
      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-[300px] overflow-hidden rounded-[18px] bg-[var(--card)] p-2 shadow-[var(--sh-pop)]">
          <div className="flex items-center gap-3 rounded-[14px] px-2.5 py-2.5">
            <UserAvatar user={user} size={48} />
            <div className="min-w-0">
              <p className="truncate font-[family-name:var(--head)] text-base font-bold text-[var(--ink)]">
                {`${user.firstName} ${user.surname}`.trim() || user.email}
              </p>
              <p className="truncate text-[13px] text-[var(--ink3)]">{user.email}</p>
              <div className="mt-1">
                <Pill hue="user">{roleLabel(user)}</Pill>
              </div>
            </div>
          </div>
          <div className="my-1.5 h-px bg-[var(--line)]" />
          <Link href="/dashboard/settings/profile" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-2.5 py-2 text-[14.5px] hover:bg-[var(--soft)]" data-hue="blue">
            <IconChip hue="blue" size="sm"><UserCircleIcon className="h-4 w-4" /></IconChip>
            My profile
          </Link>
          <Link href="/dashboard/change-organisation" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-2.5 py-2 text-[14.5px] hover:bg-[var(--soft)]" data-hue="lib">
            <IconChip hue="lib" size="sm"><ArrowsRightLeftIcon className="h-4 w-4" /></IconChip>
            Switch organisation
          </Link>
          <Link href="/dashboard/settings" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-2.5 py-2 text-[14.5px] hover:bg-[var(--soft)]" data-hue="lib">
            <IconChip hue="lib" size="sm"><Cog6ToothIcon className="h-4 w-4" /></IconChip>
            Settings
          </Link>
          <Link href="/dashboard/settings/password" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-2.5 py-2 text-[14.5px] hover:bg-[var(--soft)]" data-hue="lib">
            <IconChip hue="lib" size="sm"><KeyIcon className="h-4 w-4" /></IconChip>
            Reset password
          </Link>
          <Link href="/dashboard/help" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-2.5 py-2 text-[14.5px] hover:bg-[var(--soft)]" data-hue="lib">
            <IconChip hue="lib" size="sm"><QuestionMarkCircleIcon className="h-4 w-4" /></IconChip>
            Help &amp; support
          </Link>
          <Link href="/dashboard/privacy" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-2.5 py-2 text-[14.5px] hover:bg-[var(--soft)]" data-hue="lib">
            <IconChip hue="lib" size="sm"><ShieldCheckIcon className="h-4 w-4" /></IconChip>
            Privacy Policy
          </Link>
          <button
            type="button"
            onClick={toggleTheme}
            className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-[14.5px] hover:bg-[var(--soft)]"
            data-hue={theme === 'dark' ? 'warn' : 'daily'}
          >
            <IconChip hue={theme === 'dark' ? 'warn' : 'daily'} size="sm">
              {toggle.icon === 'sun' ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
            </IconChip>
            {toggle.label}
          </button>
          <div className="my-1.5 h-px bg-[var(--line)]" />
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              onSignOut()
            }}
            className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-[14.5px] text-[var(--red)] hover:bg-[var(--red-t)]"
            data-hue="red"
          >
            <IconChip hue="red" size="sm">
              <ArrowRightOnRectangleIcon className="h-4 w-4" />
            </IconChip>
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  )
}

export function ThemeBoot() {
  useEffect(() => {
    applyTheme(readStoredTheme() || systemTheme())
  }, [])
  return null
}
