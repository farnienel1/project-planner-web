/**
 * Building blocks for the User profile and Edit user pages (docs/design/user-profile-ui/user-profile-ui-spec.md §2).
 * Presentational only: every component renders what it is given and calls the handler it is given. No data, no
 * rules, no navigation of its own. Styles: app/profile-ui.css (`up-*`) on top of app/pages-ui.css (`pu-*`), light and
 * dark, loaded by `./index` (this file has no CSS import, so tests can render it).
 */
'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/ui/cn'
import type { PuTileTone } from '@/components/ui/page'
import { PendingSpinner } from '@/components/shell/PendingSpinner'
import { ProfileIcon, type ProfileIconName } from './icons'

export { ProfileIcon, permissionIconFor, type ProfileIconName } from './icons'

/** The page wrapper: scopes the restyled inputs (`.up-page .pp-in`). */
export function ProfilePage({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('pu-page up-page', className)}>{children}</div>
}

/**
 * The existing Back control, shown above the band: same handler, pending spinner, disabled state and label as
 * before.
 */
export function ProfileBack({
  onClick,
  onPointerEnter,
  onFocus,
  pending,
}: {
  onClick: () => void
  onPointerEnter?: () => void
  onFocus?: () => void
  pending?: boolean
}) {
  return (
    <button
      type="button"
      className="up-back"
      onClick={onClick}
      onPointerEnter={onPointerEnter}
      onFocus={onFocus}
      disabled={pending}
      aria-busy={pending || undefined}
      aria-label="Back"
    >
      {pending ? <PendingSpinner /> : <ProfileIcon name="left" />}
      Back
    </button>
  )
}

export type BandChip = { label: ReactNode; dot?: 'green' | 'blue' | 'slate' | 'amber'; tone?: 'super' | 'warn' }

/** Navy band with the avatar, a small top line, the name, the chips, a right-hand slot and display-only figures. */
export function ProfileBand({
  avatar,
  eyebrow,
  name,
  chips,
  aside,
  stats,
}: {
  avatar: ReactNode
  /** The page heading (h1), styled as the band's small top line. */
  eyebrow: ReactNode
  name: ReactNode
  chips: BandChip[]
  /** Edit profile, the save state or the Save control (existing handlers). */
  aside?: ReactNode
  /** Display only: never clickable (spec §1). */
  stats?: { value: ReactNode; label: ReactNode }[]
}) {
  return (
    <section className="pu-band up-band">
      <div className="up-band-top">
        <div className="up-band-av">{avatar}</div>
        <div className="up-band-text">
          <h1 className="pu-eyebrow">{eyebrow}</h1>
          <p className="up-band-name">{name}</p>
          {chips.length > 0 ? (
            <div className="up-band-chips">
              {chips.map((chip, index) => (
                <span key={index} className={cn('up-dchip', chip.tone)}>
                  {chip.dot ? <i className={cn('up-dot', chip.dot)} aria-hidden="true" /> : null}
                  {chip.label}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        {aside ? <div className="up-band-aside">{aside}</div> : null}
      </div>
      {stats && stats.length > 0 ? (
        <div className="pu-stats up-stats">
          {stats.map((stat, index) => (
            <div key={index} className="pu-stat">
              <b>{stat.value}</b>
              <span>{stat.label}</span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}

/** The existing "No changes" (or other) state text, shown as a pill on the band. Display only. */
export function SaveState({ children, tone = 'clean' }: { children: ReactNode; tone?: 'clean' | 'view' }) {
  return (
    <span className={cn('up-savestate', tone)}>
      {tone === 'clean' ? <i className="up-dot green" aria-hidden="true" /> : null}
      {children}
    </span>
  )
}

/**
 * White section card. ≥1024px it is a settings row: a 240px left column with the tile, title and header buttons,
 * and the content on the right. Below that the title sits above the content.
 */
export function FormSection({
  title,
  icon,
  tone = 'blue',
  actions,
  children,
  className,
}: {
  title: ReactNode
  icon: ProfileIconName
  tone?: PuTileTone
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('pu-card up-section', className)}>
      <div className="up-section-h">
        <span className={cn('pu-tile sm up-section-tile', `pu-t-${tone}`)} aria-hidden="true">
          <ProfileIcon name={icon} />
        </span>
        <h2>{title}</h2>
        {actions ? <div className="up-section-actions">{actions}</div> : null}
      </div>
      <div className="up-section-b">{children}</div>
    </section>
  )
}

/** Two-column field grid (one column below 820px). */
export function FieldGrid({ children }: { children: ReactNode }) {
  return <div className="up-fg">{children}</div>
}

/** A padded block inside a section for content that is not a field grid. */
export function SectionBlock({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('up-block', className)}>{children}</div>
}

/** Label above the existing input, helper text below. The label is not wrapped around the control (as before). */
export function Field({
  label,
  hint,
  wide,
  children,
}: {
  label: ReactNode
  hint?: ReactNode
  wide?: boolean
  children: ReactNode
}) {
  return (
    <div className={cn('up-f', wide && 'wide')}>
      <label className="up-f-label">{label}</label>
      {children}
      {hint ? <p className="up-f-hint">{hint}</p> : null}
    </div>
  )
}

/**
 * A switch with the same contract as the settings `Toggle`: `role="switch"`, `aria-checked`, and a click calls
 * `onChange(!checked)` unless disabled.
 */
export function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
  label?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cn('up-sw', checked && 'on')}
    >
      <i aria-hidden="true" />
    </button>
  )
}

/** Title and description(s) on the left, the switch on the right. */
export function ToggleRow({
  title,
  descriptions,
  control,
}: {
  title: ReactNode
  descriptions?: ReactNode[]
  control: ReactNode
}) {
  return (
    <div className="up-trow">
      <div className="up-trow-text">
        <b>{title}</b>
        {(descriptions || []).filter(Boolean).map((text, index) => (
          <small key={index}>{text}</small>
        ))}
      </div>
      {control}
    </div>
  )
}

export type ActionTone = 'blue' | 'purple' | 'amber' | 'red'

/** Full-width list row for an account action. `onClick` is the existing handler. */
export function ActionRow({
  title,
  subtitle,
  tone = 'blue',
  icon,
  busy,
  onClick,
}: {
  title: string
  subtitle?: string
  tone?: ActionTone
  icon: ProfileIconName
  busy?: boolean
  onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} disabled={busy} className={cn('up-act', tone)}>
      <span className={cn('up-atile', tone)} aria-hidden="true">
        <ProfileIcon name={icon} />
      </span>
      <span className="up-act-text">
        <b>{title}</b>
        {subtitle ? <small>{subtitle}</small> : null}
      </span>
      {busy ? (
        <svg className="up-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
          <path fill="currentColor" opacity="0.75" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4Z" />
        </svg>
      ) : (
        <span className="up-chev">
          <ProfileIcon name="right" />
        </span>
      )}
    </button>
  )
}

/** A static (non-button) list row in the actions list, for content with its own controls. */
export function ActionPanel({
  icon,
  tone = 'blue',
  children,
}: {
  icon: ProfileIconName
  tone?: ActionTone
  children: ReactNode
}) {
  return (
    <div className="up-act static">
      <span className={cn('up-atile', tone)} aria-hidden="true">
        <ProfileIcon name={icon} />
      </span>
      <div className="up-act-text">{children}</div>
    </div>
  )
}

/** Banner under the band (success, error, notices). Same text as before; `data-banner` marks it for checks. */
export function ProfileBanner({
  tone,
  children,
}: {
  tone: 'green' | 'red' | 'amber' | 'blue'
  children: ReactNode
}) {
  const icon: ProfileIconName = tone === 'green' ? 'check' : tone === 'blue' ? 'clock' : 'warn'
  return (
    <div className={cn('up-flash', tone)} data-banner={tone}>
      <ProfileIcon name={icon} />
      <div>{children}</div>
    </div>
  )
}

/** Shimmer line for the loading skeletons. */
export function Skel({ width, height, dark }: { width: string | number; height?: number; dark?: boolean }) {
  return <span className={cn('up-sk', dark && 'd')} style={{ width, height }} aria-hidden="true" />
}
