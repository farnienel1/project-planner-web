# iOS follow-on — rulebook 1.28.0

Generated 2026-11-04 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.27.0 → 1.28.0
Packed hash: de73e43f7d96d3b900985526cb78a7ee09023d8bbba36b92382515049320b0d0
Rulebook sha256: 0a64f387dae95f756cc1c21dbbfd195a23bc4f5cfdbdc597ac844c7ceb402b1c
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: 7f70ec28920ac6114068b4e44eaf893706d5b6af1b21d77b69f946074d74e126
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: ADMIN_LINE_MANAGER_REQUIRED_MESSAGE, ADMIN_ONLY_PERMISSION_FIELDS, OWN_SELF_MANAGE_MESSAGE, PAYE_ADMIN_LINE_MANAGER_REQUIRED_MESSAGE, SUPER_ADMIN_SELF_MANAGE_MESSAGE, TIMESHEET_SELF_SIGN_PAYE_NOTE, isPayeAccount, isSuperAdminAccount, selfManageToggles
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/cross-platform-contract.json, lib/canonical/index.ts, lib/canonical/leaveRequests.ts, lib/canonical/lineManagers.ts, lib/canonical/notificationRecipients.ts, lib/canonical/orgMembership.ts, lib/canonical/parity-fixture.json, lib/canonical/permissionLevels.ts, lib/canonical/userProfile.ts
Done when:
- [ ] Packed hash in iOS equals de73e43f7d96d3b900985526cb78a7ee09023d8bbba36b92382515049320b0d0
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 0a64f387dae95f756cc1c21dbbfd195a23bc4f5cfdbdc597ac844c7ceb402b1c)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.28.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.28.0

- Admin self-manage toggles (§8, §9, §11, owner decisions 4 Nov). New admin-only toggle **Timesheet self-sign** (`timesheetSelfSign`, in `USER_PERMISSION_FIELDS` and the membership keys; "Sign your own timesheet and generate the invoice without a line manager's signature."). With **Annual Leave Management** (`annualLeaveSelfBook`) it makes the two self-manage toggles (`ADMIN_EDITABLE_PERMISSION_FIELDS`), independent of each other and of the line manager. `selfManageToggles`, `isSuperAdminAccount`, `isPayeAccount`, `ADMIN_ONLY_PERMISSION_FIELDS`.
- Self-approval follows the toggles: `timesheetSelfSigned` is Timesheet self-sign on (or the Super Admin), `canSelfBookAnnualLeave` is Annual Leave Management on (or the Super Admin). Having no line manager no longer self-approves an admin (replaces the 1.3.0 rule). The `roster` argument of both is kept and not read.
- When an admin needs a line manager: `lineManagerRequired` is true for an admin unless Annual Leave Management is on and Timesheet self-sign is on (or the admin is PAYE). `lineManagerRequiredError` says which (`ADMIN_LINE_MANAGER_REQUIRED_MESSAGE`, `PAYE_ADMIN_LINE_MANAGER_REQUIRED_MESSAGE`); `usersMissingLineManager` lists such admins (Manage Users, and Settings → Data health on web). `lineManagerOptions` still offers "No line manager" to every admin.
- The Super Admin always reads both toggles on and locked (`effectivePermissions`, `lockedPermissionFields`, `permissionToggleRows` note `SUPER_ADMIN_SELF_MANAGE_MESSAGE`). Timesheet self-sign is never shown and reads off for a manager or operative; a demotion keeps the stored value underneath (`lockedPermissionFields` locks it for those levels, so saves keep it). A PAYE admin's row is greyed out (`TIMESHEET_SELF_SIGN_PAYE_NOTE`); the viewer's own rows are not editable (`permissionToggleRows({ viewerIsSubject })`, `OWN_SELF_MANAGE_MESSAGE`).
- Security rules (§16): `hbCallerSelfBooks` is the self-book flag or the organisation's Super Admin (no "admin with no current line manager"); the owner writes `weeklyReportOverride` only when `timesheetSubjectSelfSigns` (Super Admin, or an active admin of the organisation with `timesheetSelfSign`); a person never changes their own self-manage toggles (admins included, the Super Admin exempt); `timesheetSelfSign` joins the toggles a non-admin cannot raise. `hasCurrentLineManager` is removed. See Deploy notes for the check before deploying.

## New rulebook sections

- 1.28.0 — 2026-11-04

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
