import { APP_STORE_URL, PLAY_STORE_URL } from '@/lib/marketing/content'
import { MktIcon } from '@/components/marketing/icons'

export function StoreBadge({
  store,
}: {
  store: 'ios' | 'android'
}) {
  const href = store === 'ios' ? APP_STORE_URL : PLAY_STORE_URL
  const label = store === 'ios' ? 'App Store' : 'Google Play'
  const kicker = store === 'ios' ? 'Download on the' : 'Get it on'
  return (
    <a
      className="store"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        height: 56,
        padding: '0 16px',
        borderRadius: 14,
        background: 'var(--ink)',
        color: '#fff',
        fontWeight: 700,
        lineHeight: 1.1,
        overflow: 'hidden',
        boxSizing: 'border-box',
        flex: 'none',
        whiteSpace: 'nowrap',
        textDecoration: 'none',
      }}
    >
      <MktIcon name={store === 'ios' ? 'apple' : 'android'} size={18} />
      <span style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', lineHeight: 1.15, textAlign: 'left', fontSize: 13, color: '#fff' }}>
        <small style={{ display: 'block', fontSize: 10, fontWeight: 500, opacity: 0.8, lineHeight: 1.15 }}>{kicker}</small>
        {label}
      </span>
    </a>
  )
}
