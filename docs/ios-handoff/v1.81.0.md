# iOS follow-on — rulebook 1.81.0

Generated 2026-11-24 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.80.0 → 1.81.0
Packed hash: e6524d2b1b990f1f722971d81aa9de1b84a7911d2b451aecbe095179e9e64c70
Rulebook sha256: 4a43cb3457c191f2ec4b9c2cf4d897c2e39063aee5ac45a024cd6781408435cf
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
  web lib/canonical/data-parity-fixture.json        → iOS ProjectPlannerTests/DataParityFixture.json
Contract sha256: d2d465abcf0ab7c7747385346b87d2b47226412b1014602c5a26bff8e951c0ca
Data-parity fixture sha256: c2db4a64c22f36ddda48453c0d26da28fc802df9c8c93c0d876e8097a9eb176f
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: MEMBER_NAMES_COLLECTION, MEMBER_NAME_FIELDS, MEMBER_NAME_MAX_LENGTH, MEMBER_NAME_REFUSED_MESSAGE, MEMBER_NAME_REQUIRED_MESSAGE, MEMBER_NAME_TOO_LONG_MESSAGE, accountName, applyMemberNames, canWriteMemberName, displayNameInOrganization, memberNameEditTarget, memberNameFor, memberNamePath, memberNameValidationError, memberNameWriteFields, parseMemberNameDocument, parseMemberNameDocuments
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/crossPlatformContract.samples.ts, lib/canonical/index.ts, lib/canonical/liveSources.ts, lib/canonical/memberNames.test.ts, lib/canonical/memberNames.ts, lib/canonical/orgRoster.ts, lib/canonical/organizationSettings.ts, lib/canonical/peopleDocuments.ts
Done when:
- [ ] Packed hash in iOS equals e6524d2b1b990f1f722971d81aa9de1b84a7911d2b451aecbe095179e9e64c70
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 4a43cb3457c191f2ec4b9c2cf4d897c2e39063aee5ac45a024cd6781408435cf)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.81.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.81.0

- **Names per organisation** (§1, §11, §16; owner decision 24 Nov, before launch; new `lib/canonical/memberNames.ts`): `organizations/{orgId}/memberNames/{uid}` `{ firstName, surname }` is a company's own name for a person; `displayNameInOrganization`, `memberNameFor`, `accountName`, `applyMemberNames`, `parseMemberNameDocument(s)`, `memberNamePath`, `memberNameWriteFields`, `memberNameValidationError`, `memberNameEditTarget` (home organisation → the users document, as before; any other → the entry), `canWriteMemberName`, `MEMBER_NAMES_COLLECTION`, `MEMBER_NAME_FIELDS`, `MEMBER_NAME_MAX_LENGTH`, `MEMBER_NAME_*_MESSAGE`. `rosterMembersForOrganization` takes `memberNames`; `parseUserDocument` takes `memberName` (no new keys). `LIVE_COLLECTIONS` / `OPERATIONAL_COLLECTION_PATHS` list `memberNames`; `CONTRACT_NO_READER` until iOS writes it. With no entry every name reads as before.
- Web: one live listener laid over the roster and the signed-in user (`lib/staff/memberNamesLive.ts`, `memberNameOverlay.ts`); Edit user and My Profile save a non-home name to the entry (and remove the home company's entry on a home edit); Edit user's name is read-only, with the reason, for a non-admin outside the person's home company; Data health's people lists use it; the owner console Change name chooses every organisation or this organisation only (REST `upsert` / `delete` writes). Cloud Functions: report checks and the email function's caller name read the entry.
- Review of #439 (same version): members-list admins (the `E` claim) write entries; a name edit is compared with the editor's own copy; report checks accept either name; owner console "This organisation only" on the home organisation follows `memberNameEditTarget`; web `getUser` reads a stored organisation path or reference.
- Security rules: the `memberNames` write rule; 13 redundant organisation read lines removed (the catch-all already allows the same reads), compile cost 225,015 (live 226,797).

## New rulebook sections

- 1.81.0 — 2026-11-24

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
