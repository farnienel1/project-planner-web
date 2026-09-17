import Link from 'next/link'
import { AppLogoMark } from '@/components/ui/AppLogoMark'

type ProjectPlannerLogoProps = {
  href?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  subtitle?: string
  variant?: 'light' | 'dark'
  className?: string
}

const ICON_PX = {
  sm: 36,
  md: 40,
  lg: 44,
  xl: 56,
} as const

const TITLE_SIZES = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
  xl: 'text-2xl',
} as const

function LogoMark({ size }: { size: 'sm' | 'md' | 'lg' | 'xl' }) {
  const px = ICON_PX[size]
  return (
    <span className="shrink-0 overflow-hidden rounded-xl shadow-lg shadow-blue-500/20">
      <AppLogoMark size={px} radius={12} />
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
