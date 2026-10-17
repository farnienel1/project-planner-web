import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  LEFTOVER_LOGIN_SETUP_COPY,
  LIVE_ORG_SETUP_BODY,
  LIVE_ORG_SETUP_TITLE,
  LiveOrgAlreadyMemberError,
  evaluateLiveOrgLookup,
  isLiveOrgAlreadyMemberError,
  liveOrgLoginHref,
  liveOrgSetupModalCopy,
  parseLiveOrgLookupResponse,
} from './liveOrgLookup.ts'

const UID = 'user-live'
const ORG = 'org-live'

function liveFacts(overrides?: Partial<Parameters<typeof evaluateLiveOrgLookup>[0]>) {
  return evaluateLiveOrgLookup({
    authUid: UID,
    userDoc: { exists: true, isActive: true, organizationId: ORG },
    membershipOrgIds: [ORG],
    organizations: [
      {
        id: ORG,
        exists: true,
        members: { [UID]: 'admin' },
        creatorUserId: UID,
        subscriptionStatus: 'active',
      },
    ],
    ...overrides,
  })
}

test('live active org membership shows the live-org dialog flags', () => {
  assert.deepEqual(liveFacts(), { hasLiveOrg: true, hasLogin: true })
  assert.deepEqual(
    liveFacts({
      membershipOrgIds: [],
      organizations: [{ id: ORG, exists: true, members: { [UID]: 'operative' }, subscriptionStatus: 'trialing' }],
    }),
    { hasLiveOrg: true, hasLogin: true }
  )
})

test('deleted account with no Auth and reclaimed userEmails is not a live org', () => {
  assert.deepEqual(
    evaluateLiveOrgLookup({
      authUid: null,
      userDoc: null,
      membershipOrgIds: [],
      organizations: [],
    }),
    { hasLiveOrg: false, hasLogin: false }
  )
  // Lookup never reads userEmails; a leftover pointer cannot create a live-org dialog.
  assert.equal(
    evaluateLiveOrgLookup({
      authUid: null,
      userDoc: { exists: false },
      membershipOrgIds: [],
      organizations: [{ id: ORG, exists: true, members: { [UID]: 'admin' }, subscriptionStatus: 'active' }],
    }).hasLiveOrg,
    false
  )
})

test('leftover Auth with no users/{uid} profile is not the live-org copy', () => {
  const leftover = evaluateLiveOrgLookup({
    authUid: UID,
    userDoc: null,
    membershipOrgIds: [],
    organizations: [],
  })
  assert.deepEqual(leftover, { hasLiveOrg: false, hasLogin: true })
  assert.equal(leftover.hasLiveOrg, false)

  const copy = liveOrgSetupModalCopy('ada@firm.com')
  assert.equal(copy.title, LIVE_ORG_SETUP_TITLE)
  assert.match(`${copy.title} ${copy.paragraphs.join(' ')}`, /already part of an organisation/i)
  assert.doesNotMatch(LEFTOVER_LOGIN_SETUP_COPY, /already part of an organisation/i)
  assert.doesNotMatch(LEFTOVER_LOGIN_SETUP_COPY, /switch organisation/i)
  assert.match(LEFTOVER_LOGIN_SETUP_COPY, /already has a login/i)
  assert.match(LEFTOVER_LOGIN_SETUP_COPY, /Set up an organisation/)
})

test('inactive member, pending-only setup, and missing org are not live', () => {
  assert.equal(liveFacts({ userDoc: { exists: true, isActive: false, organizationId: ORG } }).hasLiveOrg, false)
  assert.equal(
    liveFacts({
      organizations: [{ id: ORG, exists: true, members: { [UID]: 'admin' }, subscriptionStatus: 'pending' }],
    }).hasLiveOrg,
    false
  )
  assert.equal(
    liveFacts({
      organizations: [{ id: ORG, exists: false }],
    }).hasLiveOrg,
    false
  )
})

test('marketing-only email with no Auth login is not a live org', () => {
  assert.deepEqual(
    evaluateLiveOrgLookup({
      authUid: '',
      userDoc: { exists: false },
      membershipOrgIds: [],
      organizations: [],
    }),
    { hasLiveOrg: false, hasLogin: false }
  )
})

test('lookup response strips extra fields and only trusts booleans', () => {
  assert.deepEqual(
    parseLiveOrgLookupResponse({
      hasLiveOrg: true,
      hasLogin: true,
      orgName: 'Acme',
      emails: ['other@firm.com'],
    }),
    { hasLiveOrg: true, hasLogin: true }
  )
  assert.deepEqual(parseLiveOrgLookupResponse({ hasLiveOrg: 'yes' }), { hasLiveOrg: false, hasLogin: false })
  assert.deepEqual(parseLiveOrgLookupResponse({ hasLiveOrg: true }), { hasLiveOrg: true, hasLogin: false })
})

test('live-org dialog copy and login href keep the requested meaning', () => {
  const copy = liveOrgSetupModalCopy('Owner@Firm.com')
  assert.equal(copy.title, 'You are already part of an organisation')
  assert.equal(
    copy.paragraphs[0],
    'Please log in to this organisation, go to Settings, switch organisation, and then set up a new organisation from there. You will be redirected to the new organisation setup process.'
  )
  assert.equal(copy.primaryHref, '/login?email=Owner%40Firm.com')
  assert.equal(copy.primaryLabel, 'Log in')
  assert.equal(liveOrgLoginHref(''), '/login')
  assert.match(`${LIVE_ORG_SETUP_TITLE} ${LIVE_ORG_SETUP_BODY}`, /organisation/)
  assert.doesNotMatch(`${LIVE_ORG_SETUP_TITLE} ${LIVE_ORG_SETUP_BODY}`, /organization/)
})

test('live-org error is detectable without treating leftover email-already-in-use as live', () => {
  const error = new LiveOrgAlreadyMemberError()
  assert.equal(isLiveOrgAlreadyMemberError(error), true)
  assert.equal(isLiveOrgAlreadyMemberError({ code: 'auth/email-already-in-use' }), false)
})

test('signed-out /setup Continue looks up a live org and does not treat any Auth email as live', () => {
  const wizard = readFileSync(new URL('../../components/setup/OrgSetupWizard.tsx', import.meta.url), 'utf8')
  assert.match(wizard, /requestLiveOrgLookup/)
  assert.match(wizard, /lookup\.result\.hasLiveOrg/)
  assert.match(wizard, /LiveOrgSetupModal/)
  assert.doesNotMatch(wizard, /fetchSignInMethodsForEmail/)
  assert.doesNotMatch(wizard, /LEFTOVER_LOGIN_SETUP_COPY/)
})
