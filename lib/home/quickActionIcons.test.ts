import { test } from 'node:test'
import assert from 'node:assert/strict'
import { quickActionMeta } from './quickActions.ts'
import { QUICK_ACTION_ICON_NAME_SET } from './quickActionIconNames.ts'

const QUICK_ACTION_IDS = [
  'op-projects',
  'op-small',
  'op-leave',
  'op-audit',
  'op-schedule',
  'op-settings',
  'staff-weekly',
  'staff-daily',
  'staff-projects',
  'staff-small',
  'staff-leave',
  'staff-schedule',
  'staff-audit',
  'staff-managers',
  'staff-operatives',
  'staff-subs',
  'staff-map',
  'staff-settings',
  'staff-clients',
  'staff-create-project',
  'staff-create-small',
  'staff-qualifications',
  'staff-my-qualifications',
  'staff-job-types',
  'staff-wholesalers',
  'staff-material-catalogue',
  'staff-add-user',
  'staff-manage-users',
  'staff-help',
  'staff-general-app',
  'staff-tasks',
  'staff-invoicing',
]

test('every registered quick-action icon has a Heroicon mapping', () => {
  for (const id of QUICK_ACTION_IDS) {
    const meta = quickActionMeta(id)
    assert.ok(meta, `missing meta for ${id}`)
    assert.ok(QUICK_ACTION_ICON_NAME_SET.has(meta.icon), `${id} icon "${meta.icon}" is not mapped`)
  }
})
