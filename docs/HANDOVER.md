# Handover — 21 Nov 2026

> Read this first; the 19 Nov section below is older.

- **Web main:** rulebook **1.69.0**. Merged 19–21 Nov: #381 (1.66), #378 (1.67), #389 (1.68), #380 (Warnings Dismiss, no rulebook change), #379 (1.69, was 1.62), #338 (owner console docs), #394 and #395 (minor dependency updates).
- **iOS main:** merged #252 (1.60.1) and #263 (mass assignment). Open, each with main merged in and the rulebook mirror synced to 1.69.0: #253 (overtime wording, now through `liveDayRateOvertimeText`), #254, #256, #257, #260, #261, #262. Merge each once its Mac checks are green.
- **Held for the owner:** web #396 (Tailwind 4), #397 (TypeScript 7), #398 (React DOM 19): major upgrades that fail the build and need code changes. Web #399 (date-fns 4): branch updated, CI re-running. Web #365: owner preview check.
- **Still to do:** iOS #262 and #266 (see the iOS queue), checklist artifact rows, owner key revocations (`docs/security-audit-log.md`).

---

# Handover — 19 Nov 2026

> **Read this section first; everything below "Handover — 17 Nov" is older history.** A new chat starts with no memory: read this, then `docs/OWNER_DECISIONS.md`, then the rule files (`owner-working-style.md` especially).

**Dates:** full test 20 Nov · scan pass 2 on 22–23 Nov · launch 25 Nov. Checklist: https://claude.ai/artifact/7Q7erHuNW9RBFFK4VuiAcR

**Usage is tight (owner bought credits 19 Nov).** Work lean:
- No background agents that wait on CI. Unsubscribe from PR activity; check CI once with `gh api` when needed.
- One independent review per change, then one quick re-check. Small fixes: do them yourself.
- Finish the queue below before starting anything new. Short messages to the owner.

## Live now [Certain]

- **Web main `c93bb19b`**, rulebook **1.65.5**. Merged 17–19 Nov: #388 variations (1.63), #392 rules 1.64.0 (**published 18 Nov**, live matches main), #386 timesheet lookups by every id, #391 server allowlist + report checks (1.65.x), #390 Projects restyle, #371 Managers page / "Saving…" fix, #384 read-only report, #361 branded account emails.
- **Functions deployed by the owner 18–19 Nov:** `overtimeReportIntegrityCheck`, `payeClaimReportIntegrityCheck`, `sendEmail`.
- **iOS main:** merged #249, #258, #264, #250 (rulebook 1.57 + 1.58), #259 (timesheet lookups), #251 (leave cover + multi-person block, rulebook 1.60.0).
- `minimumIosBuild` = **10** (owner, 18 Nov; not verified against TestFlight build numbers).

## Queue — web (rulebook order; each needs main merged in, repack, hand-off with `--base origin/main`, green CI)

| PR | What | Version | State |
|---|---|---|---|
| #381 | Timesheet queue (awaiting all) | 1.66.0 | Reviewed clean, all findings fixed. Needs main merged (conflicts since #386/#391/#371), then merge. |
| #378 | Overtime wording (`liveDayRateOvertimeText`) | 1.67.0 | Reviewed clean. Needs main merged after #381. |
| #389 | Site audit uploads / PDF / field limits | 1.68.0 | Reviewed clean. Needs main merged after #378. Follow-ups: re-submit from the open form leaves a spare photo; no test for web sign-out photo delete. |
| #380 | Warnings: Dismiss on every type | renumber to 1.69.0 | Not reviewed since rebase. Needs main, renumber, review. |
| #379 | Simple booking hours breakdown | renumber to 1.70.0 (was 1.62.0) | Not reviewed since rebase. Needs main, renumber, review. |
| #365 | middleware.ts → proxy.ts | none | Code review clean. **Do not merge** until the owner confirms, signed out, that `deploy-preview-365…/dashboard` redirects to sign-in (Netlify may not run `proxy.ts`). Fine to leave until after launch. |

Tip: after each merge the next PR conflicts in `docs/RULEBOOK.md`, the packed files, `docs/ios-handoff/*`, `package.json` test lists and `docs/OWNER_DECISIONS.md`. Keep both sides; take main's generated files then `npm run build:canonical`; commit with `--no-verify` and run `node scripts/rulebook-sync.mjs check --base origin/main` by hand. This checkout's `origin` fetch refspec is narrow: fetch branches explicitly (`git fetch origin <b>:refs/remotes/origin/<b>`).

## Queue — iOS (in this order; each needs iOS main merged in and green parity-tests + screen-checks; macOS runners queue for hours)

| PR | What | State |
|---|---|---|
| #252 | Rulebook 1.60.1 (timesheet notice per signature) | Merged. |
| #263 | Mass-assignment fixes (pair of web #391) | Merged. |
| #253 | Overtime wording (pair of #378) | Merged 21 Nov. |
| #261 | Variations 1.63 | Merged 21 Nov. |
| #257 | Timesheet queue (pair of #381) | Merged 21 Nov. |
| #262 | Site audit (pair of #389) | Main merged (`7c0b1aea`); merge when parity-tests and screen-checks are green. |
| #254 | Hours breakdown 1.62 | Merged 21 Nov. |
| #256 | Clash cluster dismiss (every overlapping pair) | Merged 21 Nov (stale `variationIsPinned` and dismiss-sound anchor tests fixed). |
| #260 | Daily Overview Other / Site survey rows (UI only) | Merged 21 Nov. |
| #255 | Rules-test tooling: firebase 13.3.0, firebase-tools 15.36.0 (replaces #206, #229) | Merged 21 Nov. |
| #266 | Dependabot: firebase 13.3.0 → 13.4.0 (rules-test tooling) | Code checks pass; only the PR-description check fails (Dependabot body). Fill the body, then merge. #265 closed. |

Known trap (bit #251): since iOS #249 `Booking.storedOperativeId(for:)` returns `String?` and is write-only; reads and matching use `Booking.operativeMatchKey(for:)`.

## Waiting on the owner

- Results of the 18–19 Nov test (seven web items: timesheet lookups, own-profile security refusals, report checks in Data health, restyle, Managers/Edit user saves, branded emails, variations).
- #365 preview check (above).
- Confirm `minimumIosBuild` 10 does not lock out the newest TestFlight build.
- Security review: `STRIPE_TRIAL_REQUIRES_CARD` value; TOTP for the owner login (step 6); **Part B approval**; revoke the leaked keys if not yet done (M365 app password, two Resend keys, SendGrid key). `docs/security-audit-log.md` is still to be written (no secrets or customer data in it).
- Open judgement calls in `docs/OWNER_DECISIONS.md` ("owner to confirm"), incl. #390's two colour choices (recommended options built), Super Admin own `isActive`, own line-manager lock, legacy partly-id'd tasks, one-email-per-pay-run export on iOS, other admins changing the Super Admin's pay.

## Not recorded yet (do in the next chat)

- `docs/OWNER_DECISIONS.md` rows for 17–19 Nov answers (mass-assignment A–D approved, site audit report "all yes" + never drop text + logo top right, restyle 13 answers, overtime wording "new is clearer", sign-out rule ok, build 10).
- Checklist artifact rows for everything merged above.
- Main's `Rulebook / ios-mirror` check is red by design until iOS syncs 1.65.

---

# Handover — 17 Nov 2026 (morning)

This file hands the work from one Claude Code chat to the next. A new chat starts with no memory: **read this file first**, then `docs/OWNER_DECISIONS.md`, then the repo rule files (`CLAUDE.md`, `AGENTS.md`, `docs/RULEBOOK.md`, `docs/agent-rules/*`, especially `owner-working-style.md`). Update this file at the end of every chat.

**Key dates**

| Date | What |
|---|---|
| 20 Nov | Full test of both apps (owner) |
| 22–23 Nov | Scan pass 2 (Claude) |
| 25 Nov | Launch |

- Live launch checklist (database collection `items`): https://claude.ai/artifact/7Q7erHuNW9RBFFK4VuiAcR
- Progress page: https://claude.ai/artifact/3E1EoGzBW3KmjPwWn3Fvmt

**Working mode** (owner, 16 Nov: "go back to normal"):
- Agents build, independent agents review.
- Claude merges only after a clean review, with every finding fixed.
- Web merges deploy live by themselves (Netlify).
- Firestore rules, Storage rules and indexes are published by Claude with the **rules publish button** (below) after the full rules bar.
- Cloud Functions stay owner-deployed by hand.
- Web worktrees go under `/home/user/wt/<name>` or the scratchpad, never next to `project-planner-ios` (`owner-working-style.md`).

---

## 0. Live now [Certain]

| Item | State |
|---|---|
| Web **1.55.1** (main `81a421d`) | Live. Includes 1.55.0 timesheet revisions (#344) and the owner console foundations (#348) plus their rules (#350). |
| Firestore rules **1.55.1** | Published 17 Nov 00:02 UTC with the button (run 43984222359). Live ruleset `15452a02-a4f4-4875-b95d-42c97fd26caf` matches main. Rollback: the 16 Nov 21:47 ruleset `ad036500-c74a-4771-87e0-f3f6df74eddb` (1.54.2). |
| Storage rules and indexes | Published 16 Nov 21:47 from 1.54.2 (unchanged since). |
| iOS main | `c56abb6` (#243 merged 17 Nov 00:50). Mirror = web 1.55.1 (sha256 `9a6defb4…`). Includes revisions. |
| iOS on the owner's phone | **Build 8** (made from iOS main `a903cc0`): sounds and haptics, 1.54, pay overlay, scan fixes. **No revisions.** |
| `minimumIosBuild` | Not raised for 8. Raise to **9** once build 9 (revisions) is on TestFlight, **before** anyone uses revisions on an iPhone. |

## 1. What happened overnight 16–17 Nov

1. **Rules publish button** (#346): a GitHub workflow `firebase-rules-deploy.yml`.
   - It runs on main only, in the protected environment `firebase-rules`.
   - It uses a key for the service account `github-rules-deployer@…`; the current key is `f67f3cf7…` and the old key was deleted.
   - Before deploying it checks that CI passed on the commit, and afterwards that the live rules match main.
   - Trigger: Actions → "Firebase rules deploy" → Run workflow on `main`; targets `firestore-rules` / `storage-rules` / `indexes` / `firestore-rules+storage-rules` / `all-rules`; type `publish`.
   - Functions are not deployed by it.
2. **1.54.2 hotfix published** (16 Nov 21:47): line managers can open their reports' timesheets with private pay on.
3. **#347 scan follow-ups merged** (late extras kept, clash approval sound, extras sounds, catalogue operatives' pay wait).
4. **#348 owner console foundations merged** (guard, audit, directory routes, sidebar, seed, e2e harness).
5. **#344 rulebook 1.55.0 timesheet revisions merged.**
   - After export, a booking change makes a revision due; the person creates `settings/{original}_rev{N}`, signs, the line manager counter-signs, and Export shows REV N.
   - Its rules were **not** published at merge time (Claude misreported this at first); they were published with 1.55.1.
6. **#350 rules 1.55.1 merged and published.** Changes: owner console audit-log shape, `ownerNotes`, `erasedOrganizations` read, retired collections closed. 113 bytes of the rules byte budget are left.
7. **iOS #243 (1.55 revisions) merged** after an independent re-review. Its one finding was fixed: a save is refused when a newer revision exists.
8. **#349 docs**: the publish button is recorded, plus the worktree rule (web hooks had overwritten the iOS checkout twice; restored with `git restore`).
9. **Publish run note:** the first 1.55.1 publish failed with a Google 503 (nothing changed live); the retry 2 minutes later succeeded.

## 2. Owner steps (in order)

1. **Deploy the five Cloud Functions** (needed for 1.54 and 1.55: changed-timesheet notices, revision push, the eraser and the email function). From `~/Developer/project-planner-web`:
   1. `git checkout main` — switches to the main branch.
   2. `git pull` — fetches tonight's changes; you should see `81a421d`.
   3. `firebase deploy --only functions:inbox-push:timesheetBookingsChangedNotice,functions:inbox-push:timesheetManagerBookingsChangedNotice,functions:inbox-push:sendDevicePushOnNotificationCreate,functions:inbox-push:eraseDeletedOrganizations,functions:inbox-push:sendEmail --project project-planner-f986c` — deploys only those five. You should see `✔ Deploy complete!`. The eraser stays switched off (`organizationErasureEnabled`).
2. **Make build 9** from iOS main (`c56abb6` or later) and upload it to TestFlight.
3. **Raise `minimumIosBuild` to 9**: Firebase console → Firestore → `platformConfig` → `app` → `minimumIosBuild`. Do this once build 9 is on TestFlight, before revisions are used on iPhones.
4. **Owner console:** add the Netlify environment variable `FIREBASE_SERVICE_ACCOUNT_JSON` (steps in #348). Then do one owner action, e.g. "Mark as test" on the test company, to confirm audit entries are accepted.
5. **Check after the functions deploy:**
   - export a test timesheet;
   - change one of its bookings as an admin;
   - the person gets "Update to your exported timesheet" once and sees "Review and sign again";
   - Export then shows REV 1.

## 3. Open questions for the owner

| # | Question | Recommendation |
|---|---|---|
| 1 | #335: annual leave report for a past year — which months? | Keep today's months |
| 2 | #348: owner console audit log for list views | One entry per list or export |
| 3 | ANSWERED 17 Nov: the web repo is **public** on GitHub — intended? | Owner: repos stay public until after launch; then lighter CI plus a read-only token, then private (OWNER_DECISIONS 17 Nov) |
| 4 | Branch protection "Part C" (optional) | Optional; not needed for launch |
| 5–8 | 1.56 "operatives see only their own annual leave" (row F24), Q1–Q4 below | See below |

1.56 questions:
- **Q1.** On web, operatives see a job's week grid with colleagues' leave marks; after 1.56 only their own. OK? Recommended: yes.
- **Q2.** Should operatives see colleagues' leave on jobs they're booked on? Recommended: no.
- **Q3.** A new switch `operativeOwnLeave`, or tie it to `enforcedReads`? Recommended: new switch. ANSWERED 17 Nov: new switch `operativeOwnLeave` / `operativeOwnLeaveOrganizationIds`, read only by the Phase B rules; exact-ID matching, no same-email search, 10 IDs per query (OWNER_DECISIONS 17 Nov).
- **Q4.** Leave stored under old keys: fix the data or keep the read open? Recommended: fix the data.

**1.56 plan:**
- **Phase A** (no rules change): a shared `leaveQueryPlan`; the web and iOS leave stores load per viewer; data check; a legacy-key report.
- Then iOS build, raise `minimumIosBuild`, run the report.
- **Phase B:** narrow the rules behind the switch.
- Every reader of leave is listed in the plan: web `lib/stores/holidayStore.ts:147`, iOS `Core/HolidayStore.swift:171` and `FirebaseBackend.swift` `loadHolidayBookings`.

## 4. Open work (next for Claude)

1. **Web: timesheet revisions shown twice** on Users → person → Price work / Expenses (original and revisions side by side; iOS shows only the latest version). Fix: list only the latest version per pay run.
2. **Dependabot**, all reviewed safe, in this order:
   - web #339 (eslint-config-next);
   - iOS #229 (firebase-tools);
   - iOS #206 (firebase; rebase after #229).
   Their PR-body check fails because Dependabot doesn't fill the template; fill the body, then merge.
3. **Stale drafts to close:** web #332 (superseded by this handover), #338 (owner console docs; check whether #348 replaced it), iOS #192 and #194.
4. **Rules byte budget:** 148,367 of 148,480 bytes. The next rules change must trim first or state a budget raise.
5. **1.56 Phase A** after the owner answers Q1–Q4.
6. **Scan pass 2** on 22–23 Nov.

## 5. Notes for the next chat

- iOS main's "iOS mirror" job on web main goes green once it runs against iOS `c56abb6` (iOS is now 1.55.1).
- The publish workflow's CI gate needs these push-to-main runs green on the commit: `build-and-test`, `rules-typecheck` (web-ci.yml) and `rulebook-check` (rulebook.yml). The `ios-mirror` job is not part of the gate.
- PR bodies: use `gh api … -F body=@file` (capital F). Lower-case `-f` stores the path text.
- Merges: `POST …/pulls/N/ccr/ready_for_review`, `PATCH draft=false`, then `PUT …/merge` with `sha` and `merge_method=squash`.
