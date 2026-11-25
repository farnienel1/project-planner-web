# Handover — 25 Nov 2026 (launch day, 17:00 UTC) — READ THIS FIRST

> Read this, then `docs/OWNER_DECISIONS.md` (the "25 Nov" rows), then `docs/agent-rules/owner-working-style.md`. Launch checklist: https://claude.ai/artifact/7Q7erHuNW9RBFFK4VuiAcR (collection `items`; rows 1.165–1.171 are today's work).

## The one rule the owner cares about most
Every change is done on web AND iPhone AND checked against the one rulebook (`lib/canonical`), in the same piece of work. Never a second rulebook (the owner rejected the upgrade pack's `rules/*.json`: "use the existing one").

## Where things stand [Certain at 16:55 UTC 25 Nov]
- **Web main:** rulebook **1.95.0**, everything merged: #461 (uploads), #462 (scheduling back to booked week), #463/#465 (deadline fixes, Multiple floors section), #464 (personal site audit page, notification pop-ups), #466 (leave calendar summary + colours, 1.93.1), #467 (deadlines UI, 1.94.0), #468 (Tasks-style popup, filters, Multiple floors chip, Reopen, reschedule reasons; 1.94.1–1.95.0).
- **iOS main:** rulebook mirror **1.95.0**, everything merged: #307 (uploads), #308 (scheduling week), #309 (deadline fixes, date pickers close on tap), #312 (leave calendar + deadlines UI + filters + Reopen; #310 and #311 were folded into it and closed).
- **Owner settings done today:** Netlify `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` = `project-planner-f986c.firebasestorage.app` (the cause of stuck web uploads); `minimumIosBuild` = 16; `operativeOwnLeave: true` (every company; undo = false).
- **Nothing to deploy** for today's changes (no rules, indexes or functions changed).

## Next
1. Owner makes **build 17** from iOS main and runs the short test list (deadlines: summary/tabs, Multiple floors, complete → Reopen, reschedule reason, filters; leave calendar day summary + colours; an upload; iPhone scheduling week). Fix only what they find.
2. Owner steps still owed (not blocking): push-token clean-up script (double pushes to line managers), reminder-email function deploy, feedback sounds re-confirm, pay strip test.

## After launch (agreed, not started)
- Deadlines: ⋯ menu (Copy link, Delete), two-column details; iOS reschedule day count when the phone is in another time zone near midnight; web timeline today line near midnight; web/iOS history differ slightly on Reopen (iOS also writes a status line); the pack's colour tokens, server-recorded history events, reminder changes, several responsible people.
- iOS: task link no-access message, edit-task photo speed, Home error card, unlinked file left when a deadline save is refused, `DLStore` `Calendar.current`.
- Web: Retry on the job tasks card.

## Gotchas found today
- gitleaks flags packed-bundle renames like `x2.length` next to a "key" identifier; name rulebook helpers uniquely, and never quote the flagged text in `.gitleaksignore` comments (the comment itself matched).
- iOS screen checks run one PR at a time (~40 min); fold stacked iOS PRs into one to save time.

## Earlier: handover of 24 Nov 2026 (night), kept for history

> Launch is **25 Nov**. Read this section, then `docs/OWNER_DECISIONS.md` (from "24 Nov" down, especially "24 Nov evening decisions"), then `docs/agent-rules/owner-working-style.md`. Launch checklist (single status page): https://claude.ai/artifact/7Q7erHuNW9RBFFK4VuiAcR (collection `items`; rows 1.148–1.160 are tonight's work).

## The one rule the owner is most worried about
**Every change is done on web AND iPhone AND checked against the rulebook, in the same piece of work.** Every builder brief must name the web files, the iOS files and the rulebook functions. Every change gets its own iOS PR, or a written "iPhone checked, not affected" with file:line evidence. Every independent review reads the iOS code and the rulebook too. The iPhone gets native iPhone UI with the same capability and the same rulebook words. On 24 Nov this was not followed consistently and the owner noticed. Do not repeat that.

## Where things stand [Certain at 21:15 UTC 24 Nov]
- **Web main:** rulebook **1.87.0**. Merged tonight: #450 (1.87 timesheet ✕/⚙ fix — owner tested: "sorts the timesheet issue"), #451 (Exported list: versions collapsed, compact, line manager named), #453 (no blur on any pop-up).
- **iOS main:** `0980b043` = #297 (rulebook mirror **1.83.0**: 1.82, 1.83, small fixes, PAYE payday grid, CI speed-up). #289 #288 #292 #296 #291 #284 #290 were closed as included.
- **Owner's TestFlight:** rulebook 1.73. None of the last two days' timesheet work is on the owner's phone until **build 16**.
- **Parity audit** (58 web PRs since 21 Nov 04:00): the timesheet review / sign-off / revision flow is on iOS main. The only 2 iOS gaps (invoice PDF Full day line times; "Former: name" on Exported) are now iOS #301. Everything else is merged on iOS or in an open iOS PR.

## Open PRs and merge order (version order matters — owner rule 2)
| Order | PR | What | State |
|---|---|---|---|
| 1 | iOS **#302** `ios-integration-24nov-2` (37fdf469) | Stacks #295 (1.84), #294 (1.85), #293 (1.86), #298 (1.87 wording), #300 (Exported list), #301 (parity gaps) + mirror sync to web 1.87.0 (last commit marked WIP) | Mac checks just started (label `screen-checks`). Watch parity-tests + 16e/SE/Pro Max; fix any test broken by the 1.84–1.87 jump at its root cause. When green: squash-merge #302, close #295 #294 #293 #298 #300 #301 as included (comment + close, as done for #297). #295/#294/#293 were applied as their own commits on top (they were built on old 1.83 commits) — note for review. |
| 2 | web **#455** `w187-org-line-managers` + iOS **#303** `ios-1.87-org-line-managers` | Rulebook **1.88.0**: line managers per organisation (+ rules), **plus** Luke's profile bug (profile says "No line manager" while Edit user shows Farnie Nel) — both apps must use one rulebook answer | Built (web c9cd84e5, iOS 3a675820). Membership `lineManager` per org; rules: members of an org read its memberships, only that org's admins write the line manager. Rules bar passed pre-merge (cost 219,500 vs main 220,205; 533 rules tests; 0 type errors). Luke's bug: profile page read only the old single field + email-folded list — both screens now use `lineManagerSummary`/`lineManagerSelectedIds` over all users docs; "No line manager" wins on contradicting data and the next save tidies it. **Left:** independent review (web + iOS + rules), iOS Mac build/tests, merge, publish rules (Firestore + Storage) via workflow, owner deploys 3 functions (command in PR). Follow-ups: owner console person page, iOS Add User list, Data health for contradicting fields. **4 owner questions in the PR / below.** |
| 3 | web **#452** `w189-tasks` (a95b021b) + iOS **#299** `ios-1.89-tasks` (92eaeb19) | Rulebook **1.89.0**: Tasks upgrade (owner's Tasks pack) | Reviewed; all findings fixed on both. Needs main merged in after 1.88 (renumber section; rebuild; handoff; check `--base origin/main`) then iOS re-sync; one quick re-check; iOS Mac checks. One iOS test (`Rulebook1290Tests` orgCompliance) clears once 1.83 is on iOS main (it is now). |
| 4 | web **#454** `w190-draft-revisions` (10dbb485) + iOS **#304** `ios-1.90-draft-revisions` (fe014854) | Rulebook **1.90.0**: draft revisions (Make changes → grey "Save changes and send timesheet to [name]", blue after a change; red "Cancel revision"; person can't sign a draft; rules), **Cancel changes** (undo the line manager's session: restore edited/deleted bookings from stored before-values, remove session line reviews; refuse if changed elsewhere), **one card at the top** of the timesheet from "YOUR TURN" to the REV line (Earlier versions separate), "daily overview" all lower case | Web done (10dbb485, merged main 1.87; npm test 3361/1 xlsx; rules bar NOT re-run after the merge — re-run it). iOS **#304** `ios-1.90-draft-revisions` (fe014854, WIP): draft revision + Sign blocked done; **left on iOS:** Cancel changes (store before-values, undo, Cancel revision restores first — hand-off items 8–10), move "Changed since it was signed" into the one top card, swap `TimesheetPayrollLineBookingLookup` to rulebook `signedTimesheetLineBooking`, Mac build/tests. Then independent review (web + iOS + rules), merge after 1.89, publish rules before web deploys, owner redeploys `timesheetBookingsChangedNotice` + `timesheetManagerBookingsChangedNotice`. **4 owner questions below.** |
| — | web #397 | Dependabot TypeScript 7 | Hold (owner: after typescript-eslint supports it). |

## Owner questions waiting (ask in one list, plain English)
1.88 line managers per organisation:
1. Can every member of a company read the memberships in it? (Needed so screens show that company's line manager.)
2. A visiting member with no line manager set in company B still shows their home-company line manager on B's screens (no rights in B) — OK?
3. A member only in the members map with no membership record can't be given a B line manager until they open B once (clear message) — OK?
4. Contradicting stored data ("No line manager" + ids): "No line manager" wins, next save tidies — OK?
1.90 Cancel changes:
5. A removed booking comes back under a new id (old id stays deleted); things tied to the old id (approved overtime line, clash approval) don't follow; a cancelled draft leaves "Revision due" on the exported sheet — OK?
6. Only an admin, or a line manager who manages that job, can put a removed booking back; others get times restored but the removed booking stays removed with a message — OK?
7. Cancel changes covers Make changes on a signed-off sheet and draft revisions, not the first review before any counter-signature — OK?
8. Edits made before 1.90 (or from an older iPhone) can't be undone (no stored old values) and are named "not undone" — OK?

## Then build 16
When the iPhone stack has everything (1.84–1.90 + Exported + parity gaps + Tasks): tell the owner "ready to archive build 16" with the commit and a short test list. After the owner tests it, raise `minimumIosBuild` to 16 (owner step, Firebase console → Firestore → platformConfig/app).

## Owner steps still owed (send exact beginner commands when due)
1. After 1.85 is live: deploy the reminder-email function and switch reminders on: `firebase deploy --only functions:inbox-push:orgComplianceExpiryReminders --project project-planner-f986c`, then set `orgComplianceRemindersEnabled` (see 1.85 PR / rulebook Deploy notes).
2. Error log 30-day clean-up: `gcloud firestore fields ttls update expireAt --collection-group=clientErrors --enable-ttl --project=project-planner-f986c`.
3. Push-token clean-up script (`docs/scripts/dedupe-push-tokens.md`).
4. Private pay switch-on and strip (5 Nov row; after `minimumIosBuild`).
5. Raise `minimumIosBuild` after testing build 16.
6. Rules publishes for 1.88 and 1.90 are done by Claude via the "Firebase rules deploy" workflow after the rules bar passes; functions stay owner-deployed.

## Launch checklist rows still open (not tonight's)
1.128 line-manager changes reach bookings (triple-check), 1.136 double push, 1.137 VO tracker wording into rulebook, 1.138 web dashboard map, 1.139 subcontractor documents, 1.140 company details mismatch, 1.141 Payrun Snapshot, 1.143 iPhone weak-signal notice, 1.144 "Last active", 1.145 login sound, 1.147 certificates, 1.156 owner steps. Read each row's `who` text.

## Small open items from tonight
- iOS Exported row: "Former person" chip only on former rows (by design).
- `SiteMapCoordinate` enum on iOS now only used by a test — move tests to `SiteMapPlacementRules`, delete enum.
- Web follow-up: `timesheetLineDisplay` doesn't give a window for "FULL DAY · no break" (rulebook follow-up, noted 23 Nov).
- Passkey reminder "Don't remind me again" is per browser (owner OK'd per device).

## How to work (unchanged)
Owner rules 1–4 in `owner-working-style.md`: squash-merge via REST with `sha=` head and trailers; rulebook PRs merge in version order; lean mode (one review + one quick re-check, small fixes yourself, limited background agents — tonight hit the 5-hour usage limit at 21:07 UTC with 6 agents running); security review rules. GraphQL is blocked: use `gh api` REST. iOS Mac CI is slow: stack iOS PRs on one integration branch and run CI once.

---

# Handover — 23 Nov 2026 (evening)

> Read this first; the 21 Nov section below is older. Then `docs/OWNER_DECISIONS.md` and the rule files. Launch checklist (now the single status page): https://claude.ai/artifact/7Q7erHuNW9RBFFK4VuiAcR — rows 1.122–1.137 are today's work. The old "All fixes progress" page is retired.

**Live:** web main rulebook **1.73.1**; iOS main `4313a263` (VO tracker #273 merged 23 Nov). TestFlight build 13, `minimumIosBuild` 13, Firestore rules from main published 23 Nov.

**Merge rules:** (#425 and #427 report a merge conflict with main since #428 merged at 19:17 — merge main in and keep both sides first.) web rulebook PRs merge in version order 1.74 → 1.75 → 1.76 → 1.77 → 1.78; each later one needs main merged in, renumber if needed, `npm run build:canonical`, `npm run rulebook:handoff`, `node scripts/rulebook-sync.mjs check --base origin/main`, then iOS re-syncs its pair. Squash-merge via REST (`POST …/pulls/N/ccr/ready_for_review`, then `PUT …/pulls/N/merge` with `sha=` head, trailers in commit_message). GraphQL is blocked. macOS CI queues for hours.

## Release order for 1.74 (timesheet review flow)
1. Merge iOS #276 (+ #274, #275, #277) when Mac checks are green → tell the owner a TestFlight build is ready (commit + test list).
2. Owner raises `minimumIosBuild` to that build.
3. Merge web #425, publish rules via the "Firebase rules deploy" workflow, check live.
4. Owner deploys: `firebase deploy --only functions:inbox-push:timesheetBookingsChangedNotice,functions:inbox-push:timesheetManagerBookingsChangedNotice --project project-planner-f986c`
5. Then #426 (renumber to 1.75.0) → #427/#278 (1.76) → 1.77 → #429/#280 (1.78).

## Open PRs [Certain as of 19:15]
| PR | What | State |
|---|---|---|
| web #425 / iOS #276 | 1.74 timesheet review flow (LM changes freely before sign-off, line order, no £0 line, single push) | Reviewed + re-checked. iOS head `e6714bed` (fixed a source-scan test: `signature: counterSignature,`). Waiting Mac CI. |
| web #426 | 1.75 (currently numbered 1.76.0!) Data health: qualifications with no own expiry | Approved. Renumber to 1.75.0 after #425. |
| iOS #277 | Qualification reminders in org time zone | Approved. Head `53b2438d` (removed the now-zero `NotificationService` deviceCalendar baseline entry). Waiting Mac CI. |
| iOS #274 | Warnings first scan doesn't wait 30 s | Re-checked ok. Head `3adbb0fb` (added `Core/WarningsRosterFingerprint.swift: 1` to RulebookBypassGuardTests baseline). Waiting Mac CI. |
| iOS #275 | PAYE payday revert + More→Settings nav + "Discard unsaved changes?" on tab re-tap | Re-checked ok. Head `ad685c1c`. Waiting Mac CI. Owner retests Save on TestFlight (root cause unproven). |
| web #427 / iOS #278 | 1.76 "Make changes" (A1/B1 + signed price work & expenses, any amount) | Reviewed twice, all findings fixed. Heads web `1f416e80`, iOS `9f69ff9e` (merged #276 fix). Waiting on #425/#426. Owner runs `scripts/report-signed-money-mismatch.mjs` (read-only) before switch-on. Commits used `--no-verify` (same-version hook); CI check with `--base` passes. |
| web #431 (1.77 timesheet clarity, owner points 1,2,3,5,6; iOS #281; heads web `a47aaa18`, iOS `542e7018`; built, NOT reviewed; 6 judgement calls for the owner in the #431 body and OWNER_DECISIONS "1.77.0 judgement calls") | "Correct this timesheet" button, whose-turn line, polished "Changed since you signed" card, "Next: generate your invoice", reports "Awaiting re-sign" | Builder was still running at handover; branches `w177-timesheet-clarity` / `ios-1.77-timesheet-clarity`, report goes in the PR bodies. Needs independent review. |
| web #429 / iOS #280 | 1.78 LM sign-off reminder: Settings item 5 (1–3 days, default 2, 08:00); admins for no-line-manager people; admin escalation 08:00 day before payday; note under item 5 | Built, NOT reviewed. 5 builder judgement calls for the owner (in OWNER_DECISIONS / PR body). Deploy after merge: `firebase deploy --only functions:inbox-push:timesheetSignOffReminders,functions:inbox-push:sendDevicePushOnNotificationCreate --project project-planner-f986c` (needs Cloud Scheduler API). Will need rebasing onto 1.77. |
| web #428 / iOS #279 | Double push: 8 stale tokens on a line manager. iPhone replaces its own old token (Keychain), cap keeps newest, transactional write; owner clean-up script `--user --validate --keep-newest` | Reviewed + re-checked: mergeable. Owner approved both judgement calls. No rulebook change, no deploy. Web #428 MERGED 23 Nov 19:17 (`6cd38f61`); iOS #279 waits Mac CI. Then send the owner `docs/scripts/dedupe-push-tokens.md` steps. |

## Owner decisions today (all in OWNER_DECISIONS)
Make changes a ok / b changed (LM edits signed price work+expenses, any amount) / c ok; timesheet flow points 1–6 all before launch; reminder default 2 days at 08:00; admins: no-LM people + escalation 24 h before payday; double push a+b ok.

## Follow-ups
- VO Reopen / Unlock order wording into the rulebook (iOS #273 PR body lists the strings).
- Batch 3 #1: triple-check LM changes reach booking + scheduling after 1.74 is live.
- iOS Edit user save-timeout pattern; `exportedAt` invoice nits; flagless users in `staffAccountRole`.
- Known limits on Make changes: no undo after first change; repeat "changed" notice possible.

---

# Handover — 21 Nov 2026

> Read this first; the 19 Nov section below is older.

- **Web main:** rulebook **1.69.0**. Merged 19–21 Nov: #381 (1.66), #378 (1.67), #389 (1.68), #380 (Warnings Dismiss, no rulebook change), #379 (1.69, was 1.62), #338 (owner console docs), #394 and #395 (minor dependency updates).
- **iOS main:** merged #252 (1.60.1) and #263 (mass assignment). Open, each with main merged in and the rulebook mirror synced to 1.69.0: #253 (overtime wording, now through `liveDayRateOvertimeText`), #254, #256, #257, #260, #261, #262. Merge each once its Mac checks are green.
- **Upgrades (owner 21–22 Nov: do all three before launch):** React 19 merged (#402); Tailwind 4 merged (#403, Tailwind 3 look kept: 120 screenshots light + dark matched, e2e 40/40); TypeScript 6.0 merged (#404) — TypeScript 7 waits for typescript-eslint support (Dependabot #397 left open). Follow-up: the 59 styles that never showed on Tailwind 3 stay off (owner 22 Nov), switch on after launch if wanted. Web #399 (date-fns 4): branch updated, CI re-running. Web #365: owner preview check.
- **Owner steps done 23 Nov:** all Cloud Functions redeployed from main (`firebase deploy --only functions`); SendGrid keys deleted; the M365 app password was already deleted; the leaked Resend keys (`re_E…`, `re_L…`) are no longer in the account (live keys `re_iL…` / `re_Cg…` are newer, created after the leak); `minimumIosBuild` 10 checked against TestFlight (newest build 10, app opens); Firebase email templates' sender name set to Project Planner; #365 preview checked and merged.
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
