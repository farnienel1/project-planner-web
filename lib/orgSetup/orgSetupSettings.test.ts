import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LOGO_MAX_BYTES, validateLogoFile } from './orgSetupSettings.ts'

test('logo cap matches storage.rules 5MB image-or-PDF write', () => {
  assert.equal(LOGO_MAX_BYTES, 5 * 1024 * 1024)
  assert.equal(validateLogoFile({ name: 'mark.png', type: 'image/png', size: 1024 }), null)
  assert.equal(validateLogoFile({ name: 'mark.pdf', type: 'application/pdf', size: 1024 }), null)
  assert.equal(
    validateLogoFile({ name: 'mark.png', type: 'image/png', size: LOGO_MAX_BYTES }),
    null
  )
  assert.equal(
    validateLogoFile({ name: 'mark.png', type: 'image/png', size: LOGO_MAX_BYTES + 1 }),
    'Logo must be 5 MB or smaller.'
  )
  assert.equal(
    validateLogoFile({ name: 'notes.txt', type: 'text/plain', size: 1024 }),
    'Logo must be a JPEG, PNG or PDF file.'
  )
})

test('1.23.1 guided setup working hours run validatePayrollTimePolicy, weekend breaks included', async () => {
  const { createDefaultFeaturesSetup, orgSetupWorkingHoursError } = await import('./orgSetupSettings.ts')
  const features = createDefaultFeaturesSetup()
  assert.equal(orgSetupWorkingHoursError(features), null)
  const withSaturday = (saturday: Record<string, unknown>) => ({
    payrollTimePolicy: { ...features.payrollTimePolicy, saturday: { ...features.payrollTimePolicy.saturday, ...saturday } },
  })
  assert.equal(orgSetupWorkingHoursError(withSaturday({ breakPaid: false, breakMinutes: 30, breakWindowStart: '12:00', breakWindowEnd: '12:30' })), null)
  assert.match(String(orgSetupWorkingHoursError(withSaturday({ breakMinutes: 150 }))), /Saturday break length/)
  assert.ok(orgSetupWorkingHoursError(withSaturday({ breakMinutes: 40 })))
  assert.ok(orgSetupWorkingHoursError(withSaturday({ breakWindowStart: '12:30', breakWindowEnd: '12:00' })))
  assert.ok(orgSetupWorkingHoursError(withSaturday({ breakWindowStart: '12:10', breakWindowEnd: '12:40' })))
})
