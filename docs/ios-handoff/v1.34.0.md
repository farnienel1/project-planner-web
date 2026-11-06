# iOS follow-on — rulebook 1.34.0

Generated 2026-11-06 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.33.0 → 1.34.0
Packed hash: 6d5ca2759327ece9073123eedf7cac5030fd90225f379fb932744d986733160a
Rulebook sha256: 2b45ea093d7ec68f3d6b11c36dba0592b6bf884668da90ca0380e04783273a5d
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: 59d6bc6123f250e1f57599240eb3190ab48f5cd2532f8281a99360d9e187d86b
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: GHOST_CHECK_ISSUE_LABELS, ghostsToCheck
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md
Done when:
- [ ] Packed hash in iOS equals 6d5ca2759327ece9073123eedf7cac5030fd90225f379fb932744d986733160a
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 2b45ea093d7ec68f3d6b11c36dba0592b6bf884668da90ca0380e04783273a5d)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.34.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.34.0

- **Ghost operatives** (§11, owner design 6 Nov "ghost: all recommended", answers rounds 1–2; new `lib/canonical/ghostOperatives.ts`): a bookable operative with no app login — no email, no phone; a `users/{id}` document with `ghost: true`, `passwordSet: false`, `email: ''`, the operative level, self-employed, a day or hourly rate above 0 and a line manager. Added by admins and Operatives managers (`canCreateGhost`, `ghostCreateError`, `ghostCreateWrites`) from a **Ghost account** toggle at the top of Add user / Add new operative (`ghostAddFormRows`, `GHOST_OPERATIVE_EXPLANATION`); the admins are told (`operative_created` / `operative_deleted`). New: `isGhostUser`, `isGhostInvited`, `ghostBadgeLabel` / `GHOST_BADGE_LABEL`, `personDedupeKey`, `canBookLeaveFor`, `ghostLeaveBooking`, `canUpgradeGhost`, `ghostUpgradeRefusal`, `ghostUpgradeWrites` (admin-only Give app access, owner option 1), `inviteAcceptPlaceholderFields` / `INVITE_ACCEPT_DROPPED_PLACEHOLDER_FIELDS`, `ghostConversionCandidates`, `ghostConversionWrites` (owner-run `scripts/convert-no-login-operatives-to-ghosts.mjs`, Q-G2), `ghostsToCheck` (Data health).
- Changed for ghosts: `rosterSegment` / `isIdentifiablePendingLeftover` (never Pending or a leftover), `parseUserDocument` and `USER_DOCUMENT_FIELDS` (`ghost`, `inviteEmailHint`; contract regenerated), `unbookedLabourRows` (a ghost counts as signed up; people with no email are one row each and inactive ones are skipped), `unverifiedOperativeRows`, `timesheetDaysForPerson` / `showsMyTimesheets` / `timesheetParticipant`, `userTimesheetSubjects`, `exportedTimesheetHistorySubjects`, `overtimeUserSubjects`, `notificationRecipientAccountId` / `excludeActor` (never a ghost), `userDeleteWrites` (only the users document), `payrunSnapshotRows` (grey "No app login", `PAYRUN_SNAPSHOT_GHOST_CELL`), `inviteAcceptWrites` (`dropPlaceholderFields`).
- Fixes found on the way: pickers and web's annual-leave people list folded people on the email alone, so only the first person with no email was offered (`personDedupeKey`); web Edit User pooled the rate history of everyone with an empty email.
- **Security rules** (§16): R1 — an Operatives manager never changes a ghost's line manager; R2 — a ghost's line manager gets no overtime booking write on it. Static compile cost 232,589 → 232,779; 141,866 → 142,017 bytes.
- Emulator finding (not a rules change): the Firestore emulator (1.22.0) crashes on an Operatives manager's users create that carries `isSuperAdmin: false` or no `email` key, so a ghost is written with `email: ''` and no `isSuperAdmin` key. Web Add user's invite placeholder carries `isSuperAdmin: false` (`invitePlaceholderUserWriteFields`); whether production shares the crash is unknown (follow-up).
- Wording fix: the 1.32.4 Deploy notes functions command now names the `inbox-push` codebase (`functions:inbox-push:<name>`); `functions:authClaimsOnUserWrite` gave "No function matches given --only filters".

## New rulebook sections

- 1.34.0 — 2026-11-07

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
