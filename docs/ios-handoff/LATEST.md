# iOS follow-on — rulebook 1.54.1

Generated 2026-11-16 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.54.0 → 1.54.1
Packed hash: 64f2a9f1490694a7b4ed13c97ba7a0bf8e92e3a8365a243f44e24e9ec2cfdb78
Rulebook sha256: f382c0511b6c6cfe316c2a5c340b25af03025b7931325b01331ade3b23ef6d54
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
  web lib/canonical/data-parity-fixture.json        → iOS ProjectPlannerTests/DataParityFixture.json
Contract sha256: 5a8a7e4e6f56b91cb18f71e79207782b8840fccf0b63b695826c47e18e59a32e
Data-parity fixture sha256: c2db4a64c22f36ddda48453c0d26da28fc802df9c8c93c0d876e8097a9eb176f
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: none
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules, lib/canonical/canonical.test.ts, lib/canonical/timesheetPeriod.ts, storage.rules
Done when:
- [ ] Packed hash in iOS equals 64f2a9f1490694a7b4ed13c97ba7a0bf8e92e3a8365a243f44e24e9ec2cfdb78
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 f382c0511b6c6cfe316c2a5c340b25af03025b7931325b01331ade3b23ef6d54)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.54.1)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.54.1

- **Timesheets filed under the person they name** (§16, platform scan 16 Nov, HIGH): `timesheetSubjectFiled` — a create's id must start `timesheet_{userId}_` for the `userId` written (else the caller's id), owners and reviewers alike; an update never changes `userId` except adding a missing one the id names. Before, any member could create `timesheet_{colleague}_{period}` under their own `userId`, blocking the colleague's sheet and showing injected entries as theirs; a reviewer could refile a sheet under someone else (LOW). Emulator tests in `tests/timesheetSettings.rules.test.ts`.
- **Storage roles per organisation, deactivation, billing and deletion** (§16, §24, HIGH / MEDIUM): `storage.rules` `orgMember`, `adminLike`, `isOperativeHere`, `staffLike`, `orgFileAdmin`, `claimAdmin` read the users-document flags only on the users document of this organisation, else the `members` entry; `orgOpen` and `membershipActive` refuse a deactivated person and a lapsed or scheduled-for-deletion organisation.
- **Timesheet export PDFs** (§8, §16, §24, HIGH): read by admins and the exporter only; `timesheetExportStoragePath` takes the exporter's uid (`{uid}_{seconds}_{file}`; web `timesheetExportPath` now calls it).
- **Eraser** (§20, MEDIUM): a person whose users document names the erased organisation is kept when another organisation's `members` map lists them or they created it, not only when they have a membership document there (`functions/organizationEraser.js` `listingOrgIds`).
- **Export email** (§16, MEDIUM): the web route sends to the signed-in user's own email only (`timesheetExportRecipientCheck`), with the stored organisation name, `safeExternalUrl` links and one `requestId` for the send and its retry.
- **Exported timesheets locked** (§8, §16, MEDIUM; separate commit, owner to confirm): `timesheetExportedFrozen` replaces `timesheetReviewerKeepsExportedLate` — once `exportedAt` is stored nobody changes the snapshot, the review maps, `lateExtras`, `userId` or the signatures, owners and reviewers alike, late extras or not.
- **Notifications create** (§16, LOW): not tightened — see `docs/firestore-rules-notes.md` "1.54.1".
- **Security rules hardening** (§16; pre-launch follow-ups from 1.31.1; built as 1.53.1, never released, folded in here). (1) An admin's update of another person's users document checks privilege values like every other users write path (`privilegeWriteTyped`: a written or changed privilege key, top level or `permissions`, is a bool or null; a written role is one the apps write); one check now serves the admin and the operatives-manager paths. (2) `members` on the organisation document: a written value is a role word; a legacy value stored on one entry can no longer be copied onto another (`membersValuesTyped` counts the non-role values). (3) Nobody switches their own Annual Leave Management or Timesheet self-sign off, non-admins included (admins since 1.31.1; the value in effect is compared, so a save writing it back passes). (4) A redundant platform-owner test in the settings read rule is removed (same decision). The Super Admin's own document (the creator, or a stored `isSuperAdmin`) keeps its exemption, so a Super Admin transfer from a legacy founder document still saves. Static compile cost 229,614 → 230,031; emulator type check 0 issues; new suite `tests/rulesHardening.rules.test.ts`.

## iOS work for 1.54.1

**Sync first.** 1.54.1 (pre-launch hardening, platform scan 16 Nov). Rules, Storage rules, the eraser and a web route; iOS has two small changes. Line numbers are from iOS `main` (16 Nov); check them on your branch.

1. **Sync.** `WEB_REPO=<web worktree> bash scripts/sync-rulebook-from-web.sh`, then commit the mirrored files.
2. **Timesheet export file name** (§24, §16): `FirebaseBackend.swift` `uploadTimesheetExportPDF` (~3306) calls `CanonicalBusinessEngine.timesheetExportStoragePath(organizationId:fileName:stampSeconds:)`; pass the signed-in uid as the new 4th argument (`uploaderUid: Auth.auth().currentUser?.uid`; the wrapper in `Canonical/CanonicalBusinessEngine.swift` ~2319 adds the parameter). The Storage rules now let only admins and the exporter read an export, so without it a line manager who is not an admin gets "backup skipped" (no download link in the email; the PDF is still attached and stored).
3. **Notifications carry the actor** (§13, groundwork for a later rules release): `FirebaseBackend.saveNotification` (~6960) defaults `actorUserId` to nil and many callers leave it out. Pass the signed-in uid on every row the person causes; leave it out only for the scheduled types (`timesheet_submission_reminder`, `deadline_reminder`, `deadline_due`). The rules do not require it yet.
4. **Nothing else changes on iOS.** Timesheet saves already file a sheet under the `userId` they write (`timesheetDocumentId(userId:…)` with `periodFields.userId`), so the new create check never refuses an iPhone save; reviewers never write `userId`.

## New rulebook sections

- 1.54.1 — 2026-11-16

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
