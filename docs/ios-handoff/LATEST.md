# iOS follow-on — rulebook 1.85.0

Generated 2026-11-24 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.83.0 → 1.85.0
Packed hash: 78053333b864295e8ad25b79a1fbf3e2f602f3392a3af8e544bb89a7855c803e
Rulebook sha256: 85704b888b31b3da18b8eec07f3e61879a45ac216dbe5246eaf830bfee793c8e
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
Exports added: ONBOARDING_DISMISSED_AT_FIELD, ONBOARDING_DISMISSED_BY_FIELD, ONBOARDING_DISMISS_CONFIRM, ONBOARDING_DISMISS_LABEL, ONBOARDING_OPTIONAL_LABEL, ONBOARDING_SUBTITLE, ONBOARDING_TITLE, ORG_COMPLIANCE_PAGE_PATH, ORG_COMPLIANCE_REMINDERS_SWITCH_FIELD, ORG_COMPLIANCE_REMINDER_LEDGER_ID, ORG_COMPLIANCE_REMINDER_THRESHOLDS, onboardingCardVisible, onboardingChecklist, onboardingDismissWriteFields, onboardingDismissed, orgComplianceReminderBatchTag, orgComplianceReminderDayKey, orgComplianceReminderEmail, orgComplianceReminderLedgerAfter, orgComplianceReminderLedgerFields, orgComplianceReminderLedgerPath, orgComplianceReminderRecipients, orgComplianceReminderSetDayKey, orgComplianceRemindersDue, orgComplianceRemindersEnabled, parseOrgComplianceReminderLedger
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bundleEntry.ts, lib/canonical/index.ts, lib/canonical/onboardingChecklist.test.ts, lib/canonical/onboardingChecklist.ts, lib/canonical/orgComplianceReminders.test.ts, lib/canonical/orgComplianceReminders.ts, lib/canonical/organizationSettings.ts
Done when:
- [ ] Packed hash in iOS equals 78053333b864295e8ad25b79a1fbf3e2f602f3392a3af8e544bb89a7855c803e
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 85704b888b31b3da18b8eec07f3e61879a45ac216dbe5246eaf830bfee793c8e)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.85.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.85.0

- **Insurance & accreditation expiry emails** (§31, owner decision 24 Nov: 2 months, 1 month and 7 days, never twice; only thresholds still ahead when the expiry was set). New `lib/canonical/orgComplianceReminders.ts`: `ORG_COMPLIANCE_REMINDER_THRESHOLDS`, `orgComplianceReminderDayKey`, `orgComplianceReminderSetDayKey`, `orgComplianceRemindersDue`, `parseOrgComplianceReminderLedger`, `orgComplianceReminderLedgerAfter`, `orgComplianceReminderLedgerFields`, `orgComplianceReminderLedgerPath`, `orgComplianceReminderRecipients`, `orgComplianceReminderEmail`, `orgComplianceReminderBatchTag`, `ORG_COMPLIANCE_PAGE_PATH`, `orgComplianceRemindersEnabled`, `ORG_COMPLIANCE_REMINDERS_SWITCH_FIELD`. Daily Cloud Function `orgComplianceExpiryReminders` (`functions/orgComplianceReminders.js`), off until `platformConfig/app.orgComplianceRemindersEnabled` (§18).
- **Getting started checklist** (new §32, owner 24 Nov): `lib/canonical/onboardingChecklist.ts` — `onboardingChecklist`, `onboardingCardVisible`, `onboardingDismissed`, `onboardingDismissWriteFields`, `ONBOARDING_*` copy. `ORGANIZATION_DOCUMENT_FIELDS` lists `onboardingDismissedAt`, `onboardingDismissedBy`. Web: the card at the top of Home (admins) and on the setup wizard's last screen.
- Review of #447 / #294 (same version): the reminder ledger is claimed before sending and released only when nothing was accepted (at most once); the idempotency key carries the documents and thresholds (`orgComplianceReminderBatchTag`); the dry run records set days; duplicate entry ids skipped; greeting from the stored first name only; failures logged by status only. Web Home asks `canManageOrganizationCompliance`; Hide never waits for the server.

## iOS work for 1.85.0

Built in iOS PR on branch `ios-1.85-reminders-onboarding` (from `ios-1.83-accreditations`). Calls through `CanonicalBusinessEngine` only:

1. `Project Planner/Core/Rulebook+Onboarding.swift` — wrappers for `onboardingChecklist`, `onboardingCardVisible`, `onboardingDismissWriteFields` and the `ONBOARDING_*` copy; `OnboardingOrganizationDocument` keeps the stored fields the checklist reads.
2. `Project Planner/Models/Organization.swift` + `Project Planner/FirebaseBackend.swift` — `Organization.onboardingDocumentJSON`, filled in `applyPayrollPolicyFields` and on every organisation snapshot.
3. `Project Planner/Core/FirebaseBackend+Onboarding.swift` — Hide: one partial update of `organizations/{orgId}` (`onboardingDismissedBy`, `onboardingDismissedAt` server time, write metadata).
4. `Project Planner/Views/GettingStartedHomeCard.swift`, placed first in Home's light sheet (`HomeView.homeLightSheet`) — admins only; each item opens its screen in a sheet.
5. `ProjectPlannerTests/OnboardingChecklistTests.swift`.

The expiry emails (§31) are server-only: nothing to build on iOS.

## New rulebook sections

- 32. Getting started checklist (1.85.0)
- 1.85.0 — 2026-11-24

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
