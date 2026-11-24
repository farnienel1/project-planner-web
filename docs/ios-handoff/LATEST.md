# iOS follow-on — rulebook 1.88.0

Generated 2026-11-24 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.88.0 → 1.88.0
Packed hash: 5126a89e412671760a571eea47dd6590ef3d941d66c194f5d233cd67289e84cf
Rulebook sha256: 5b720e3f07749d5aa6575b932a076bffaa7d7d06ea1c3dc5e435d23530b3b7eb
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
  web lib/canonical/data-parity-fixture.json        → iOS ProjectPlannerTests/DataParityFixture.json
Contract sha256: 99a68588268f5a19436ae8064a1ae5acecd30c2f68a3f70ebee128e6d92875bc
Data-parity fixture sha256: c2db4a64c22f36ddda48453c0d26da28fc802df9c8c93c0d876e8097a9eb176f
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: ORG_LINE_MANAGER_HOME_UNKNOWN_MESSAGE, ORG_LINE_MANAGER_NO_MEMBERSHIP_MESSAGE, ORG_MEMBERSHIP_LINE_MANAGER_FIELD, invitationLineManagerMap, isHomeOrganization, orgLineManagerEditTarget, orgMembershipLineManagerFields, organizationLineManagerFields, parseOrgLineManager, withOrganizationLineManager
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules, lib/canonical/canonical.test.ts, lib/canonical/inviteAccept.ts
Done when:
- [ ] Packed hash in iOS equals 5126a89e412671760a571eea47dd6590ef3d941d66c194f5d233cd67289e84cf
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 5b720e3f07749d5aa6575b932a076bffaa7d7d06ea1c3dc5e435d23530b3b7eb)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.88.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.88.0

- **Line managers per organisation** (§8, §11, §14, §16; owner decision 24 Nov, before launch; new `lib/canonical/orgLineManagers.ts`): a member whose home is another company gets this company's own line manager on their membership here (`users/{uid}/orgMemberships/{orgId}.lineManager`), set by this company's admins or copied from the invitation they accepted (into another company; a new account's home membership carries none); their home company keeps the users document's, and a membership with no map reads the users document exactly as before. New `organizationLineManagerFields`, `withOrganizationLineManager`, `orgLineManagerEditTarget`, `orgMembershipLineManagerFields`, `invitationLineManagerMap`, `parseOrgLineManager`, `isHomeOrganization`, `ORG_MEMBERSHIP_LINE_MANAGER_FIELD`, `ORG_LINE_MANAGER_NO_MEMBERSHIP_MESSAGE`, `ORG_LINE_MANAGER_HOME_UNKNOWN_MESSAGE`. `parseOrgMembershipDocument` returns `lineManager`; `orgMembershipWriteFields` takes `next.lineManager` (admin); `ORG_MEMBERSHIP_ADMIN_FIELDS` lists `lineManager`; `rosterMembersForOrganization` lays it over with `memberships`; `timesheetSignOffReminderRosterMember` and `inviteMembershipWrites` carry it. Cross-platform contract regenerated (`parseOrgMembershipDocument` output gains `lineManager: null`).
- Web: `lib/staff/memberLineManagersLive.ts` (the roster's visiting members), `applyDeviceOrgMembership` (the signed-in person), `prepareSaveUser` (Edit user saves a visiting member's line manager on their membership; the users document is not written for it). Functions: `reportIntegrity.js` reads it.
- Owner bug 24 Nov (same version): one line-manager answer on every screen — web's profile page reads `lineManagerSummary` (it read only the legacy single id on the folded roster) and web / iOS Edit user read `lineManagerSelectedIds` over the unfolded roster; stored `hasNoLineManager` beside ids reads "No line manager" everywhere and a save writes the group together. Web `displayedLineManagerId` removed.
- Security rules: `lmMap` / `lmData` in `callerLineManagesUser`, `callerLineManagesRowPerson`, `tsReviewer`, `hbCanDecide` and `canViewPayOfAsMember`; a membership is read by every active member of its organisation (was admins only); `lineManager` written only by an admin of the organisation, never on their own membership, `hasNoLineManager: true` only on an admin membership; the invitation's own line manager on accept; `storage.rules` `callerLineManagesUser` the same. Compile cost paid for by single-use helpers folded into their one caller (no allow / deny change; Deploy notes 1.88.0). New emulator suite `tests/orgLineManagers.rules.test.ts`; `tests/storage.rules.test.ts` case.

## iOS work for 1.88.0

Built in iOS PR on branch `ios-1.87-org-line-managers` (rulebook 1.88.0; the branch name predates the renumber). Calls through `CanonicalBusinessEngine` only:

1. `Project Planner/Core/Rulebook+OrgLineManagers.swift` (new) — wrappers for `organizationLineManagerFields` and `orgLineManagerEditTarget`; `OrgLineManagerOverlay` lays a visiting member's line manager (their membership's `lineManager` map) over `AppUser` rows and keeps the users document's own under `orgLineManagerOverlay` (`OrgLineManagerMark`).
2. `Project Planner/Models/AppModels.swift` — `AppUser.orgLineManagerOverlay` (not encoded).
3. `Project Planner/Core/UserStore.swift` — `organizationUsers` didSet applies the overlay; `scheduleLineManagerMemberships()` reads each visiting roster member's membership in the open company once (`readOrgMembershipForLineManager`); `updateOperativeProfileFields` saves a visiting member's line manager on their membership with `writeOrgMembership(next: ["lineManager": …], writer: "admin")` (refused with `ORG_LINE_MANAGER_HOME_UNKNOWN_MESSAGE` / `ORG_LINE_MANAGER_NO_MEMBERSHIP_MESSAGE` text) and never writes the users document's line manager for them; `noteOrgLineManagerSaved`.
4. `Project Planner/Core/FirebaseBackend+OrganizationMembership.swift` — `readOrgMembershipForLineManager`; the session profile in another company takes `organizationLineManagerFields` (the membership's map, else the users document's — no longer a flat legacy copy on the membership); `applyDeviceSessionIfNeeded` passes the users document's line manager.
5. `ProjectPlannerTests/OrgLineManagersTests.swift`.

Not changed (follow-ups): iOS Add user / invite flows (the invitation's line manager is copied on accept by web's accept flow, `inviteMembershipWrites`); the Edit user screen's picker is unchanged and saves through item 3.


## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
