export function LogoMark({ size = 20 }: { size?: number }) {
  return (
    <span className="logo-mark" aria-hidden>
      <svg width={size} height={size} viewBox="0 0 20 20">
        <rect x="2" y="10" width="4" height="8" rx="1.5" fill="#fff" opacity=".65" />
        <rect x="8" y="6" width="4" height="12" rx="1.5" fill="#fff" opacity=".85" />
        <rect x="14" y="2" width="4" height="16" rx="1.5" fill="#fff" />
      </svg>
    </span>
  )
}
