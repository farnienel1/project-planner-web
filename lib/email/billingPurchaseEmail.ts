// Transactional: no marketing content
import { emailBrand, emailDocument, emailHeading, emailLink, emailStrong, emailText } from '@/lib/email/emailTheme'
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
  return emailText(`${escapeHtml(SUBSCRIPTION_PRICE_DISCLOSURE)}${chosen}`)
}

export function buildBillingPurchaseEmailHtml(params: BillingPurchaseEmailParams): string {
  const safeName = escapeHtml(params.firstName.trim() || 'there')
  const safeOrg = escapeHtml(params.organizationName)

  return emailDocument({
    title: 'Your subscription is set up',
    maxWidth: 560,
    body: [
      emailBrand(),
      emailHeading('Your subscription is set up'),
      emailText(`Hi ${safeName},`),
      emailText(
        `${emailStrong(safeOrg)} is now on a Project Planner subscription. This email confirms the price and how to cancel.`
      ),
      billingTermsParagraphHtml(params.interval),
      emailText(
        'Open Settings → Billing → Manage billing in the web app to update your card or cancel. Access continues until the period end shown there.',
        'muted',
        'margin:0;'
      ),
    ].join('\n'),
  })
}

export function billingPurchaseEmailSubject(organizationName: string): string {
  return `Your Project Planner subscription — ${sanitizeEmailHeader(organizationName)}`
}

export function buildTrialWillEndEmailHtml(endLabel: string, interval?: 'month' | 'year' | null): string {
  const amount = priceLabelForBillingInterval(interval)
  return emailDocument({
    title: 'Your Project Planner trial ends in 3 days',
    maxWidth: 560,
    body: [
      emailText(`Your 30-day Project Planner trial ends on ${escapeHtml(endLabel)}.`),
      emailText(
        `We will then charge ${escapeHtml(amount)}. VAT is not charged. After that charge the subscription renews automatically at that price until you cancel.`
      ),
      emailText('Cancel any time from Settings → Billing.', 'ink', 'margin:0;'),
    ].join('\n'),
  })
}

/** `invoice.payment_failed`: the Stripe customer portal (or billing settings) link is passed in unescaped. */
export function buildPaymentFailedEmailHtml(link: string): string {
  return emailDocument({
    title: 'Project Planner payment failed',
    maxWidth: 560,
    body: [
      emailText('We could not take the latest Project Planner payment.'),
      emailText(emailLink(escapeHtml(link), 'Update your payment method')),
      emailText('Access stays open for 7 days.', 'ink', 'margin:0;'),
    ].join('\n'),
  })
}
