# iOS follow-on — rulebook 1.30.2

Generated 2026-11-04 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.30.1 → 1.30.2
Packed hash: fd8233bd87b478360869096826df742422c05bf219bcea7d980e5f1d343890ac
Rulebook sha256: 0fa83462386dad658aaff357ea2f7353f1a946eb2544d0cd2f84c0a08fc41902
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: 7f70ec28920ac6114068b4e44eaf893706d5b6af1b21d77b69f946074d74e126
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: organizationSelfManageFlags
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/orgRoster.ts, lib/canonical/timesheetEntryReviews.ts, lib/canonical/userTimesheetAccess.ts
Done when:
- [ ] Packed hash in iOS equals fd8233bd87b478360869096826df742422c05bf219bcea7d980e5f1d343890ac
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 0fa83462386dad658aaff357ea2f7353f1a946eb2544d0cd2f84c0a08fc41902)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.30.2)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.30.2

- **Nobody reviews their own timesheet** (audit 4 Nov, §8, §16). `timesheetWriterIsReviewer` is false for the subject under any of their ids (`writerFormerIds`, new `writerAliasIds`, and `personIdSet` over the new `roster` argument) before the admin test, so an admin with Timesheet self-sign off can no longer counter-sign or sign off their own sheet; `userTimesheetSubjects` never lists the viewer (id, former ids, alias ids, roster rows on the same email). The owner path decides self-sign with `timesheetSelfSigned` (`timesheetOwnerWriteFields` with `subjectHasLineManager: !timesheetSelfSigned(...)`, as 1.28.0 intended). Web: the review page offers a counter-signature only to a reviewer (`TimesheetPeriodPage`).
- **Self-manage toggles per organisation** (§8, §9, §16): new `organizationSelfManageFlags({ organizationId, userId, user, membership, creatorUserId })` — the users document of this organisation, else the membership here, else off; the creator both on. Web never carries the home company's toggles into another company while the membership read is outstanding (`applyDeviceOrgMembership`, `sessionUserForOrganizationProbe`).
- **Security rules** (§16): `isTimesheetReviewer` excludes the subject (`timesheetCallerIsSubject`); the subject writes their own sheet only as the owner — the whole sheet when `timesheetSubjectSelfSigns` (older iOS builds save a self-signed admin's own sheet as the reviewer's), otherwise without sign-off, export, review or snapshot fields. New `orgSelfManageFlag` / `membershipSelfManageFlag` / `membershipFlag`: `hbCallerSelfBooks` and `timesheetSubjectSelfSigns` read the toggles for this organisation. The 1.28.0 "Known limit" (admins reviewers of their own sheet) is removed.
- **iOS follow-on**: pass the roster (and `writerAliasIds`) to `timesheetWriterIsReviewer` and never offer the counter-signature on one's own sheet; `TimesheetApprovalPolicy.requiresLineManagerCounterSign` must not fall back to `user.hasLineManager` when the script does not answer (InvoicingView) — treat the sheet as needing a counter-signature, as having no line manager no longer self-signs anyone; the signed-in user's self-manage toggles in another company come from the membership there (`organizationSelfManageFlags`), never the home users document.

## New rulebook sections

- 1.30.2 — 2026-11-04

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
