// Transactional: no marketing content
import { escapeHtml, sanitizeEmailHeader } from '@/lib/security/htmlEscape'
import {
  SUBSCRIPTION_PRICE_DISCLOSURE,
  priceLabelForBillingInterval,
} from '@/lib/stripe/billing'

export type BillingPurchaseEmailParams = {
  to: string
  firstName: string
  organizationName: string
  interval?: 'month' | 'year' | null
}

export function billingTermsParagraphHtml(interval?: 'month' | 'year' | null): string {
  const chosen = interval ? ` You chose ${escapeHtml(priceLabelForBillingInterval(interval))}.` : ''
  return `<p>${escapeHtml(SUBSCRIPTION_PRICE_DISCLOSURE)}${chosen}</p>`
}

export function buildBillingPurchaseEmailHtml(params: BillingPurchaseEmailParams): string {
  const safeName = escapeHtml(params.firstName.trim() || 'there')
  const safeOrg = escapeHtml(params.organizationName)

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.5; color: #0f172a; max-width: 560px;">
      <p style="font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700;">Project Planner</p>
      <h1 style="font-size: 24px; margin: 12px 0;">Your subscription is set up</h1>
      <p>Hi ${safeName},</p>
      <p>
        <strong>${safeOrg}</strong> is now on a Project Planner subscription. This email confirms the price and how to cancel.
      </p>
      ${billingTermsParagraphHtml(params.interval)}
      <p style="font-size: 14px; color: #475569;">
        Open Settings → Billing → Manage billing in the web app to update your card or cancel. Access continues until the period end shown there.
      </p>
    </div>
  `.trim()
}

export function billingPurchaseEmailSubject(organizationName: string): string {
  return `Your Project Planner subscription — ${sanitizeEmailHeader(organizationName)}`
}

export function buildTrialWillEndEmailHtml(endLabel: string, interval?: 'month' | 'year' | null): string {
  const amount = priceLabelForBillingInterval(interval)
  return (
    `<p>Your 30-day Project Planner trial ends on ${escapeHtml(endLabel)}.</p>` +
    `<p>We will then charge ${escapeHtml(amount)}. VAT is not charged. After that charge the subscription renews automatically at that price until you cancel.</p>` +
    `<p>Cancel any time from Settings → Billing.</p>`
  )
}
