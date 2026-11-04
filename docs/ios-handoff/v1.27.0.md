# iOS follow-on — rulebook 1.27.0

Generated 2026-11-04 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.26.1 → 1.27.0
Packed hash: eac29814b14c461c08f338c632334266695b98b357c08999ab419df594621adf
Rulebook sha256: 142e20f48027bc0d25d5cf0793aa164833f863de1c914bca927c7e1c8acf7c36
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: 8c99592ff4cd836fbe172766d4eed5201108c977ba531c70ac26321b6e5208cf
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: DELETED_DATA_RETENTION_NOTICE, FILE_RECOVERY_RETENTION_DAYS, INVITE_DRAFT_PERSON_ID, MATERIAL_REQUEST_JOB_NOT_FOUND_MESSAGE, MATERIAL_REQUEST_JOB_NOT_VISIBLE_MESSAGE, MATERIAL_REQUEST_JOB_NUMBER_MISMATCH_MESSAGE, canViewRemovedEvidence, catalogueOperativePaySubjects, inviteDraftLineManagerSubject, invitePayProfileCopyWrite, materialRequestJobCheck, materialRequestJobViewer, removedEvidenceHeading, variationEvidenceRemovalWriteFields
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/cross-platform-contract.json, lib/canonical/index.ts, lib/canonical/inviteAccept.ts, lib/canonical/lineManagers.ts, lib/canonical/materialOrderAccess.ts, lib/canonical/parity-fixture.json, lib/canonical/payProfile.ts, lib/canonical/recordsDocuments.ts, lib/canonical/storedFiles.ts
Done when:
- [ ] Packed hash in iOS equals eac29814b14c461c08f338c632334266695b98b357c08999ab419df594621adf
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 142e20f48027bc0d25d5cf0793aa164833f863de1c914bca927c7e1c8acf7c36)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.27.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.27.0

- Add User: the invitee is never offered as their own line manager (§11, owner decision 1). `inviteDraftLineManagerSubject` / `INVITE_DRAFT_PERSON_ID`: web Add User passes the invite draft (typed email, chosen level) as `person` to `lineManagerCandidates`, `lineManagerSelectionAfterLevelChange` and `lineManagerRequiredError`, as iOS `AddUserView` already does. Before, web passed no person, so a roster row on the invitee's email was offered and counted.
- Material email job checks (§16, owner decision 2): with `jobId`, `material_request` (email function) and the web send route also require that the sender sees the job (`canSeeJob`, §17) and that the job number is the stored one — `materialRequestJobViewer`, `materialRequestJobCheck`, `MATERIAL_REQUEST_JOB_NOT_FOUND_MESSAGE` / `_NOT_VISIBLE_MESSAGE` / `_NUMBER_MISMATCH_MESSAGE`. Web's send sheet now sends `jobId`. Requests without `jobId` are still accepted.
- Admins can still delete any file (§24, owner decision 3): documented, unchanged.
- Removed variation evidence is recorded (§24, owner decision 4): `variationEvidenceRemovalWriteFields` appends `{ path, name, removedBy, removedAt }` to the variation's `removedEvidence` in the same partial update that unlinks it; `parseVariationDocument` reads it; admins see "Removed evidence (n)" (`canViewRemovedEvidence`, `removedEvidenceHeading`). The cross-platform contract's variation sample now reads `removedEvidence: []`.
- Soft delete retention is 30 days (§24, owner decision 5): `FILE_RECOVERY_RETENTION_DAYS`, `DELETED_DATA_RETENTION_NOTICE` — added word for word to the privacy policy (7. Retention) and the DPA (14. Deletion and Return); Deploy notes 1.25.0 / 1.27.0 set the bucket to 30 days.
- The invited rate is copied on accept while `privatePay` is on (§8, §16, owner decision 6): `invitePayProfileCopyWrite`; rules `inviteeCopiesOwnInvitedPay` let the accepting person create their own `payProfiles/{uid}` once, only as an exact copy of their pending placeholder's pay profile, while the email claim still names it.
- Catalogue operatives' pay for operatives managers while `privatePay` is on (§8, §16, owner decision 7): `catalogueOperativePaySubjects`; `canViewPersonPay` takes `catalogueOperative: true`; `payProfileReadPlan` reads their `payProfiles/{rowId}` and `rateHistoryQueryPlan` adds `operativeIds` (`operativeId ==` + `userId == ''`). Rules: the operatives-manager branch of `canViewPayOfRow` is limited to catalogue rows (`payOperativeRowIsCatalogue`), so a row on an account holder's email is no longer read through the row. Web lays `payProfiles/{rowId}` over each catalogue `operatives` row for those managers (the overlay iOS found missing).

## iOS work for 1.27.0

Owner decisions of 4 Nov, one release. Paths read from iOS `origin/main` 9116b30. With `privatePay` **off** nothing
about pay may change (items 6 and 7 apply only while it is on).

Three-factor check for every item: **Web** (done in web 1.27.0), **iOS** (below), **Shared rule** (the function named).

1. **Add User — invitee never their own line manager** (`inviteDraftLineManagerSubject`, `INVITE_DRAFT_PERSON_ID`).
   iOS already passes its draft (`Project Planner/Views/AddUserView.swift:409` `inviteDraftUserForValidation`, id
   `"invite-draft"`, used at `:347`, `:402`, `:422`, `:455`). Check only: the draft's `email` is the typed email
   (lower case) when it is passed to `lineManagerCandidates`, so the shared function finds the roster rows on it. You
   may build the draft with `inviteDraftLineManagerSubject({ email, level })` instead of the Swift initialiser; the
   parity fixture has its exact output. No other change.
2. **Material email job checks** (`materialRequestJobViewer`, `materialRequestJobCheck`). iOS still sends material
   quotes and orders through `ResendEmailService` (`Project Planner/FirebaseBackend.swift:10309`
   `sendMaterialRequest`, `:10363`), not the `sendEmail` function. When it moves to `sendEmail` `material_request`
   (`docs/EMAIL_FUNCTION.md`, "iOS request contract"), send `"jobId": <request.projectId — the job's document id>`
   and `"jobNumber": <the stored job number>`. The function then refuses (403) a job the sender cannot see and (409) a
   number that is not the job's; show the response `error` text. Without `jobId` it is accepted as before. Nothing to
   decide in Swift.
3. **Admins can still delete any file**: no change (`fileDeletePermission` as 1.25.0).
4. **Removed variation evidence is recorded** (`variationEvidenceRemovalWriteFields`, `parseVariationDocument`
   `removedEvidence`, `canViewRemovedEvidence`, `removedEvidenceHeading`).
   - `Project Planner/Views/Variations/VariationEditorSheet.swift:1560` `removeEvidence` and
     `Project Planner/Core/FirebaseBackend+Variations.swift:481` / `:520` `deleteVariationEvidenceFile`: unlink with
     one partial update built by `variationEvidenceRemovalWriteFields(stored, { evidenceId, removedBy: <uid>,
     removedAt: <Timestamp> })` on `variations/{id}` and on `settings/variationItem_{id}` (read the stored document
     first; never build the list from the screen copy). Write exactly `evidence`, `evidenceCount`, `removedEvidence`
     plus write metadata. No other iOS save may write `removedEvidence` (a full-document write would drop it).
   - Variation detail: for `canViewRemovedEvidence(role)` (admins / super admins outside operative mode) show a
     section titled `removedEvidenceHeading(n)` ("Removed evidence (n)") with each entry's name, path, who removed it
     (roster name) and when (organisation zone). Read it from `parseVariationDocument(...).removedEvidence`.
5. **Soft delete retention = 30 days** (`FILE_RECOVERY_RETENTION_DAYS`, `DELETED_DATA_RETENTION_NOTICE`).
   `Project Planner/Views/PrivacyPolicyView.swift` shows iOS's own copy, `Project Planner/Core/CustomerLegalPack.swift`
   (not a link to web). Add this sentence, word for word, as a new paragraph at the end of Privacy "7. Retention"
   (`CustomerLegalPack.swift` ~line 254) and at the end of DPA "14. Deletion and Return" (~line 177):

   > A deleted company can be restored for 60 days, after which its data is erased. Deleted files, including the files of an erased company, are kept for up to 30 days so they can be recovered, then permanently removed.

   Prefer reading it from the script (`DELETED_DATA_RETENTION_NOTICE`) and add a test that the pack contains it.
   Do **not** change `CustomerLegalPack.version` (web keeps `1.1`; a mismatch would ask people to accept again on every
   switch between the apps).
6. **Invited rate copied on accept** (`invitePayProfileCopyWrite`; rules `inviteeCopiesOwnInvitedPay`). iOS does not
   create `users/{authUid}` on accept — the invitation link (web `completeInviteSetup`) does
   (`Project Planner/FirebaseBackend.swift:~4190`, `INVITE_SETUP_INCOMPLETE`), and web 1.27.0 now copies the rate there.
   Nothing to build on iOS. Check only that iOS reads an invited person's pay from `payProfiles/{uid}` first, then a
   `formerUserIds` profile (already so in `Rulebook+PayPrivacy.swift:318` / `:328`).
7. **Catalogue operatives' pay for operatives managers** (`catalogueOperativePaySubjects`, `canViewPersonPay` with
   `catalogueOperative: true`, `payProfileReadPlan`, `rateHistoryQueryPlan` → `people` plans now carry
   `operativeIds`). This is the gap iOS reported (catalogue operatives not overlaid after the strip).
   - `Project Planner/Core/Rulebook+SecuritySwitches.swift:204` `overlayRosterPayIfPrivate` and the `operatives` roster
     load: pass `roster + catalogueOperativePaySubjects(operativesRows, roster)` as `subjects` to
     `payProfileReadPlan`, read each id, and lay `payProfiles/{rowId}` over each catalogue `operatives` row with
     `Operative.payShown(with:privatePay:)` (`Rulebook+PayPrivacy.swift:265`). Re-run it when the `operatives` rows
     change.
   - `:171` `rateHistoryPlan` (same subjects) and `:184` `rateHistoryListenQuery(subjectId:)`: for a catalogue row id in
     `operativeIds`, listen to `whereField("operativeId", isEqualTo: rowId).whereField("userId", isEqualTo: "")` (the
     rules allow exactly that query; a plain `operativeId ==` query is not part of the plan). Keep `userId ==` for
     account holders. Decode `operativeIds` (absent in older scripts: treat as `[]`).
   - `Project Planner/Views/OperativesView.swift` `EditOperativeView` (1.26.1 item 5) then starts from the overlaid row
     for an operatives manager too.
   Tests (`ProjectPlannerTests`): switch OFF — no `payProfiles` read, whole-collection history as before; ON — an
   operatives manager's plan lists the catalogue row in `operativeIds` and its profile is laid over the row; a manager
   without the toggle gets neither; an `operatives` row with `linkedUserId` or on a roster email is not a catalogue
   operative. The parity fixture's `1.27.0` cases cover the functions.

Deploy order (web Deploy notes 1.27.0): rules + functions deploy, web deploy, then this iOS build, before the owner
switches `privatePay` on for any company.

## New rulebook sections

- 1.27.0 — 2026-11-04

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
