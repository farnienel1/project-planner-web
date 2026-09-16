type AppLogoMarkProps = {
  size?: number
  radius?: number
  alt?: string
  className?: string
}

export function AppLogoMark({
  size = 120,
  radius = 26,
  alt = 'Project Planner',
  className = '',
}: AppLogoMarkProps) {
  return (
    <img
      src="/branding/app-logo.png"
      alt={alt}
      width={size}
      height={size}
      className={`object-cover ${className}`}
      style={{ width: size, height: size, borderRadius: radius }}
    />
  )
}
