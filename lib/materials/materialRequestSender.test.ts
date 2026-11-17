import { test } from 'node:test'
import assert from 'node:assert/strict'
import { materialRequestSender } from './materialRequestSender'

test('the sender comes from the caller\'s own users document, token email and stored organisation only', () => {
  const sender = materialRequestSender({
    tokenEmail: ' Ann@Example.com ',
    callerDoc: { firstName: 'Ann', surname: 'Smith', mobileNumber: '07700 900000', role: 'admin' },
    orgDoc: { name: 'Acme Electrical', companyLogoURL: 'https://cdn.example/logo.png' },
  })
  assert.deepEqual(sender, {
    name: 'Ann Smith',
    email: 'ann@example.com',
    phone: '07700 900000',
    company: 'Acme Electrical',
    logoURL: 'https://cdn.example/logo.png',
  })
})

test('a caller with no name falls back to their email; no stored organisation gives no company', () => {
  const sender = materialRequestSender({ tokenEmail: 'b@x.com', callerDoc: null, orgDoc: null })
  assert.equal(sender.name, 'b@x.com')
  assert.equal(sender.company, '')
  assert.equal(sender.phone, '')
})

test('review of #391: the stored logo is used only when it is an https link', () => {
  for (const url of ['javascript:alert(1)', 'data:image/png;base64,AAAA', 'http://cdn.example/logo.png', 'cdn.example/logo.png']) {
    assert.equal(materialRequestSender({ tokenEmail: 'a@x.com', callerDoc: null, orgDoc: { name: 'Acme', companyLogoURL: url } }).logoURL, '')
  }
  assert.equal(
    materialRequestSender({ tokenEmail: 'a@x.com', callerDoc: null, orgDoc: { name: 'Acme', companyLogoURL: ' https://cdn.example/l.png ' } }).logoURL,
    'https://cdn.example/l.png'
  )
})
