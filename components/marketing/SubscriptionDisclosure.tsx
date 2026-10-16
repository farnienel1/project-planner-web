import type { CSSProperties } from 'react'
import { SUBSCRIPTION_PRICE_DISCLOSURE } from '@/lib/stripe/billing'

export function SubscriptionDisclosure({
  className = 'muted xs',
  style,
}: {
  className?: string
  style?: CSSProperties
}) {
  return (
    <p className={className} style={style}>
      {SUBSCRIPTION_PRICE_DISCLOSURE}
    </p>
  )
}
