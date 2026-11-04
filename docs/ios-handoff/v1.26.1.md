# iOS follow-on — rulebook 1.26.1

Generated 2026-11-04 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.26.1 → 1.26.1
Packed hash: 4f4c44d9b43379863d797bbad6a4fa874cd429649ade09ffd2768bd902a89d86
Rulebook sha256: 9379ecb7418407f9e54e38e53bbbdaf72c399d0271fa4d32325d16ff5b4ece5e
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: c9e307b0604e78284baf3a4f217f0fb3ecc4b227aec957c901bdd93e4e31a306
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: none
Exports removed: none
Web files that changed the rules: none recorded
Done when:
- [ ] Packed hash in iOS equals 4f4c44d9b43379863d797bbad6a4fa874cd429649ade09ffd2768bd902a89d86
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 9379ecb7418407f9e54e38e53bbbdaf72c399d0271fa4d32325d16ff5b4ece5e)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.26.1)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.26.1

- Pay editors start from the pay shown (§8): `payEditorStartingValues(person, profile, { privatePay })`. With `privatePay` on, web's people profile showed pay from `payProfiles` while Edit User started from `users/{uid}`, which can hold an old rate, so an admin could see one rate, edit another and save the old one back, and the rate-history previous row and "rate changed?" test used the wrong value. Now the display and every pay editor (web Edit User, the catalogue operative form and the save baseline read; iOS Manage Users editor seed and save baseline, operative and rate editors) take the same record, which is also the save baseline. With `privatePay` off nothing changes: the person's document as stored, no pay-profile read.

## iOS work for 1.26.1

Prerequisite for the owner turning `privatePay` on (`docs/SECURITY_SWITCHES.md` step 6.3). With the switch **off**
nothing may change: every seed and baseline stays the users / operatives document as stored, and no pay profile is read.

Rule: `payEditorStartingValues(person, profile, { privatePay })` → `{ record, pay, rate, employmentType, source }`.
`profile` is `parsePayProfileDocument(id, data)` of the person's own id, else of a `formerUserIds` id (web
`payEditorRecord`), or null. `record` is BOTH the editor's starting value AND its save baseline (the "rate changed?"
test, the changed-fields write and the rate-history `previousProfile`). Wrap it once in `CanonicalBusinessEngine`
(next to `overlayPayProfile` in `Rulebook+PayPrivacy.swift`) and route every path below through it — no Swift copy of
the on/off test.

### Paths to switch (read from iOS `origin/main` 2b83b41)

1. `Project Planner/Core/Rulebook+PayPrivacy.swift:165` `AppUser.payShown(with:privatePay:)` and `:212`
   `UserStore.refreshPayFromPayProfile(of:)` — call `payEditorStartingValues`; the read loads only `subject.id`
   today: also try `formerUserIds` (an invited person's pay sits on the placeholder's profile), as web does.
2. `Project Planner/Views/ManageUsersView.swift` `EditUserView` seed: `:1594` `_dayRateText` and `:1607`
   `_employmentTypeDraft` (from `user` as passed in), `:2330` `.task(id:)` → `:3405` `refreshPayFromPayProfile()` (only
   untouched drafts follow). Check the seed and the `.task` overlay give the same value as the summary when ON, and
   that no save can run on the pre-overlay seed (e.g. disable Save until the overlay read has finished while ON).
3. Save baseline in the same view: `:3892` (`saved`), `:3939` (`rateSubject`), `:3956` `runPersistUserEdits`
   `subjectUser`, `:3418` `payRateRequiredMessageForSave`, `:3427` `isPayrollRateDirty(versus:)` — all read
   `userStore.organizationUsers`, which holds the overlaid row only if the roster overlay
   (`Rulebook+SecuritySwitches.swift:203` `overlayRosterPayIfPrivate`) or `refreshPayFromPayProfile` has run. Make the
   baseline the `record` of `payEditorStartingValues`, the same one the seed used.
4. `Project Planner/Core/UserStore.swift:2626` `updateOperativeProfileFields` and `:2916` `updateManagerDayRate` —
   `previousPay = Self.storedPay(of: organizationUsers[index])` is the rate-history "previous" row and the
   unchanged-rate test; it must be the same `record` (ON: profile rate, never a stale users rate). `:2557`
   `updateUserEmploymentType` likewise for the previous employment type.
5. Catalogue operative editor `Project Planner/Views/OperativesView.swift:946` `EditOperativeView` (`init` `:969`,
   `previousAmount` `:1170`, history `:1209`) — seeded from the `operatives` row; while ON lay `payProfiles/{rowId}`
   over it (`payEditorStartingValues`). This is the known 1.26.0 gap (catalogue operatives not overlaid on iOS).
6. Display paths that must show the same value as the editor while ON: `Project Planner/Views/OperativeProfileView.swift:79`
   `dayRateValue` (`displayedUser` / `linkedOperative`), `Project Planner/Views/SettingsHubSupportViews.swift:113`.

Tests (`ProjectPlannerTests`): switch OFF — seed, baseline and history "previous" equal the users document exactly,
no `payProfiles` read; switch ON with users `dayRate` 120 and profile 150 — the editor shows 150, saving unchanged
writes no pay and no history row, saving 180 writes a seed of 150 (empty history) then 180. The parity fixture's
`payEditorStartingValues` cases cover the function itself.


## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
