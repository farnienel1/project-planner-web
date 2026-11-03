import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { format } from 'date-fns'
import { WELCOME_EMAIL_HTML_TEMPLATE, WELCOME_EMAIL_TEXT_TEMPLATE } from './welcomeEmailPack.ts'
import { buildMaterialRequestEmail } from './materialRequestEmail.ts'
import { managerExportEmailHTML } from '../timesheets/timesheetExport.ts'

/**
 * The `sendEmail` Cloud Function (functions/email) renders the app templates itself, from JavaScript copies of these
 * web builders. These tests fail when a copy drifts from the web builder (docs/EMAIL_FUNCTION.md).
 */
const require = createRequire(import.meta.url)
const fnPack = require('../../functions/email/welcomeEmailPack.js')
const fnMaterial = require('../../functions/email/materialRequestEmail.js')
const fnTemplates = require('../../functions/email/templates.js')

test('function welcome pack is byte-identical to lib/email/welcomeEmailPack.ts', () => {
  assert.equal(fnPack.WELCOME_EMAIL_HTML_TEMPLATE, WELCOME_EMAIL_HTML_TEMPLATE)
  assert.equal(fnPack.WELCOME_EMAIL_TEXT_TEMPLATE, WELCOME_EMAIL_TEXT_TEMPLATE)
})

const sentAt = new Date('2026-11-03T09:15:00Z')
const baseContext = {
  supplierName: '',
  userName: 'Farnie <O\'Neil>',
  userEmail: 'farnie@example.com',
  userPhone: '07700 900123',
  userCompany: 'Acme & Sons',
  jobNumber: 'P-104',
  siteName: 'City Hall',
  deliveryAddress: '1 High Street, London',
  companyLogoURL: 'https://example.com/logo.png',
  materials: [
    { material: '22mm copper "pipe"', quantity: 4, unit: 'length', brand: 'Yorkshire', productCode: 'YP22', notes: 'Bent <ok>', lengthDisplay: '3m' },
    { material: 'Elbow', quantity: 1, unit: 'Number' },
  ],
  deliveryRequiredLabel: 'Wednesday 4 November at 08:00',
}

for (const isQuote of [true, false]) {
  for (const sendAsPlainText of [true, false]) {
    test(`function material email matches the web builder (quote ${isQuote}, plain ${sendAsPlainText})`, () => {
      const web = buildMaterialRequestEmail({
        context: { ...baseContext, sentAt },
        isQuote,
        sendAsPlainText,
        contactName: 'Wendy Holesale',
      })
      const fn = fnMaterial.buildMaterialRequestEmail({
        context: { ...baseContext, sentLabel: format(sentAt, "EEEE, d MMMM yyyy 'at' HH:mm") },
        isQuote,
        sendAsPlainText,
        contactName: 'Wendy Holesale',
      })
      assert.equal(fn.subject, web.subject)
      assert.equal(fn.html, web.html)
    })
  }
}

test('function timesheet export email matches managerExportEmailHTML', () => {
  for (const downloadLinks of [[], [{ fileName: "O'Neil.pdf", url: 'https://firebasestorage.googleapis.com/x?a=1&b=2' }]]) {
    for (const timesheetCount of [1, 3]) {
      const input = {
        recipientName: 'Max <M>',
        weekTitle: 'Week 44',
        paymentRunStamp: '26.10.26 01.11.26',
        organizationName: 'Acme & "Sons"',
        attachmentNames: ["O'Neil.pdf", 'B.pdf'],
        downloadLinks,
        timesheetCount,
      }
      assert.equal(fnTemplates.managerExportEmailHTML(input), managerExportEmailHTML(input))
    }
  }
})
