import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emailTypoHint } from './emailTypo.ts'

test('flags doubled TLDs, domain typos and trailing dots', () => {
  assert.equal(emailTypoHint('fsn101@hotmail.com.com'), 'doubled TLD')
  assert.equal(emailTypoHint('sam@gmial.com'), 'did you mean gmail?')
  assert.equal(emailTypoHint('sam@hotmial.com'), 'did you mean hotmail?')
  assert.equal(emailTypoHint('sam@outlok.com'), 'did you mean outlook?')
  assert.equal(emailTypoHint('sam@company.co.uk.'), 'trailing dot')
  assert.equal(emailTypoHint('sam@company.co.uk'), null)
})
