import assert from 'node:assert/strict'
import test from 'node:test'
import { parseMemberNameDocuments } from '@/lib/canonical/memberNames'
import { accountNameOf, hasOrganizationName, overlayMemberName, overlayMemberNames } from './memberNameOverlay'
import type { User } from '@/types'

const farnie = { id: 'u1', firstName: 'Farnie', surname: 'Nel', email: 'f@x.com', organizationId: 'A' } as unknown as User
const names = parseMemberNameDocuments([{ id: 'U1', data: { firstName: 'Farns', surname: 'Nel' } }])

test('1.81.0 web overlay: an entry shows in its organisation and comes off when removed', () => {
  const shown = overlayMemberName(farnie, names)
  assert.equal(shown.firstName, 'Farns')
  assert.equal(hasOrganizationName(shown), true)
  assert.deepEqual(accountNameOf(shown), { firstName: 'Farnie', surname: 'Nel' })
  assert.equal(overlayMemberName(shown, names), shown, 'idempotent: same object')
  const back = overlayMemberName(shown, {})
  assert.equal(back.firstName, 'Farnie')
  assert.equal('orgNameOverlay' in back, false)
})

test('1.81.0 web overlay: no entries → the same array; a later edit of the name is never reverted', () => {
  const list = [farnie]
  assert.equal(overlayMemberNames(list, {}), list)
  const shown = overlayMemberName(farnie, names)
  const edited = { ...shown, firstName: 'Fanie' }
  assert.deepEqual(accountNameOf(edited), { firstName: 'Fanie', surname: 'Nel' })
  assert.equal(overlayMemberName(edited, {}).firstName, 'Fanie')
})
