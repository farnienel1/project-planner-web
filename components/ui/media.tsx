import type { ReactNode } from 'react'
import { cn } from '@/lib/ui/cn'
import type { SectionHue } from '@/lib/ui/sectionHue'
import { StatusPill } from '@/components/ui/controls'

export function Avatar({
  initials,
  size = 36,
  gradient = 'linear-gradient(135deg,#C2416B,#8B2FB0)',
  className,
}: {
  initials: string
  size?: number
  gradient?: string
  className?: string
}) {
  return (
    <span
      className={cn('inline-grid shrink-0 place-items-center rounded-full font-bold text-white', className)}
      style={{
        width: size,
        height: size,
        background: gradient,
        fontSize: Math.max(11, Math.round(size * 0.32)),
        fontFamily: 'var(--head)',
      }}
    >
      {initials}
    </span>
  )
}

export function ProgressBar({ value, hue = 'blue' }: { value: number; hue?: SectionHue }) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div data-hue={hue} className="h-2 overflow-hidden rounded-full bg-[var(--soft2)]">
      <i
        className="block h-full rounded-full bg-[linear-gradient(90deg,var(--h),color-mix(in_srgb,var(--h)_70%,#fff))]"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export function ProgressRing({ value, hue = 'blue', size = 56 }: { value: number; hue?: SectionHue; size?: number }) {
  const pct = Math.max(0, Math.min(100, value))
  const r = (size - 8) / 2
  const c = 2 * Math.PI * r
  return (
    <div data-hue={hue} className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--soft2)" strokeWidth="7" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--h)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
        />
      </svg>
      <b className="absolute font-[family-name:var(--head)] text-[13px] font-extrabold">{Math.round(pct)}%</b>
    </div>
  )
}

export function ProjectCard({
  hue = 'proj',
  jobNumber,
  type,
  name,
  progress,
  client,
  programme,
  site,
  status,
  footer,
  onClick,
}: {
  hue?: SectionHue
  jobNumber: string
  type?: string
  name: string
  progress: number
  client?: string
  programme?: string
  site?: string
  status?: string
  footer?: ReactNode
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      data-hue={hue}
      onClick={onClick}
      className="flex flex-col overflow-hidden rounded-[22px] bg-[var(--card)] text-left shadow-[var(--sh)] transition hover:-translate-y-[3px] hover:shadow-[var(--sh-hover)]"
    >
      <div className="flex items-center gap-3.5 bg-[linear-gradient(135deg,var(--ht),color-mix(in_srgb,var(--ht)_40%,var(--card)))] px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="font-[family-name:var(--head)] text-[13px] font-extrabold text-[var(--h)]">{jobNumber}</p>
          <h3 className="mt-0.5 text-lg font-bold">{name}</h3>
          {type ? <p className="text-[13px] text-[var(--ink2)]">{type}</p> : null}
        </div>
        <ProgressRing value={progress} hue={hue} />
      </div>
      <div className="flex flex-col gap-3 px-5 pb-[18px] pt-4">
        <div className="grid grid-cols-2 gap-x-3.5 gap-y-2.5 text-[13.5px]">
          <div>
            <span className="block text-xs font-semibold text-[var(--ink3)]">Client</span>
            {client || '—'}
          </div>
          <div>
            <span className="block text-xs font-semibold text-[var(--ink3)]">Programme</span>
            {programme || '—'}
          </div>
          <div>
            <span className="block text-xs font-semibold text-[var(--ink3)]">Site</span>
            {site || '—'}
          </div>
          <div>
            <span className="block text-xs font-semibold text-[var(--ink3)]">Status</span>
            {status ? <StatusPill status={status} /> : '—'}
          </div>
        </div>
        {footer ? <div className="flex items-center gap-2.5 border-t border-[var(--line)] pt-3">{footer}</div> : null}
      </div>
    </button>
  )
}
