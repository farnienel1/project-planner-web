# iOS follow-on — rulebook 1.28.0

Generated 2026-11-04 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.28.0 → 1.28.0
Packed hash: f4b92f59b5032bb9ea6689e975cc98d39058ae2c978972736817475b54eb8ba2
Rulebook sha256: 043412f948c2ed11e75d2d41b1316deb5fe4271056f28e27ce71a4b90d39a91a
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: 7f70ec28920ac6114068b4e44eaf893706d5b6af1b21d77b69f946074d74e126
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: none
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules, lib/canonical/canonical.test.ts, lib/canonical/leaveRequests.ts, lib/canonical/parity-fixture.json, lib/canonical/permissionLevels.ts
Done when:
- [ ] Packed hash in iOS equals f4b92f59b5032bb9ea6689e975cc98d39058ae2c978972736817475b54eb8ba2
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 043412f948c2ed11e75d2d41b1316deb5fe4271056f28e27ce71a4b90d39a91a)
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
- Review fixes (same release): the organisation's **creator is its Super Admin** even without the `isSuperAdmin` flag, and a Super Admin of another company working here as an admin is not — judged per organisation with `isOrganizationSuperAdmin(viewer, org)` and passed as `organizationSuperAdmin` (`isSuperAdminAccount`, `effectivePermissions`, `permissionToggleRows`). Rules: invite accept copies the toggles only as set on the placeholder (`noMorePrivilegeThan`); re-creating one's own profile or the bootstrap path never switches them on except for the creator (`selfCreateSelfManageOff`); the creator's own document is exempt from the self-toggle lock. A save leaving admin never writes Timesheet self-sign (`keepStoredLockedPermissions`), so the stored value stays underneath.
- Security rules (§16): `hbCallerSelfBooks` is the self-book flag or the organisation's Super Admin (no "admin with no current line manager"); the owner writes `weeklyReportOverride` only when `timesheetSubjectSelfSigns` (Super Admin, or an active admin of the organisation with `timesheetSelfSign`); a person never changes their own self-manage toggles (admins included, the Super Admin exempt); `timesheetSelfSign` joins the toggles a non-admin cannot raise. `hasCurrentLineManager` is removed. See Deploy notes for the check before deploying.


## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
