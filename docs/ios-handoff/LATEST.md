# iOS follow-on — rulebook 1.4.0

Generated 2026-11-02 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.3.0 → 1.4.0
Packed hash: a798df632ac158d7e870140eadfb6441bf8b1b4d230f3d9ae2d2df050eb27ad9
Rulebook sha256: 511a982254bce9a72a6b71994a41569447c571c0ff1519cf4e7f2373cd71a5c0
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: BANK_HOLIDAY_REGIONS, COMPANY_ACTIVITY_NOTICE_TYPES, PUSH_TEST_NOTICE_TYPE, bankHolidayCountries, bankHolidayCountryTitle, bankHolidayRegion, bankHolidayRegionLabel, bankHolidayRegionsForCountry, companyActivityRecipients, companyDetailsRegionPrompt, defaultBankHolidayRegionForCountry, normalizeBankHolidayRegionId, notificationPushesToActor, pushTestRecipients
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bankHolidayRegions.ts, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/companyDetails.ts, lib/canonical/index.ts, lib/canonical/notificationPreferences.ts, lib/canonical/notificationRecipients.ts, lib/canonical/parity-fixture.json
Done when:
- [ ] Packed hash in iOS equals a798df632ac158d7e870140eadfb6441bf8b1b4d230f3d9ae2d2df050eb27ad9
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 511a982254bce9a72a6b71994a41569447c571c0ff1519cf4e7f2373cd71a5c0)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.4.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.4.0

- Bank-holiday regions are one shared list (`BANK_HOLIDAY_REGIONS`, `bankHolidayRegionsForCountry`, `defaultBankHolidayRegionForCountry`, `normalizeBankHolidayRegionId`). Changing the company country asks for that country's region and the save waits for it (`companyDetailsRegionPrompt`, `companyDetailsValidationError`); Annual leave defaults offer only the company country's regions. Existing leave is never recounted (§4.1, §4.4).
- Company activity notices (`operative_created`, `manager_created`, `client_created`, `project_created`, `small_works_created`, `warning_removed`) go to the active admins outside operative mode, never the actor, one row each (`companyActivityRecipients`); admins get a Company activity toggle (`companyActivity`) and the six per-type toggles are retired (§13).
- `push_test` (Settings "send a test notification") reaches its sender: `pushTestRecipients`, `notificationPushesToActor`, and the push function's actor guard skips it (§13).
- Noted: iOS forced sign-outs do not yet remove the push token (§13).

## iOS work for 1.4.0

1. **Bank-holiday regions** (§4.1, §4.4). Delete `Core/BankHolidayRegionDirectory.swift` and read `BANK_HOLIDAY_REGIONS`, `bankHolidayRegionsForCountry`, `defaultBankHolidayRegionForCountry` and `normalizeBankHolidayRegionId` through `CanonicalBusinessEngine`. The shared list keeps every id iOS stores (`GB-ENG-WLS`, `GB-SCT`, `GB-NIR`, `GB`, `IE`, `US`, `CA`, …) and adds web's other countries.
   - `Views/CompanyDetailsEditView.swift`: when the country changes, show the region picker with only `bankHolidayRegionsForCountry(newCountry)`, pre-selected with `defaultBankHolidayRegionForCountry`, and keep Save disabled while `companyDetailsRegionPrompt(saved, { countryCode })` is required and no listed region is picked. Validate with `companyDetailsValidationError({ ..., previous: { countryCode, bankHolidayRegionId } })` and save with `companyDetailsWriteFields` (country and region in one `updateData`).
   - `Views/OrganisationAnnualLeaveDefaultsView.swift`: the region picker offers only the company country's regions.
   - A saved company with no region now reads its country's default (`parseCompanyDetails`), not England & Wales.
2. **Company activity notices** (§13). Every iOS writer of `operative_created`, `manager_created`, `client_created`, `project_created`, `small_works_created` and `warning_removed` (search `NotificationService.swift`) writes one row per id from `companyActivityRecipients(actor, roster)`, each with `userId` and `actorUserId`. Never write these without `userId`.
   - My notifications: the `companyActivity` toggle comes through `visibleNotificationPreferenceKeys` (admins and super admins only). The six old per-type rows (`projectCreated`, `smallWorksCreated`, `operativeCreated`, `managerCreated`, `clientCreated`, `warningDismissed`) are no longer listed; keep parsing them and never delete them on save.
3. **Push test** (§13). The Settings "send a test notification" writes type `push_test` (not `task_created`) to the signed-in user (`pushTestRecipients`), with `actorUserId` set. The push function now delivers it to its sender (`notificationPushesToActor`), once `firebase deploy --only functions` has run from web.
4. **Known gap to fix:** forced sign-outs (expired session, trial blocked) must also remove this device's push token from every users document it was written to, as a normal sign-out does.
5. Sync with `scripts/sync-rulebook-from-web.sh main` once web PR for 1.4.0 is merged (until then, branch `main-kr70k9`).

## New rulebook sections

- 1.4.0 — 2026-11-02

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
