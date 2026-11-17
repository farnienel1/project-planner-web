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
| 3 | The web repo is **public** on GitHub — intended? | Make it private before launch unless intended |
| 4 | Branch protection "Part C" (optional) | Optional; not needed for launch |
| 5–8 | 1.56 "operatives see only their own annual leave" (row F24), Q1–Q4 below | See below |

1.56 questions:
- **Q1.** On web, operatives see a job's week grid with colleagues' leave marks; after 1.56 only their own. OK? Recommended: yes.
- **Q2.** Should operatives see colleagues' leave on jobs they're booked on? Recommended: no.
- **Q3.** A new switch `operativeOwnLeave`, or tie it to `enforcedReads`? Recommended: new switch.
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
