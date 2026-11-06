# Role and company checks from Auth custom claims (rulebook 1.32.4)

## Why

Google's rules compiler gives up on `firestore.rules` (CLI `firebaserules …:test` HTTP 503, console "Error saving rules – unknown error") even at static cost 367,346 (`scripts/rules-cost/metric.py total2`, 1.32.3). Its cost tracks the fully inlined size of every allow condition and every function body: the type checker re-resolves a function body at each call site (`docs/firestore-rules-notes.md` "Compile cost"). The role helpers were the largest part of it, because each one looked up the caller's own documents again — `users/{uid}`, `organizations/{orgId}.members` / `creatorUserId` and `users/{uid}/orgMemberships/{orgId}` — and they are called from almost every rule (`canAccessOrganization` alone at 68 call sites after inlining).

1.32.4 computes those facts once, outside the rules, and puts them in the person's Firebase Auth custom claims. The rules read `request.auth.token.pp`. Nobody may read or write anything they could not before, except for the bounded staleness described below.

## The claims

One custom claim, `pp`, computed by the rulebook (`lib/canonical/authClaims.ts`, `authClaimsForPerson`) and set by the Cloud Function (`functions/authClaims.js`) and the backfill (`scripts/backfill-auth-claims.mjs`). The rules tests build their tokens with the same function (`tests/authClaimsContext.ts`).

```
pp: {
  v: 1,                      // shape version
  s: 1762450000000,          // stamp: when these claims were computed (the marker carries the same value)
  h: "8b3c…",                // the organisation the users document names (docOrganizationId: last segment, case kept)
  r: "organizations/8b3c…",  // only when the raw organizationId differs from h (a path string); false for a reference
  u: ["a", "x"],             // home flags (below)
  o: {                       // one entry per organisation the person belongs to, key = organisation id in lower case
    "8b3c…": ["admin", "admin", "c", "h", "C", "E", "H", "S", "B"]
  },
  x: 2                       // only when organisations were left out (size cap)
}
```

Each organisation entry is `[role, listedRole, ...flags]`:

| Item | Meaning | 1.32.3 rules helper it replaces |
|---|---|---|
| role | `'admin' \| 'manager' \| 'operative' \| 'member' \| 'other' \| ''` | `callerOrgRoleAnyBilling` (billing is still checked in the rules) |
| listedRole | the `members` map entry, same words, `'other'` for any other value | `callerListedRole` |
| `c` | a member here and active, billing aside | `canAccessOrganization` (without `isPlatformOwner` and `orgBillingOpen`) |
| `h` | the users document names this organisation | `userOrgIdMatchesPath`, `homeOrgIs(callerHomeData(), …)` |
| `C` | creator (`creatorUserId`) | `orgCreatorIs(org, request.auth.uid)` |
| `E` | admin here by users document or `members` map, billing aside | `orgAdminEither` (without billing), `hbIsAdmin` |
| `H` | active admin by the users document of this organisation | `isOrganizationAdmin` / `homeIsActiveAdminOf` (without billing) |
| `S` | Super Admin here (creator, or Super Admin flag on the users document of this organisation) | `callerIsSuperAdminOf` |
| `P`, `W` | Projects / Small works toggle here (users document of this organisation, else the membership) | `callerJobToggle` |
| `B` | books their own annual leave here (creator, or Annual Leave Management read for this organisation) | `orgCreatorIs(…) \|\| orgSelfManageFlag(request.auth.uid, …, 'annualLeaveSelfBook', false)` |

Home flags (`u`), from the caller's users document whatever organisation is open:

| Flag | Meaning | 1.32.3 expression it replaces |
|---|---|---|
| `a` | admin-like users document | `adminLikeUser(callerHomeData())` |
| `o` | operative profile | `isOperativeProfile(callerHomeData())` (with `a`: `callerHomeIsOperative`, `hbCallerIsOperative`) |
| `p` | operative-like (top-level `operativeMode` or `role`) | `isOperativeLikeUser(callerHomeData())` |
| `k` | manager with operatives access (top-level flags, not operative mode) | the operatives-manager gate of the users update (`isManagerWithOperativesAccess` and `managerMayManageOperative` keep their lookup: see below) |
| `q` | operatives manager by `staffFlag`, not admin, not operative, active | `orgRootOperativesManagerRemovesMember`, `operativesManagerRemovesOrphanBooking` |
| `s` | Super Admin flag (`staffFlag`) | `staffFlag(callerHomeData(), 'isSuperAdmin')` |
| `t` | `isSuperAdmin == true` at the top level | `adminDeletesUser` |
| `x` | the users document exists | `exists(/users/$(request.auth.uid))` gates |
| `i` | `isActive == false` | `callerHomeData().get('isActive', true) != false` |

The function mirrors the 1.32.3 helpers field for field (the same `== true || == 1` truthiness, `staffFlag` top level before `permissions`, `accountActive` before `isActive` on a membership, `members` entries that are present but empty count as membership). The rules suites check that: every existing test runs with the claims computed from its seeded data and keeps its expectation.

**Not in claims** (they change often, or they are about other documents): billing and deletion (`orgBillingOpen` stays a lookup of the organisation document), pay, line managers, alias ids (`formerUserIds`, `sameEmailUserIds`), names, email, job managers, subjects of a write.

### Many organisations (cap)

Firebase refuses custom claims over 1,000 bytes. `authClaimsForPerson` keeps the claims under 950 bytes: the home organisation first, then the others by role (admin, manager, operative, member) and id. An organisation that does not fit is left out (`pp.x` counts them; the marker and the backfill list them) and **the rules refuse it** for that person until they leave another organisation. A typical entry is 60–90 bytes, so about ten organisations fit. The backfill dry run prints anyone over the cap; expected: nobody.

## Who sets them

`functions/authClaims.js` (`createAuthClaimsSync`), deployed as three Firestore triggers in `functions/index.js`:

- `authClaimsOnUserWrite` — `users/{uid}` written, when existence or a field in `AUTH_CLAIMS_USER_FIELDS` changed (not `pushTokens`, `lastSeenAt` …);
- `authClaimsOnMembershipWrite` — `users/{uid}/orgMemberships/{orgId}` written;
- `authClaimsOnOrganizationWrite` — `organizations/{orgId}` written: the people whose `members` entry or `creatorUserId` changed (`authClaimsOrganizationAffectedUids`).

For a person, the sync reads their users document, memberships, every organisation that lists them (`orderBy members.{uid}`) or that they created, and their home organisation; computes the claims; and only when they differ (`authClaimsEqual`, stamp aside): `setCustomUserClaims` (other custom claims kept), `revokeRefreshTokens` when an organisation lost access (`authClaimsRevokeAccess`: deactivated or removed), and the marker `users/{uid}/private/authClaims` `{ v: <stamp>, updatedAt, omittedOrganizationIds }`. The rules let the person read their marker (`allow get`); nobody writes it but the server. A users document without an Auth account (an invite placeholder) is skipped.

## Clients

- **Web** (`lib/auth/authClaimsRefresh.ts`, started from the auth listener in `lib/stores/authStore.ts`): listens to the marker; when its `v` is newer than the token's `pp.s` (`authClaimsTokenIsStale`) it calls `getIdToken(true)` and fires `AUTH_CLAIMS_REFRESHED_EVENT`, on which the open organisation's data is reloaded (`refreshAllOrgData`). Founding a company (`createPendingOrganization`) and accepting an invitation (`completeInvitationPasswordSetup`) wait (up to 20 s) for the token to cover the new organisation (`waitForOrganizationClaims`) before going on.
- **iOS**: hand-off `docs/ios-handoff/notes/v1.32.4.md` — listen to the marker in `Core/` auth/session code and call `Auth.auth().currentUser?.getIDTokenForcingRefresh(true)`. Builds without it get the hourly token refresh.
- Switching organisation needs no refresh: the claims cover every organisation (up to the cap).

## Staleness (rulebook §16)

A change to a person's role, toggles, membership or active state reaches the rules on their next ID token: at once for a client that listens to the marker (web from 1.32.4, iOS once the hand-off ships), otherwise within an hour (Firebase refreshes ID tokens hourly). Deactivation and removal also revoke the person's refresh tokens, so no new token is issued; **a token issued before the change still works until it expires (at most an hour)**. Firestore rules cannot check revocation without a lookup.

Rules where an hour would be unsafe, and what 1.32.4 does:

| Rule | Decision |
|---|---|
| Self-create, founder bootstrap, invite accept (`selfCreateJoinsCompany`, users create paths 1 and 3, `orgRootInviteJoin`, `orgRootCallerTied`, `membershipFromInvitation`, the membership self-write role check, `inviteeCopiesOwnInvitedPay`, `callerAcceptedPlaceholder`) | **Lookups kept.** Claims cannot exist yet at that moment. |
| Alias ids and names (`callerOwnsBookingId`, `timesheetIdIsCallerAlias`, `claimReviewSubjectIsCaller`, `timesheetReviewerOfOthers` former ids, material `addedBy` names) | **Lookups kept.** They are identity, written during invite accept and then used at once. |
| Billing and deletion (`orgBillingOpen`) | **Lookup kept.** Organisation data; a lapse or a scheduled deletion applies at once, as before. |
| Deactivation, removal, demotion | **Claims.** Up to an hour for a token issued before the change (refresh tokens revoked). Owner decision (brief: "deactivation also revokes refresh tokens"). |
| Super Admin transfer, admin rights, job toggles, self-book | **Claims.** Up to an hour, as any role change. |
| Operatives-manager checks `isManagerWithOperativesAccess`, `managerMayManageOperative` (pay, operative edits and deletes, operative invitations) | **Lookups kept**, not for staleness: with claim-only bodies the Firestore emulator crashed inside the rules engine on some of these writes (`docs/firestore-rules-notes.md` "1.32.4 claims"). So these stay immediate. |
| Reading the organisation document (`organizations/{orgId}` get) | **Lookup kept**: an invitee reads it right after the accept batch, before the function has run. |

## Result

Static cost 367,346 → 234,347 (−36%), bytes 142,906 → 137,867, inlined lookups 2,862 → 1,364, in-process compile 1.29 s → 1.07 s (min of 7). Below the brief's 180,000 target would need billing in the claims (≈ −32,000) or a rework of the job-manager lookups (≈33,000); both are left for an owner decision (`docs/firestore-rules-notes.md` "1.32.4 claims").

## Rollout (owner steps; also in the README and the PR)

1. Deploy the functions: `firebase deploy --only functions:inbox-push:authClaimsOnUserWrite,functions:inbox-push:authClaimsOnMembershipWrite,functions:inbox-push:authClaimsOnOrganizationWrite` (from `project-planner-web`, with `functions/canonical-business.js` rebuilt by `npm run build:canonical`).
2. Backfill: `node scripts/backfill-auth-claims.mjs --project project-planner-f986c` (dry run), read the totals and the "more organisations than fit" list, then `… --apply`.
3. Wait one hour (every token in use has been refreshed with claims).
4. Publish the new rules (`firebase deploy --only firestore:rules`) and check what is live (`docs/firestore-rules-notes.md` "After publishing").

Until step 4 the old rules (lookups) are live and the claims are unused, so steps 1–3 change nothing for anyone. Rolling back is publishing the 1.32.3 rules again; the claims can stay.
