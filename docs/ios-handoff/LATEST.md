# iOS follow-on — rulebook 1.32.4

Generated 2026-11-06 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.32.3 → 1.32.4
Packed hash: c7b2d41f2b4827aae6b0dbb6446dd540ddf70d38efaa8fe3493a0f877ed0cebc
Rulebook sha256: d9e61e5d9c82017c36cb9a107b0fd53d8d91cd7aae455e1b4da2bf40dfc9ece8
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: 7f70ec28920ac6114068b4e44eaf893706d5b6af1b21d77b69f946074d74e126
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: AUTH_CLAIMS_KEY, AUTH_CLAIMS_MARKER_DOC_ID, AUTH_CLAIMS_MAX_BYTES, AUTH_CLAIMS_ORGANIZATION_FIELDS, AUTH_CLAIMS_USER_FIELDS, AUTH_CLAIMS_VERSION, authClaimsCoverOrganization, authClaimsEqual, authClaimsForPerson, authClaimsHomeOrganizationKey, authClaimsMarkerPath, authClaimsOrganizationAffectedUids, authClaimsRevokeAccess, authClaimsTokenIsStale, authClaimsUserInputsChanged, parseAuthClaims
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules, lib/canonical/authClaims.test.ts, lib/canonical/authClaims.ts, lib/canonical/bundleEntry.ts, lib/canonical/index.ts
Done when:
- [ ] Packed hash in iOS equals c7b2d41f2b4827aae6b0dbb6446dd540ddf70d38efaa8fe3493a0f877ed0cebc
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 d9e61e5d9c82017c36cb9a107b0fd53d8d91cd7aae455e1b4da2bf40dfc9ece8)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.32.4)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.32.4

- §16: the security rules read the caller's own role and company facts from their Firebase Auth custom claim `pp` (`authClaimsForPerson`, with `parseAuthClaims`, `authClaimsEqual`, `authClaimsRevokeAccess`, `authClaimsUserInputsChanged`, `authClaimsOrganizationAffectedUids`, `authClaimsTokenIsStale`, `authClaimsCoverOrganization`, `authClaimsMarkerPath`), set by three Cloud Functions on `users/{uid}`, `users/{uid}/orgMemberships/{orgId}` and `organizations/{orgId}` writes and by `scripts/backfill-auth-claims.mjs`; the marker `users/{uid}/private/authClaims` tells apps to refresh their token (web listens; iOS hand-off). Same allow/deny for every tested case once a token carries the claims; a change reaches the rules on the next token (at once for apps that listen, else within an hour; deactivation also revokes refresh tokens). Static compile cost 367,346 → 234,347 (−36%), bytes 142,906 → 137,867, inlined document lookups 2,862 → 1,364. Lookups kept: self-create / bootstrap / invite accept, alias ids and names, billing and deletion, the operatives-manager checks (an emulator rules-engine crash, notes "1.32.4 claims"), other documents. Rules suites 225/225; `RULES_STRICT_BUDGET=1` 20 limit refusals, all among 1.32.3's 43; emulator type check 0 issues.

## iOS work for 1.32.4

Rulebook 1.32.4 moves the security rules' role and company checks to Firebase Auth custom claims (`pp`). Design:
web `docs/rules-claims-design.md`; rules: RULEBOOK §16. Paths read from iOS `origin/main` f183239.

Three-factor check: **Web** (done in web 1.32.4: `lib/auth/authClaimsRefresh.ts`, `lib/stores/authStore.ts`),
**iOS** (below), **Shared rule** (`authClaimsTokenIsStale`, `authClaimsCoverOrganization`, `authClaimsMarkerPath`,
`parseAuthClaims` in the packed script).

Why it matters on iOS: once the owner publishes the 1.32.4 rules, a role, toggle, membership or deactivation change
reaches Firestore only when the phone's ID token is refreshed. Builds without the item below refresh hourly (the
Firebase SDK default), so after an admin changes someone's access the phone can be refused, or keep the old access,
for up to an hour. Nothing else changes on iOS: no data shape, no query, no screen.

1. **Listen to the marker and refresh the token** (`Core/` auth/session code; today the auth listener is
   `Project Planner/FirebaseBackend.swift:599` `auth.addStateDidChangeListener`).
   - While a user is signed in, keep one snapshot listener on `users/{uid}/private/authClaims`
     (path: `CanonicalBusinessEngine` `authClaimsMarkerPath(uid)`). The rules let only that person read it; nobody
     writes it but the Cloud Function. Before the 1.32.4 rules are published the read is refused: ignore the error.
   - On each snapshot with a number `v`: read the current token's claims
     (`Auth.auth().currentUser?.getIDTokenResult()` → `claims`) and ask the script
     `authClaimsTokenIsStale(v, claims)`. When true, call
     `Auth.auth().currentUser?.getIDTokenForcingRefresh(true)`, then reload the open organisation's data the way the
     Refresh action does (listeners re-attached), because screens may have been refused or may show access that changed.
   - Remove the listener on sign-out (`userDidSignOut`) and when the signed-in uid changes.
2. **Joining or founding a company on the phone** (only if iOS has such a flow; web does): after the writes, wait
   (bounded, ~20 s) until `authClaimsCoverOrganization(claims, orgId)` is true for a forced-refresh token before
   loading that company. Web: `waitForOrganizationClaims`.
3. **Switching organisation**: no token refresh needed; the claims cover every organisation the person belongs to
   (up to the size cap in `authClaimsForPerson`).
4. Do **not** decide anything from the claims in Swift (they are for the rules); screens keep using
   `CanonicalBusinessEngine` with the documents, as today.

Tests (ProjectPlannerTests): a marker `v` newer than the token's `pp.s` triggers exactly one forced refresh; equal
`v` does not; a refused marker read does not sign out or show an error.

## New rulebook sections

- 1.32.4 — 2026-11-06

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
