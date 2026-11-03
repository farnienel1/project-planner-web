# iOS follow-on — rulebook 1.26.0

Generated 2026-11-03 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.26.0 → 1.26.0
Packed hash: 7dcb97cc74e3f4d5666a9050bb35359a58eafd69407fe52fb15030b78a5c0158
Rulebook sha256: 86e32226ea6aab36e45d9b87be556522636bf54e8fecc98541bf44c7691339ec
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
- [ ] Packed hash in iOS equals 7dcb97cc74e3f4d5666a9050bb35359a58eafd69407fe52fb15030b78a5c0158
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 86e32226ea6aab36e45d9b87be556522636bf54e8fecc98541bf44c7691339ec)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.26.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.26.0

- Security switches per organisation (§16, §17, §18): `platformConfig/app` takes `enforcedReadsOrganizationIds` and `privatePayOrganizationIds` beside the platform-wide `enforcedReads` / `privatePay`, so the owner can switch one company on first. The rules read them as `enforcedReadsOn(orgId)` / `privatePayOn(orgId)`; the shared test is `securitySwitchOn` / `securitySwitches` (`SECURITY_SWITCHES`, `SECURITY_SWITCH_ORGANIZATION_FIELDS`).
- The apps follow the switches (§17): job and booking plans take `enforced: securitySwitchOn(...)` instead of waiting for a release that flips `ENFORCED_READS_ACTIVE` (now only the default). Web re-plans its listeners live when the switch changes.
- Private pay in the apps (§8): `sharedDocumentPayWrite` keeps pay off `users` / `operatives` / `managers` writes while `privatePay` is on (before 1.26.0 a web pay save, Add User with a rate and an invite acceptance were refused as a whole once it was on); `rateHistoryQueryPlan` reads rate history per person for non-admins (the whole-collection read was refused); `payProfileReadPlan` + `overlayPayProfile` lay pay profiles over the roster so pay still shows after the strip.
- Owner guide `docs/SECURITY_SWITCHES.md` (order: backfill → rules → iOS build → `minimumIosBuild` → own company → test → everyone; rollback).

## iOS work for 1.26.0

### Paths that break when a switch is on (read from iOS `origin/main` ed5874b)

**`enforcedReads`** — iOS plans with the default `ENFORCED_READS_ACTIVE` (false), so with the switch on a manager without a job toggle gets their whole-collection job and booking listeners refused (empty lists), and Daily Overview / warnings still assume they read every booking.
1. `Project Planner/Core/Rulebook+JobAccess.swift:126` `jobQueryPlan(_:documentIds:enforced:)`, `:145` `readsEveryBooking(_:enforced:)`, `:152` `warningScopeFor(...)` (no `enforced` input) — every caller passes `enforced: nil`. Pass `securitySwitchOn(config, orgId, 'enforcedReads')`.
2. `Project Planner/Core/FirebaseBackend+ReadPlans.swift:99` (job plan) and `:146` (booking plan) — the listeners; re-plan (`jobReadPlanDidChange`) when the switch value changes.
3. `Project Planner/Core/Rulebook+JobAccess.swift:441-455` → `Project Planner/Core/WarningsComputation.swift:694`, `:768`, `:1135` — `warningScopeFor` for warnings and Daily Overview.
4. `Project Planner/Core/ForcedUpdateGate.swift:38` already reads `platformConfig/app` (launch and foreground): keep that document and hand `securitySwitches(config, orgId)` to the plans.
5. Debug-only whole-collection reads `Project Planner/FirebaseBackend.swift:3684` (`debugProjects`) and `:6571` — refused for restricted managers; make sure no shipping screen calls them.

**`privatePay`** — the rules refuse any write that puts a pay value on `users` / `operatives` / `managers` (the whole batch fails) and a non-admin's whole-collection read of rate history; after the strip, pay is only on `payProfiles`.
6. `Project Planner/FirebaseBackend.swift:6249-6262` `commitProfileWithPayHistory` — `users/{uid}` update carries pay in the same batch as `payProfiles`: pass the users half through `sharedDocumentPayWrite(payload, { privatePay })`.
7. `Project Planner/FirebaseBackend.swift:3249-3280` — catalogue `operatives` row pay (same fix); managers rows likewise.
8. `Project Planner/FirebaseBackend.swift:~7129-7135` (Add User invite) and `Project Planner/Core/UserStore.swift:1802` `acceptInvitation` — the placeholder / new account `users` document with invited pay: strip with `sharedDocumentPayWrite`; Add User writes the invited pay to `payProfiles/{placeholderId}` after the placeholder exists (web `lib/orgSetup/inviteUserCore.ts`).
9. `Project Planner/FirebaseBackend.swift:8424` `loadOperativeDayRateHistory` (whole collection) and `Project Planner/Views/InvoicingView.swift:2346`, `:4193` (`listensWhileOpen("operativeDayRateHistory")` on the whole collection) — use `rateHistoryQueryPlan(viewer, roster, roster, { privatePay })`: `all`, or one `userId ==` query per id.
10. Pay shown from `users` documents: `Project Planner/Core/Rulebook+PayPrivacy.swift:178` overlays pay profiles only for `ManageUsersView.swift:3402` and `SettingsHubSupportViews.swift:113`. Timesheets, User Timesheets, invoices and the weekly report read pay from the roster rows; lay every roster row over with `payProfileReadPlan` + `overlayPayProfile` (own id, else a `formerUserIds` id), as web `lib/pay/payProfileOverlay.ts` does, before the strip runs — but only while `privatePay` is on for the organisation; while it is off, read the users documents unchanged (an older build may have left the pay profile stale).
11. Not switched, but seen in the emulator: a non-admin `settings` list query (`whereField("userId", isEqualTo:)` at `FirebaseBackend.swift:~10603`) is refused by the rules today (switch off too: the settings rule cannot be proved for a query). Keep the per-document timesheet reads as the path that works.

Ship this as one build, then the owner raises `minimumIosBuild` to it before any company is switched on (`docs/SECURITY_SWITCHES.md`).


## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
