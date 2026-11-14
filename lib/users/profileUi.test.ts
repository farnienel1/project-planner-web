/**
 * User profile UI pack (docs/design/user-profile-ui/): the restyle is display only. These tests lock the display
 * helpers and prove the opt-in `profile` variants of the shared controls keep the controls, values, states and
 * handlers of the default look. The save payloads before / after the restyle were compared field by field in a browser
 * harness (PR body, "What I checked").
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { profileRateRow, setupSectionIcon } from './profileUi'
import { setupSectionTitle } from '@/lib/staff/userEditPermissions'
import { PERMISSION_TOGGLE_CATALOGUE } from '@/lib/canonical/permissionLevels'
import { permissionIconFor } from '@/components/users/profile-ui/icons'
import { ActionRow, Switch, ToggleRow } from '@/components/users/profile-ui/primitives'
import { ProfileExpandablePermissionToggle, PermissionRowsList } from '@/components/users/ProfileExpandablePermissionToggle'
import { PayBasisFields } from '@/components/users/PayBasisFields'

const html = (element: ReactElement) => renderToStaticMarkup(element)

/** Every `<tag ...>` of a kind, with its attributes in a stable order (class and style left out). */
function controls(markup: string, tag: string): string[] {
  const out: string[] = []
  const re = new RegExp(`<${tag}\\b([^>]*)>`, 'g')
  for (const match of markup.matchAll(re)) {
    const attrs = [...match[1].matchAll(/([a-zA-Z-]+)(?:="([^"]*)")?/g)]
      .filter(([, name]) => name !== 'class' && name !== 'style')
      .map(([, name, value]) => `${name}=${value ?? ''}`)
      .sort()
    out.push(attrs.join(' '))
  }
  return out
}

test('profileRateRow: the same rate line as before (hourly, day, none)', () => {
  assert.deepEqual(profileRateRow({ payBasis: 'hourly', hourlyRate: 25 }, 'GBP'), { label: 'Hourly rate', value: '£25.00/hr' })
  assert.deepEqual(profileRateRow({ payBasis: 'day', dayRate: 225 }, 'GBP'), { label: 'Day rate', value: '£225.00/day' })
  assert.deepEqual(profileRateRow({ payBasis: 'day', dayRate: 0 }, 'GBP'), { label: 'Day rate', value: '£0.00/day' })
  assert.equal(profileRateRow({ payBasis: 'hourly', dayRate: 200 }, 'GBP'), null)
  assert.equal(profileRateRow({ dayRate: 200 }, 'GBP'), null)
  assert.equal(profileRateRow(null, 'GBP'), null)
})

test('setupSectionIcon follows setupSectionTitle', () => {
  const person = (over: Record<string, unknown>, permissions: Record<string, boolean> = {}) =>
    ({ isSuperAdmin: false, role: 'operative', ...over, permissions: { adminAccess: false, manager: false, operativeMode: false, ...permissions } }) as never
  const cases: Array<[unknown, string, string]> = [
    [person({ isSuperAdmin: true, role: 'admin' }, { adminAccess: true }), 'Super Admin setup', 'shield'],
    [person({ role: 'admin' }, { adminAccess: true }), 'Administrator setup', 'shield'],
    [person({ role: 'operative' }, { operativeMode: true }), 'Operative setup', 'hat'],
    [person({ role: 'manager' }, { manager: true }), 'Manager setup', 'brief'],
    [person({ role: 'member' }), 'Staff setup', 'user'],
  ]
  for (const [user, title, icon] of cases) {
    assert.equal(setupSectionTitle(user as never), title)
    assert.equal(setupSectionIcon(user as never), icon)
  }
})

test('every permission row has its own icon', () => {
  for (const row of PERMISSION_TOGGLE_CATALOGUE) assert.notEqual(permissionIconFor(row.field), 'shield', row.field)
})

test('Switch keeps the settings Toggle contract', () => {
  const calls: boolean[] = []
  const on = Switch({ checked: true, onChange: (v) => calls.push(v), label: 'Active' }) as ReactElement<{ onClick: () => void }>
  on.props.onClick()
  const off = Switch({ checked: false, onChange: (v) => calls.push(v) }) as ReactElement<{ onClick: () => void }>
  off.props.onClick()
  const locked = Switch({ checked: true, disabled: true, onChange: (v) => calls.push(v) }) as ReactElement<{ onClick: () => void }>
  locked.props.onClick()
  assert.deepEqual(calls, [false, true])
  const markup = html(createElement(Switch, { checked: true, disabled: true, onChange: () => {}, label: 'Active' }))
  assert.match(markup, /role="switch"/)
  assert.match(markup, /aria-checked="true"/)
  assert.match(markup, /aria-label="Active"/)
  assert.match(markup, /disabled=""/)
  assert.match(markup, /type="button"/)
})

test('ToggleRow shows the title and every description word for word', () => {
  const markup = html(
    createElement(ToggleRow, {
      title: 'Annual leave allowance',
      descriptions: ['First paragraph.', 'Second paragraph.'],
      control: createElement('span', null, 'switch'),
    })
  )
  for (const text of ['Annual leave allowance', 'First paragraph.', 'Second paragraph.', 'switch']) assert.ok(markup.includes(text), text)
})

test('ActionRow: same handler, disabled while busy', () => {
  let clicks = 0
  const row = ActionRow({ title: 'Delete user', icon: 'warn', tone: 'red', onClick: () => clicks++ }) as ReactElement<{ onClick: () => void; disabled?: boolean }>
  row.props.onClick()
  assert.equal(clicks, 1)
  assert.equal(row.props.disabled, undefined)
  const busy = html(createElement(ActionRow, { title: 'Deactivate user', subtitle: 'Suspend access, keep history', icon: 'clock', tone: 'amber', busy: true, onClick: () => {} }))
  assert.match(busy, /disabled=""/)
  assert.ok(busy.includes('Deactivate user') && busy.includes('Suspend access, keep history'))
})

test('permission row: the profile variant keeps the switch state, disabled rule and texts of the default row', () => {
  const def = { key: 'materials' as never, title: 'Materials', description: 'Can open material lists.' }
  for (const checked of [true, false]) {
    for (const disabled of [true, false]) {
      for (const lockedMessage of [undefined, 'Always on for managers.']) {
        const props = { def, checked, disabled, lockedMessage, onChange: () => {} }
        const plain = html(createElement(ProfileExpandablePermissionToggle, props))
        const styled = html(createElement(ProfileExpandablePermissionToggle, { ...props, variant: 'profile' as const }))
        const sw = (markup: string) => controls(markup, 'button').filter((c) => c.includes('role=switch')).map((c) => c.replace(/ aria-label=[^ ]*/, ''))
        assert.deepEqual(sw(styled), sw(plain), JSON.stringify({ checked, disabled, lockedMessage }))
        assert.equal(controls(styled, 'button').length, controls(plain, 'button').length)
        assert.ok(styled.includes('Materials'))
        assert.equal(styled.includes('Locked on'), Boolean(lockedMessage) && checked)
      }
    }
  }
  const rows = [
    { field: 'materials', label: 'Materials', help: 'h1', visible: true, editable: false, value: true },
    { field: 'siteAudit', label: 'Site audit', help: 'h2', visible: true, editable: true, value: false },
    { field: 'operatives', label: 'Operatives', help: 'h3', visible: false, editable: true, value: false },
  ]
  const order = (markup: string) => [...markup.matchAll(/Materials|Site audit|Operatives/g)].map((m) => m[0])
  const plain = html(createElement(PermissionRowsList, { rows, onChange: () => {}, lockedMessage: 'Locked' }))
  const styled = html(createElement(PermissionRowsList, { rows, onChange: () => {}, lockedMessage: 'Locked', variant: 'profile' }))
  assert.deepEqual([...new Set(order(styled))], [...new Set(order(plain))])
})

test('pay fields: the profile variant keeps the same input, switch and help texts', () => {
  for (const payBasis of ['day', 'hourly'] as const) {
    for (const error of [null, 'Set a day rate or hourly rate — self-employed people are paid from it.']) {
      const props = { payBasis, amount: '225', placeholder: 'manage' as const, error, onChange: () => {} }
      const plain = html(createElement(PayBasisFields, props))
      const styled = html(createElement(PayBasisFields, { ...props, variant: 'profile' as const }))
      assert.deepEqual(controls(styled, 'input'), controls(plain, 'input'))
      assert.deepEqual(controls(styled, 'button'), controls(plain, 'button'))
      const text = (markup: string) => markup.replace(/<[^>]+>/g, '\n').split('\n').map((s) => s.trim()).filter(Boolean).sort()
      assert.deepEqual(text(styled), text(plain))
    }
  }
})
