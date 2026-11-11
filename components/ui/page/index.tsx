/**
 * Shared page building blocks for the web pages UI pack (docs/design/web-pages-ui/web-pages-ui-spec.md §2).
 * Presentational only: every component renders what it is given and calls the handler it is given. No data,
 * no rules, no navigation of its own. Styles: app/pages-ui.css (`pu-*`, light and dark).
 */
'use client'

import '@/app/pages-ui.css'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/ui/cn'

export type PuTone = 'blue' | 'amber' | 'red' | 'green' | 'slate' | 'purple' | 'brown' | 'outline'
export type PuTileTone = 'blue' | 'purple' | 'green' | 'amber' | 'red' | 'brown' | 'slate'

export function PageShell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('pu-page', className)}>{children}</div>
}

export function PageBand({
  eyebrow,
  title,
  titleSuffix,
  subtitle,
  back,
  actions,
  aside,
  children,
}: {
  eyebrow?: ReactNode
  title?: ReactNode
  titleSuffix?: ReactNode
  subtitle?: ReactNode
  /** The existing back control: same label and handler as before. */
  back?: { label: string; onClick: () => void }
  actions?: ReactNode
  /** Right-hand figure such as a total. Display only. */
  aside?: ReactNode
  /** StatRow and glass panels. */
  children?: ReactNode
}) {
  return (
    <section className="pu-band">
      <div className="pu-band-top">
        <div className="pu-band-text">
          {back ? (
            <button type="button" className="pu-back" onClick={back.onClick}>
              <span aria-hidden="true">‹</span> {back.label}
            </button>
          ) : null}
          {eyebrow ? <div className="pu-eyebrow">{eyebrow}</div> : null}
          {title != null ? (
            <h1>
              {title}
              {titleSuffix ? <small> {titleSuffix}</small> : null}
            </h1>
          ) : null}
          {subtitle ? <p className="pu-band-sub">{subtitle}</p> : null}
        </div>
        {aside ? <div className="pu-band-aside">{aside}</div> : null}
        {actions ? <div className="pu-band-actions">{actions}</div> : null}
      </div>
      {children}
    </section>
  )
}

export type StatItem = { value: ReactNode; label: ReactNode; tone?: 'amber' | 'red' }

/** Display-only figures: never clickable (spec §1). */
export function StatRow({ items }: { items: StatItem[] }) {
  if (items.length === 0) return null
  return (
    <div className="pu-stats">
      {items.map((item, index) => (
        <div key={index} className={cn('pu-stat', item.tone)}>
          <b>{item.value}</b>
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  )
}

export function Card({
  title,
  subtitle,
  count,
  icon,
  actions,
  tone,
  children,
  className,
}: {
  title?: ReactNode
  subtitle?: ReactNode
  count?: ReactNode
  icon?: ReactNode
  actions?: ReactNode
  tone?: 'red'
  children?: ReactNode
  className?: string
}) {
  return (
    <section className={cn('pu-card', tone, className)}>
      {title != null || actions ? (
        <div className="pu-card-h">
          {icon}
          <h2>
            {title}
            {subtitle ? <span className="pu-card-sub" style={{ display: 'block' }}>{subtitle}</span> : null}
          </h2>
          {count != null ? <span className="pu-count">{count}</span> : null}
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  )
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('pu-card-b', className)}>{children}</div>
}

export type DataColumn = { key: string; label: ReactNode; align?: 'left' | 'right'; srOnly?: boolean }

export function DataTable({ columns, children, foot }: { columns: DataColumn[]; children: ReactNode; foot?: ReactNode }) {
  return (
    <div className="pu-tw">
      <table className="pu-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={column.align === 'right' ? 'num' : undefined} scope="col">
                {column.srOnly ? <span className="sr-only">{column.label}</span> : column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
        {foot ? <tfoot>{foot}</tfoot> : null}
      </table>
    </div>
  )
}

export type SegmentItem<T extends string> = { id: T; label: ReactNode; count?: ReactNode }

/** Drives the caller's existing tab state: `onChange` is the existing handler. */
export function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  dark,
  full,
}: {
  items: SegmentItem<T>[]
  value: T
  onChange: (id: T) => void
  ariaLabel: string
  dark?: boolean
  full?: boolean
}) {
  return (
    <div className={cn('pu-seg', dark && 'dark', full && 'full')} role="group" aria-label={ariaLabel}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={value === item.id ? 'on' : undefined}
          aria-pressed={value === item.id}
          onClick={() => onChange(item.id)}
        >
          {item.label}
          {item.count != null ? <span className="k">{item.count}</span> : null}
        </button>
      ))}
    </div>
  )
}

export function Chip({ tone = 'slate', children, title }: { tone?: PuTone; children: ReactNode; title?: string }) {
  return (
    <span className={cn('pu-chip', `pu-c-${tone}`)} title={title}>
      {children}
    </span>
  )
}

export function IconTile({
  tone = 'blue',
  size,
  round,
  children,
}: {
  tone?: PuTileTone
  size?: 'sm' | 'lg'
  round?: boolean
  children: ReactNode
}) {
  return (
    <span className={cn('pu-tile', `pu-t-${tone}`, size, round && 'round')} aria-hidden="true">
      {children}
    </span>
  )
}

/** A whole-card button. `onClick` is the existing handler; the "Open" line is decoration. */
export function ActionCard({
  tile,
  title,
  description,
  children,
  cta = 'Open',
  onClick,
  disabled,
}: {
  tile: ReactNode
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  cta?: ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button type="button" className="pu-action" onClick={onClick} disabled={disabled}>
      <span className="pu-action-row">
        {tile}
        <span style={{ minWidth: 0 }}>
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </span>
      </span>
      {children}
      <span className="pu-go">
        {cta} <span aria-hidden="true">→</span>
      </span>
    </button>
  )
}

export function EmptyState({
  title,
  description,
  tile,
  children,
}: {
  title: ReactNode
  description?: ReactNode
  tile?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="pu-empty">
      {tile}
      <b>{title}</b>
      {description ? <span>{description}</span> : null}
      {children}
    </div>
  )
}

export function WarnIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.4 1.4 21h21.2L12 2.4zm1.15 13.3h-2.3v-5.1h2.3v5.1zm0 3.3h-2.3v-2h2.3v2z" />
    </svg>
  )
}

export function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" strokeLinecap="round" />
    </svg>
  )
}

export function Note({
  tone = 'info',
  icon,
  children,
  role,
}: {
  tone?: 'info' | 'amber' | 'red' | 'green' | 'slate' | 'dark'
  icon?: ReactNode | false
  children: ReactNode
  role?: 'status' | 'alert'
}) {
  const shown = icon === false ? null : icon ?? (tone === 'red' || tone === 'amber' ? <WarnIcon /> : <InfoIcon />)
  return (
    <div className={cn('pu-note', tone)} role={role}>
      {shown}
      <div>{children}</div>
    </div>
  )
}

export function Modal({
  title,
  tile,
  headerStart,
  headerEnd,
  children,
  footer,
  size,
  labelledBy,
}: {
  title: ReactNode
  tile?: ReactNode
  /** e.g. the existing Cancel control. */
  headerStart?: ReactNode
  headerEnd?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  size?: 'sm'
  labelledBy?: string
}) {
  return (
    <div className="pu-modal-wrap">
      <div className={cn('pu-modal', size)} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        <div className="pu-modal-h">
          {tile}
          <h2 id={labelledBy}>{title}</h2>
          {headerStart}
          {headerEnd}
        </div>
        {children ? <div className="pu-modal-b">{children}</div> : null}
        {footer ? <div className="pu-modal-f">{footer}</div> : null}
      </div>
    </div>
  )
}

export function PuButton({
  variant,
  size,
  block,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'green' | 'white' | 'ghost-dark'
  size?: 'sm'
  block?: boolean
}) {
  return <button type="button" {...rest} className={cn('pu-btn', variant, size, block && 'block', className)} />
}

/** Two-letter initials for an avatar tile (display only). */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}
