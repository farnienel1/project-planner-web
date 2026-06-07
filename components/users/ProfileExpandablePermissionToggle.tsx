'use client'

import { useState } from 'react'
import type { UserPermissions } from '@/types'
import type { PermissionToggleDef } from '@/lib/staff/userPermissionDescriptions'

export function ProfileExpandablePermissionToggle({
  def,
  checked,
  onChange,
  disabled,
}: {
  def: PermissionToggleDef
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={disabled ? 'opacity-60' : ''}>
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex min-w-0 flex-1 items-start gap-2 text-left"
        >
          <svg
            className={`mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span>
            <span className="block text-sm font-medium text-slate-900">{def.title}</span>
            {expanded ? (
              <span className="mt-1 block text-xs leading-relaxed text-slate-500">{def.description}</span>
            ) : null}
          </span>
        </button>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          disabled={disabled}
          onClick={() => !disabled && onChange(!checked)}
          className={`
            relative inline-flex h-[28px] w-[50px] flex-shrink-0 cursor-pointer items-center
            rounded-full border-2 border-transparent transition-colors duration-200
            focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
            disabled:cursor-not-allowed
            ${checked ? 'bg-blue-500' : 'bg-slate-200'}
          `}
        >
          <span
            className={`
              pointer-events-none inline-block h-[22px] w-[22px] transform rounded-full bg-white shadow
              transition-transform duration-200
              ${checked ? 'translate-x-[22px]' : 'translate-x-[1px]'}
            `}
          />
        </button>
      </div>
    </div>
  )
}

export function PermissionToggleList({
  defs,
  permissions,
  onChange,
  disabled,
  excludeKeys,
}: {
  defs: PermissionToggleDef[]
  permissions: UserPermissions
  onChange: (patch: Partial<UserPermissions>) => void
  disabled?: boolean
  excludeKeys?: (keyof UserPermissions)[]
}) {
  const visible = defs.filter((def) => !excludeKeys?.includes(def.key))

  return (
    <>
      {visible.map((def) => (
        <ProfileExpandablePermissionToggle
          key={def.key}
          def={def}
          checked={permissions[def.key] === true || (def.key === 'dailyOverview' && permissions.dailyOverview !== false)}
          onChange={(checked) => onChange({ [def.key]: checked } as Partial<UserPermissions>)}
          disabled={disabled}
        />
      ))}
    </>
  )
}
