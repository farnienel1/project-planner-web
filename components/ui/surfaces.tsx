import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/ui/cn'
import type { SectionHue } from '@/lib/ui/sectionHue'
import { IconChip } from '@/components/ui/IconChip'
import { Button } from '@/components/ui/Button'

export function PageHeader({
  title,
  subtitle,
  hue = 'blue',
  icon,
  actions,
}: {
  title: string
  subtitle?: string
  hue?: SectionHue
  icon?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mb-[22px] mt-2.5 flex flex-wrap items-center gap-4" data-hue={hue}>
      {icon ? <div className="grid h-[52px] w-[52px] place-items-center rounded-[16px] bg-[var(--ht)] text-[var(--h)]">{icon}</div> : null}
      <div className="min-w-0">
        <h1 className="text-[28px] font-extrabold leading-[1.15] max-[760px]:text-2xl">{title}</h1>
        {subtitle ? <p className="mt-[3px] text-[14.5px] text-[var(--ink3)]">{subtitle}</p> : null}
      </div>
      {actions ? <div className="ml-auto flex flex-wrap items-center gap-2.5">{actions}</div> : null}
    </div>
  )
}

export function Hero({
  hue,
  eyebrow,
  title,
  subtitle,
  stats,
  actions,
  className,
}: {
  hue?: SectionHue
  eyebrow?: string
  title: ReactNode
  subtitle?: ReactNode
  stats?: { label: string; value: ReactNode; onClick?: () => void }[]
  actions?: ReactNode
  className?: string
}) {
  return (
    <section
      data-hue={hue}
      className={cn(
        'relative overflow-hidden rounded-[24px] px-[30px] py-7 text-white shadow-[0_18px_40px_rgba(12,35,80,.25)] max-[760px]:px-[22px]',
        hue
          ? 'bg-[linear-gradient(rgba(255,255,255,.1)_1px,transparent_1px)_0_0/28px_28px,linear-gradient(90deg,rgba(255,255,255,.1)_1px,transparent_1px)_0_0/28px_28px,linear-gradient(135deg,color-mix(in_srgb,var(--h)_80%,#000)_0%,var(--h)_100%)]'
          : 'bg-[linear-gradient(rgba(255,255,255,.07)_1px,transparent_1px)_0_0/28px_28px,linear-gradient(90deg,rgba(255,255,255,.07)_1px,transparent_1px)_0_0/28px_28px,radial-gradient(120%_140%_at_100%_0%,#3B86EA_0%,transparent_55%),linear-gradient(135deg,var(--navy)_0%,#15408A_55%,#1E5AA8_100%)]',
        className
      )}
    >
      <div className="pointer-events-none absolute -right-[60px] -bottom-[60px] h-[260px] w-[260px] rounded-full border border-dashed border-white/20" />
      <div className="relative z-[1]">
        {eyebrow ? <p className="text-[13px] font-semibold opacity-80">{eyebrow}</p> : null}
        <div className="mt-1.5 font-[family-name:var(--head)] text-[34px] font-extrabold leading-[1.1] tracking-[-0.02em] max-[760px]:text-[28px]">
          {title}
        </div>
        {subtitle ? <div className="mt-1.5 text-[15.5px] opacity-85">{subtitle}</div> : null}
        {stats && stats.length > 0 ? (
          <div className="mt-[22px] flex flex-wrap gap-3">
            {stats.map((stat) => {
              const inner = (
                <>
                  <b className="block font-[family-name:var(--head)] text-[26px] leading-[1.15] tabular-nums">{stat.value}</b>
                  <span className="text-[13px] opacity-85">{stat.label}</span>
                </>
              )
              return stat.onClick ? (
                <button
                  key={stat.label}
                  type="button"
                  onClick={stat.onClick}
                  className="min-w-[130px] rounded-2xl border border-white/16 bg-white/12 px-4 py-3 text-left text-white backdrop-blur-sm hover:bg-white/20"
                >
                  {inner}
                </button>
              ) : (
                <div key={stat.label} className="min-w-[130px] rounded-2xl border border-white/16 bg-white/12 px-4 py-3">
                  {inner}
                </div>
              )
            })}
          </div>
        ) : null}
        {actions ? <div className="mt-[18px] flex flex-wrap gap-2.5">{actions}</div> : null}
      </div>
    </section>
  )
}

export function StatCard({
  label,
  value,
  hue = 'blue',
  icon,
  selected,
  onClick,
  hint,
}: {
  label: string
  value: ReactNode
  hue?: SectionHue
  icon?: ReactNode
  selected?: boolean
  onClick?: () => void
  hint?: string
}) {
  const className = cn(
    'flex w-full items-center gap-3.5 rounded-[18px] bg-[var(--card)] px-5 py-[18px] text-left shadow-[var(--sh)]',
    onClick && 'cursor-pointer transition hover:-translate-y-0.5 hover:shadow-[var(--sh-hover)]',
    selected && 'shadow-[0_0_0_2px_var(--h),var(--sh)]'
  )
  const body = (
    <>
      {icon ? <IconChip hue={hue}>{icon}</IconChip> : null}
      <div className="min-w-0">
        <b className="block font-[family-name:var(--head)] text-[26px] font-extrabold leading-tight tabular-nums">{value}</b>
        <span className="text-[13.5px] font-medium text-[var(--ink3)]">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs text-[var(--ink3)]">{hint}</span> : null}
      </div>
    </>
  )
  if (onClick) {
    return (
      <button type="button" data-hue={hue} onClick={onClick} className={className}>
        {body}
      </button>
    )
  }
  return (
    <div data-hue={hue} className={className}>
      {body}
    </div>
  )
}

export function Tile({
  label,
  hue = 'blue',
  icon,
  count,
  onClick,
}: {
  label: string
  hue?: SectionHue
  icon: ReactNode
  count?: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      data-hue={hue}
      onClick={onClick}
      className="relative flex flex-col items-center gap-3 rounded-[18px] bg-[var(--card)] px-3.5 pb-4 pt-[18px] text-[14.5px] font-semibold text-[var(--ink)] shadow-[var(--sh)] transition hover:-translate-y-[3px] hover:shadow-[var(--sh-hover)]"
    >
      <IconChip hue={hue} className="h-[52px] w-[52px] rounded-2xl">
        {icon}
      </IconChip>
      {label}
      {typeof count === 'number' ? (
        <span className="absolute right-2.5 top-2.5 grid min-w-[24px] place-items-center rounded-full bg-[var(--h)] px-1.5 text-xs font-bold text-white">
          {count}
        </span>
      ) : null}
    </button>
  )
}

export function ListRow({
  title,
  subtitle,
  hue = 'blue',
  icon,
  right,
  accent,
  selected,
  onClick,
}: {
  title: string
  subtitle?: string
  hue?: SectionHue
  icon?: ReactNode
  right?: ReactNode
  accent?: boolean
  selected?: boolean
  onClick?: () => void
}) {
  const className = cn(
    'flex w-full items-center gap-3.5 rounded-[14px] bg-[var(--card)] px-4 py-3.5 text-left shadow-[var(--sh)]',
    onClick && 'cursor-pointer transition hover:-translate-y-px hover:shadow-[var(--sh-hover)]',
    accent && 'shadow-[inset_4px_0_0_var(--h),var(--sh)]',
    selected && 'shadow-[0_0_0_2px_var(--blue),var(--sh)]'
  )
  const body = (
    <>
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold leading-snug">{title}</span>
        {subtitle ? <span className="block truncate text-[13px] text-[var(--ink3)]">{subtitle}</span> : null}
      </span>
      {right}
    </>
  )
  if (onClick) {
    return (
      <button type="button" data-hue={hue} onClick={onClick} className={className}>
        {body}
      </button>
    )
  }
  return (
    <div data-hue={hue} className={className}>
      {body}
    </div>
  )
}

export function Banner({
  hue = 'warn',
  icon,
  title,
  children,
  action,
}: {
  hue?: SectionHue
  icon?: ReactNode
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div data-hue={hue} className="flex items-center gap-3.5 rounded-[14px] bg-[var(--ht)] px-[18px] py-3.5 text-[var(--ink)]">
      {icon ? <IconChip hue={hue} solid className="h-[38px] w-[38px]">
        {icon}
      </IconChip> : null}
      <div className="min-w-0 flex-1">
        <b className="font-bold">{title}</b>
        {children ? <div className="text-sm text-[var(--ink2)]">{children}</div> : null}
      </div>
      {action}
    </div>
  )
}

export function EmptyState({
  hue = 'lib',
  icon,
  title,
  subtitle,
  action,
}: {
  hue?: SectionHue
  icon?: ReactNode
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div data-hue={hue} className="px-5 py-10 text-center">
      {icon ? <div className="mx-auto mb-3.5">{icon}</div> : null}
      <h3 className="mb-1.5 text-lg font-bold">{title}</h3>
      {subtitle ? <p className="mx-auto mb-[18px] max-w-[420px] text-[var(--ink3)]">{subtitle}</p> : null}
      {action}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'h-3.5 animate-pulse rounded-[10px] bg-[linear-gradient(90deg,var(--soft2)_25%,var(--soft)_50%,var(--soft2)_75%)] bg-[length:200%_100%]',
        className
      )}
    />
  )
}

export function Card({ children, className, padded }: { children: ReactNode; className?: string; padded?: boolean }) {
  return <div className={cn('rounded-[18px] bg-[var(--card)] shadow-[var(--sh)]', padded && 'p-[22px]', className)}>{children}</div>
}

export function HeroButton({ solid, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { solid?: boolean }) {
  return (
    <Button
      {...props}
      className={cn(
        solid ? 'bg-white text-[var(--navy)] shadow-none' : 'border border-white/20 bg-white/16 text-white shadow-none hover:bg-white/26',
        props.className
      )}
    >
      {children}
    </Button>
  )
}
