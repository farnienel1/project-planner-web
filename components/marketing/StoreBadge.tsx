import { APP_STORE_URL, PLAY_STORE_URL } from '@/lib/marketing/content'
import { MktIcon } from '@/components/marketing/icons'

export function StoreBadge({
  store,
  height = 54,
}: {
  store: 'ios' | 'android'
  height?: number
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
      style={{ height }}
    >
      <MktIcon name={store === 'ios' ? 'apple' : 'android'} size={store === 'ios' ? 20 : 22} />
      <span>
        <small>{kicker}</small>
        {label}
      </span>
    </a>
  )
}
