import Link from 'next/link'

type ProjectPlannerLogoProps = {
  href?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  subtitle?: string
  variant?: 'light' | 'dark'
  className?: string
}

const ICON_SIZES = {
  sm: 'h-8 w-8',
  md: 'h-9 w-9',
  lg: 'h-10 w-10',
  xl: 'h-11 w-11',
} as const

const SVG_SIZES = {
  sm: 'h-4 w-4',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
  xl: 'h-5 w-5',
} as const

const TITLE_SIZES = {
  sm: 'text-[13px]',
  md: 'text-sm',
  lg: 'text-base',
  xl: 'text-lg',
} as const

function LogoMark({ size, variant }: { size: 'sm' | 'md' | 'lg' | 'xl'; variant: 'light' | 'dark' }) {
  const markClass =
    variant === 'dark'
      ? 'bg-white text-slate-900'
      : 'bg-slate-900 text-white'

  return (
    <span className={`grid shrink-0 place-items-center rounded-lg ${markClass} ${ICON_SIZES[size]}`}>
      <svg className={SVG_SIZES[size]} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      </svg>
    </span>
  )
}

export function ProjectPlannerLogo({
  href = '/',
  size = 'md',
  subtitle,
  variant = 'light',
  className = '',
}: ProjectPlannerLogoProps) {
  const titleClass =
    variant === 'dark'
      ? 'font-semibold tracking-tight text-white'
      : 'font-semibold tracking-tight text-slate-900'

  const subtitleClass = variant === 'dark' ? 'text-[11px] text-slate-400' : 'text-[11px] text-slate-500'

  const content = (
    <>
      <LogoMark size={size} variant={variant} />
      <div className="min-w-0">
        <p className={`${titleClass} ${TITLE_SIZES[size]}`}>Project Planner</p>
        {subtitle ? <p className={subtitleClass}>{subtitle}</p> : null}
      </div>
    </>
  )

  const baseClass = `inline-flex items-center gap-2.5 transition hover:opacity-80 ${className}`

  if (href) {
    return (
      <Link href={href} className={baseClass} aria-label="Project Planner home">
        {content}
      </Link>
    )
  }

  return <div className={baseClass}>{content}</div>
}
