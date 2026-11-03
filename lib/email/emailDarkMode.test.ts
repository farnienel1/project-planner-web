import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { buildInviteSetupEmailHtml } from './inviteSetupEmail.ts'
import { buildOrgAdditionEmailHtml } from './orgAdditionEmail.ts'
import { buildConfirmAccountEmailHtml } from './confirmAccountEmail.ts'
import {
  buildBillingPurchaseEmailHtml,
  buildPaymentFailedEmailHtml,
  buildTrialWillEndEmailHtml,
} from './billingPurchaseEmail.ts'
import { buildOwnerPasswordResetEmailHtml } from './ownerPasswordResetEmail.ts'
import { buildMaterialRequestEmail } from './materialRequestEmail.ts'
import { buildMfaEmailHtml } from '../auth/mfa/mfaEmail.ts'
import { supportContactMessage } from '../support/contactEmail.ts'
import { loginEmailFixMessage } from '../support/loginEmailFix.ts'
import { buildInterestAckHtml, buildInterestOwnerHtml } from '../interest/notifyEmail.ts'
import { managerExportEmailHTML } from '../timesheets/timesheetExport.ts'

/**
 * Every transactional email reads in light and dark mode: it declares both colour schemes, carries a
 * prefers-color-scheme block and the Outlook.com markers, and no text element relies on an inherited colour.
 * Contrast itself was checked by rendering (light, dark, forced inversion); see the PR.
 */
const require = createRequire(import.meta.url)
const fnTemplates = require('../../functions/email/templates.js')

const material = {
  supplierName: '',
  userName: 'Sam Taylor',
  userEmail: 'sam@example.com',
  userPhone: '07700 900123',
  userCompany: 'Acme',
  jobNumber: 'P-1',
  siteName: 'Site',
  deliveryAddress: '1 High Street',
  companyLogoURL: 'https://example.com/logo.png',
  materials: [{ material: 'Pipe', quantity: 2, unit: 'Number', notes: 'n' }],
  sentAt: new Date('2026-11-03T09:00:00Z'),
  deliveryRequiredLabel: 'Wednesday 4 November at 08:00',
}

const templates: Record<string, string> = {
  welcomePack: buildInviteSetupEmailHtml({ to: 'a@b.com', firstName: 'Sam', organizationName: 'Acme', invitationId: 'x', role: 'operative' }),
  orgAddition: buildOrgAdditionEmailHtml({ to: 'a@b.com', firstName: 'Sam', organizationName: 'Acme' }),
  confirmAccount: buildConfirmAccountEmailHtml({ to: 'a@b.com', firstName: 'Sam', organizationName: 'Acme', confirmationToken: 't' }),
  billingPurchase: buildBillingPurchaseEmailHtml({ to: 'a@b.com', firstName: 'Sam', organizationName: 'Acme', interval: 'month' }),
  trialWillEnd: buildTrialWillEndEmailHtml('19/11/2026', 'month'),
  paymentFailed: buildPaymentFailedEmailHtml('https://billing.example.com/p?a=1&b=2'),
  ownerPasswordReset: buildOwnerPasswordResetEmailHtml('https://example.com/reset?a=1&b=2'),
  mfa: buildMfaEmailHtml('123456'),
  supportContact: supportContactMessage({ name: 'Ada', email: 'ada@example.com', topic: 'Billing', message: 'Hi' } as never).html,
  loginEmailFix: loginEmailFixMessage(
    { organizationName: 'Org', organizationId: 'O', userName: 'U', userId: 'U1', oldEmail: 'a@b.com', newEmail: 'c@d.com', note: '' },
    { ownerConsoleUrl: 'https://example.com/developer/users?fix=U1' }
  ).html,
  interestOwner: buildInterestOwnerHtml({ firstName: 'A', lastName: 'B', company: 'C', email: 'a@b.com', phone: '', role: '', teamSize: '', sectors: [], currentTools: '', message: '', source: '', campaign: '' }),
  interestAck: buildInterestAckHtml({ firstName: 'A', company: 'C', unsubscribeUrl: 'https://example.com/u' }),
  timesheetExport: managerExportEmailHTML({ recipientName: 'M', weekTitle: 'W', paymentRunStamp: 'S', organizationName: 'O', attachmentNames: ['a.pdf'], timesheetCount: 1 }),
  materialQuote: buildMaterialRequestEmail({ context: material, isQuote: true, sendAsPlainText: false, contactName: 'W' }).html,
  materialOrder: buildMaterialRequestEmail({ context: material, isQuote: false, sendAsPlainText: false, contactName: 'W' }).html,
  materialPlainText: buildMaterialRequestEmail({ context: material, isQuote: false, sendAsPlainText: true, contactName: 'W' }).html,
  fnPasswordResetLink: fnTemplates.TEMPLATES.password_reset_link.render({
    recipient: { invitation: { firstName: 'Sam' }, invitationId: '3f1c2d4e-1111-4222-8333-944455556666' },
  }).html,
  fnLeaveCancelled: fnTemplates.TEMPLATES.leave_cancelled.render({
    data: { dateText: 'Mon 9 Nov' },
    recipient: { user: { firstName: 'Sam' } },
    caller: { displayName: 'Max' },
  }).html,
}

for (const [name, html] of Object.entries(templates)) {
  test(`${name} email declares light and dark mode`, () => {
    assert.match(html, /<meta name="color-scheme" content="light dark"/)
    assert.match(html, /<meta name="supported-color-schemes" content="light dark"/)
    assert.match(html, /:root\{color-scheme:light dark;/)
    assert.match(html, /@media \(prefers-color-scheme: dark\)\{/)
    assert.match(html, /\[data-ogsc\] \.[\w-]+\{color:/)
    assert.match(html, /\[data-ogsb\] \.[\w-]+\{background-color:/)
  })

  test(`${name} email gives every text tag its own colour`, () => {
    const bare = html.match(/<(p|h1|h2|h3|li|ul|pre|strong|a)(\s[^>]*)?>/g) ?? []
    const missing = bare.filter((tag) => !/style="[^"]*color:/.test(tag))
    assert.deepEqual(missing, [])
  })
}
