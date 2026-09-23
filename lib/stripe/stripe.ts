import Stripe from 'stripe'

let stripeClient: Stripe | null = null

export function assertStripeTestKey(secretKey: string) {
  const mode = (process.env.STRIPE_MODE || '').trim().toLowerCase()
  const refuseLive = mode === 'test' || process.env.NODE_ENV !== 'production'
  if (refuseLive && /^(sk|rk|rkcs)_live_/.test(secretKey)) {
    throw new Error('Live Stripe keys are blocked while STRIPE_MODE=test (sandbox only).')
  }
}

export function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured')
  }
  assertStripeTestKey(secretKey)

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey, {
      apiVersion: '2026-08-26.dahlia',
      typescript: true,
    })
  }

  return stripeClient
}

export function getStripePublishableKey(): string | undefined {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
}

export function getAppBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    'http://localhost:3000'
  )
}
