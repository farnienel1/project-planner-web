import Link from 'next/link'

type ProjectPlannerLogoProps = {
  href?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  subtitle?: string
  variant?: 'light' | 'dark'
  className?: string
}

const ICON_SIZES = {
  sm: 'h-9 w-9',
  md: 'h-10 w-10',
  lg: 'h-11 w-11',
  xl: 'h-14 w-14',
} as const

const SVG_SIZES = {
  sm: 'h-5 w-5',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
  xl: 'h-7 w-7',
} as const

const TITLE_SIZES = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
  xl: 'text-2xl',
} as const

function LogoMark({ size }: { size: 'sm' | 'md' | 'lg' | 'xl' }) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 ${ICON_SIZES[size]}`}
    >
      <svg className={SVG_SIZES[size]} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
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
      ? 'font-extrabold tracking-tight text-white'
      : 'font-extrabold tracking-tight text-slate-900'

  const subtitleClass = variant === 'dark' ? 'text-xs text-slate-300' : 'text-xs text-slate-500'

  const content = (
    <>
      <LogoMark size={size} />
      <div className="min-w-0">
        <p className={`${titleClass} ${TITLE_SIZES[size]}`}>Project Planner</p>
        {subtitle ? <p className={subtitleClass}>{subtitle}</p> : null}
      </div>
    </>
  )

  const baseClass = `inline-flex items-center gap-3 transition hover:opacity-90 ${className}`

  if (href) {
    return (
      <Link href={href} className={baseClass} aria-label="Project Planner home">
        {content}
      </Link>
    )
  }

  return <div className={baseClass}>{content}</div>
}
