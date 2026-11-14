'use client'

import { useState } from 'react'
import type { UserPermissions } from '@/types'
import type { PermissionToggleDef } from '@/lib/staff/userPermissionDescriptions'
import { cn } from '@/lib/ui/cn'
import { ProfileIcon, permissionIconFor } from '@/components/users/profile-ui/icons'

export function ProfileExpandablePermissionToggle({
  def,
  checked,
  onChange,
  disabled,
  lockedMessage,
  onLocked,
  variant,
}: {
  def: PermissionToggleDef
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  lockedMessage?: string
  onLocked?: (message: string) => void
  /** `profile`: the Edit user look (docs/design/user-profile-ui/). Same buttons, states and handlers. */
  variant?: 'profile'
}) {
  const [expanded, setExpanded] = useState(false)
  const onSwitch = () => {
    if (lockedMessage) {
      onLocked?.(lockedMessage)
      return
    }
    if (!disabled) onChange(!checked)
  }

  if (variant === 'profile') {
    const lockedOn = Boolean(lockedMessage) && checked
    return (
      <div className={cn('up-perm', disabled && 'dim')}>
        <button type="button" onClick={() => setExpanded((v) => !v)} className="up-perm-main" aria-expanded={expanded}>
          <span className={cn('up-pchev', expanded && 'open')}>
            <ProfileIcon name="right" />
          </span>
          <span className={cn('up-ptile', checked && 'on')} aria-hidden="true">
            <ProfileIcon name={permissionIconFor(def.key)} />
          </span>
          <span className="up-ptxt">
            <b>
              {def.title}
            </b>
            {expanded ? <small>{def.description}</small> : null}
          </span>
        </button>
        {/* Outside the expand button, so the button's name stays the permission's own title. */}
        {lockedOn ? <span className="pu-chip pu-c-green up-perm-chip">Locked on</span> : null}
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={def.title}
          disabled={disabled && !lockedMessage}
          onClick={onSwitch}
          className={cn('up-sw', checked && 'on', lockedOn && 'locked')}
        >
          <i aria-hidden="true" />
        </button>
      </div>
    )
  }

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
            <span className="block text-sm font-medium text-[var(--ink)]">{def.title}</span>
            {expanded ? (
              <span className="mt-1 block text-xs leading-relaxed text-[var(--ink2)]">{def.description}</span>
            ) : null}
          </span>
        </button>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          disabled={disabled && !lockedMessage}
          onClick={onSwitch}
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
  lockedMessages,
  checkedOverrides,
  onLocked,
}: {
  defs: PermissionToggleDef[]
  permissions: UserPermissions
  onChange: (patch: Partial<UserPermissions>) => void
  disabled?: boolean
  excludeKeys?: (keyof UserPermissions)[]
  lockedMessages?: Partial<Record<keyof UserPermissions, string>>
  checkedOverrides?: Partial<Record<keyof UserPermissions, boolean>>
  onLocked?: (message: string) => void
}) {
  const visible = defs.filter((def) => !excludeKeys?.includes(def.key))

  return (
    <>
      {visible.map((def) => {
        const rawLock = lockedMessages?.[def.key]
        const locked = rawLock != null
        return (
          <ProfileExpandablePermissionToggle
            key={def.key}
            def={def}
            checked={
              checkedOverrides?.[def.key] ??
              (permissions[def.key] === true || (def.key === 'dailyOverview' && permissions.dailyOverview !== false))
            }
            onChange={(checked) => onChange({ [def.key]: checked } as Partial<UserPermissions>)}
            disabled={disabled || locked}
            lockedMessage={rawLock || undefined}
            onLocked={onLocked}
          />
        )
      })}
    </>
  )
}

/**
 * Rulebook 1.11.0 `permissionToggleRows`: the rows Add User, its summary and Edit User show on both apps. A row that is
 * not `editable` is shown with its value and greyed out; tapping it shows `lockedMessage`.
 */
export function PermissionRowsList({
  rows,
  onChange,
  disabled,
  excludeFields,
  lockedMessage,
  onLocked,
  variant,
}: {
  rows: ReadonlyArray<{
    field: string
    label: string
    help: string
    visible: boolean
    editable: boolean
    value: boolean
    /** Rulebook 1.28.0: why this row is greyed out (Super Admin, PAYE), shown in place of `lockedMessage`. */
    note?: string | null
  }>
  onChange: (patch: Partial<UserPermissions>) => void
  disabled?: boolean
  excludeFields?: string[]
  lockedMessage?: string
  onLocked?: (message: string) => void
  /** Passed to each row (`ProfileExpandablePermissionToggle`). */
  variant?: 'profile'
}) {
  return (
    <>
      {rows
        .filter((row) => row.visible && !excludeFields?.includes(row.field))
        .map((row) => (
          <ProfileExpandablePermissionToggle
            key={row.field}
            def={{ key: row.field as PermissionToggleDef['key'], title: row.label, description: row.help }}
            checked={row.value}
            onChange={(checked) => onChange({ [row.field]: checked } as Partial<UserPermissions>)}
            disabled={disabled || !row.editable}
            lockedMessage={!row.editable && !disabled ? row.note || lockedMessage : undefined}
            onLocked={onLocked}
            variant={variant}
          />
        ))}
    </>
  )
}
