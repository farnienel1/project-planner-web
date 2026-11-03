# iOS follow-on — rulebook 1.12.0

Generated 2026-11-03 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.11.0 → 1.12.0
Packed hash: 8621c4cbde38dc4e1c8c1c48f47652700321d2cfd95fffc43520a8b89268378a
Rulebook sha256: 587e0a165bc84b5f4a5e28a1e58a2eac39db0016dc1fe645b110f458c433a6ad
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
Contract sha256: 43f4b04529bedc38c3827fa084854d1f55d0d4c760c9869c13190a84085298cf
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: LEAVE_YEAR_MONTHS_MESSAGE, PAY_STANDARD_DAY_MIN_HOURS, PLATFORM_CONFIG_APP_PATH, appUpdateRequired, compareAppVersions, invitationIsOperativeOnly, isVerifiedPlatformOwner, leaveYearEndMonth, organizationMemberActive, validateAnnualLeaveDefaults, validateLeaveYearMonths
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, firestore.rules, lib/canonical/annualLeaveBalance.ts, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/engine.ts, lib/canonical/index.ts, lib/canonical/inviteAccept.ts, lib/canonical/orgMembership.ts, lib/canonical/organizationSettings.ts, lib/canonical/passwordPolicy.ts, lib/canonical/payRate.ts, lib/canonical/payrollHours.ts, lib/canonical/payrollPolicySchedule.ts, lib/canonical/platformConfig.ts
Done when:
- [ ] Packed hash in iOS equals 8621c4cbde38dc4e1c8c1c48f47652700321d2cfd95fffc43520a8b89268378a
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 587e0a165bc84b5f4a5e28a1e58a2eac39db0016dc1fe645b110f458c433a6ad)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.12.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.12.0

- Security rules hardening (§14, §16; audit B1–B4, H2–H5, M3 part). Platform owner is the verified token email only (`isPlatformOwner`, `isVerifiedPlatformOwner`; the users document `email` no longer counts, and a person changes their own `email` only to their Auth email). Managers with operatives access invite operatives only (`invitationIsOperativeOnly`). `formerUserIds` / `sameEmailUserIds` are never self-written (self-create only from the invite placeholder) and count only on the caller's own company's users document. `isSuperAdmin` and ownership change only by the Super Admin; an admin cannot demote the founder. Deactivated people lose organisation access (`organizationMemberActive`). Roster row emails change only by admins (operatives rows: operatives managers too). Inbox rows only for members, and the push function pushes only to active members. `accountConfirmations` are not listed and are marked used only by their signed-in owner. The `qualifications` and `skills` catalogues are staff only. Needs the rules and functions deploy (Deploy notes).
- Forced app update (§18): `platformConfig/app` `{ minimumIosBuild, minimumWebVersion? }`, `appUpdateRequired`, `PLATFORM_CONFIG_APP_PATH`; readable signed out, written by the platform owner.
- Day keys east of UTC+12 (§1): `dateFromDayKeyInZone`, `midnightInZone` and `addDaysInZone` work from the zone offset at local midnight. New Zealand (and Chatham, Kiritimati) day keys were one day out: a Friday paid at Saturday rules, a Mon–Fri leave request counted 2 days, rate changes and payment runs started a day late.
- The unpaid break (§8): only the covered part of the break window comes off, up to the break length; a booking entirely inside the break pays 0, never a full standard day (`payrollHoursResult`).
- Policy limits on read (§4.3): `parsePayrollPolicy` clamps to `PAYROLL_POLICY_LIMITS` (now defined beside it); `payForHours` pays 0 for a day rate with a paid day below 1 hour (`PAY_STANDARD_DAY_MIN_HOURS`), never up to 800× the rate.
- Leave year (§4.4): always 12 months (`leaveYearEndMonth`); a mismatched save is refused (`validateAnnualLeaveDefaults`, `validateLeaveYearMonths`); a stored mismatch reads as 12 months from the start (`leaveYearBounds`).
- Not changed (owner decisions pending): who reads pay, billing enforcement, weekend AM/PM, carry-over cap, overnight bookings.

## New rulebook sections

- 18. Forced app update (1.12.0)
- 1.12.0 — 2026-11-03

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
