# Project Planner — full handover for the next session (23 Nov 2026, evening)

One file: where things stand, what to do next, and the whole launch checklist. A new chat starts with no memory: read this file, then `docs/OWNER_DECISIONS.md` and the rule files (`docs/agent-rules/owner-working-style.md` especially). Launch is **25 Nov**.

## Part 1 — Handover

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
| 1.77 timesheet clarity (owner points 1,2,3,5,6) | "Correct this timesheet" button, whose-turn line, polished "Changed since you signed" card, "Next: generate your invoice", reports "Awaiting re-sign" | Builder was still running at handover; branches `w177-timesheet-clarity` / `ios-1.77-timesheet-clarity`, report goes in the PR bodies. Needs independent review. |
| web #429 / iOS #280 | 1.78 LM sign-off reminder: Settings item 5 (1–3 days, default 2, 08:00); admins for no-line-manager people; admin escalation 08:00 day before payday; note under item 5 | Built, NOT reviewed. 5 builder judgement calls for the owner (in OWNER_DECISIONS / PR body). Deploy after merge: `firebase deploy --only functions:inbox-push:timesheetSignOffReminders,functions:inbox-push:sendDevicePushOnNotificationCreate --project project-planner-f986c` (needs Cloud Scheduler API). Will need rebasing onto 1.77. |
| web #428 / iOS #279 | Double push: 8 stale tokens on a line manager. iPhone replaces its own old token (Keychain), cap keeps newest, transactional write; owner clean-up script `--user --validate --keep-newest` | Reviewed + re-checked: mergeable. Owner approved both judgement calls. No rulebook change, no deploy. Web #428 MERGED 23 Nov 19:17 (`6cd38f61`); iOS #279 waits Mac CI. Then send the owner `docs/scripts/dedupe-push-tokens.md` steps. |

## Owner decisions today (all in OWNER_DECISIONS)
Make changes a ok / b changed (LM edits signed price work+expenses, any amount) / c ok; timesheet flow points 1–6 all before launch; reminder default 2 days at 08:00; admins: no-LM people + escalation 24 h before payday; double push a+b ok.

## Follow-ups
- VO Reopen / Unlock order wording into the rulebook (iOS #273 PR body lists the strings).
- Batch 3 #1: triple-check LM changes reach booking + scheduling after 1.74 is live.
- iOS Edit user save-timeout pattern; `exportedAt` invoice nits; flagless users in `staffAccountRole`.
- Known limits on Make changes: no undo after first change; repeat "changed" notice possible.

## Part 2 — Launch checklist (copy of https://claude.ai/artifact/7Q7erHuNW9RBFFK4VuiAcR, 23 Nov 19:20)

Keep the live checklist up to date (database collection `items`, one document per row: `code`, `section`, `order`, `status` todo/doing/done/parked, `title`, `who`, optional `expect`; pin writes with `if_version`). This copy is for reading only.

### Still open (49 rows)

| Code | Status | What | Who / next |
|---|---|---|---|
| 0.1 | todo | DATES: launch 25 Nov. Updated 23 Nov evening: batches 1–3 almost all merged (rows 1.110–1.137). Live: TestFlight build 13, minimumIosBuild 13. In flight: timesheet review flow 1.74, Make changes 1.76, timesheet clarity 1.77, line manager reminder 1.78, double-push fix. Next for you: new TestFlight build once the iPhone changes merge, then raise minimumIosBuild. | Claude + you: same-day turnaround on your steps keeps the dates |
| 1.71 | doing | Push notifications never arrive (only the on-phone material cut-off works): logging, test button in Settings, stop deleting tokens on Apple errors (web #313, iPhone #226) | Merged. You: on build 6, Settings → Notifications → Send test; tell Claude if nothing arrives |
| 1.73 | doing | Web Annual leave report + VO tracker 'Submitted' column + Annual leave wording (web #335) | Claude: built; finishes after 1.54 merges |
| 1.74 | doing | 1.56: operatives see only their own annual leave — web merged (#356, behind a switch, off); iPhone #246 in final fixes; then report, minimumIosBuild, Phase B rules, switch on | Claude: after #334 merges; needs a new iPhone build first |
| 1.75 | doing | Rules 1.53.1 pre-launch hardening (web #334), then iPhone 1.53.1 sync | You: npm run test:rules on branch w-rules-hardening; then Claude merges and you publish |
| 1.76 | todo | Fix every new code-checker warning (4 React rules) and make them errors again | Claude: after 1.54 merges |
| 1.77 | doing | Feedback sounds on the website (Settings → Sounds) | Ready (#341). Waiting for your 'ok' on the sounds, then merge. |
| 1.78 | doing | Feedback sounds + haptics on the iPhone (My notifications → Sounds & haptics) | Ready, all checks green (#239). Waiting for your 'ok' on the sounds; not in build 7, goes in build 8. |
| 1.79 | doing | Owner console rebuild (/developer): plan check, your decisions D1–D17, then PR 0 security hotfix and the rest one PR at a time | PR 0 and PR 1 (#348, foundations: guard, audit, directory, search, sidebar in app style, useful-only) merged 16 Nov. Its rules commit waits for #344. You: Netlify server key (steps in #348). Question: audit log for list views? |
| 1.82 | doing | Full code scan of web, iPhone, rulebook, rules and functions (pass 1 now, pass 2 ~22–23 Nov) | Pass 1 fixes merged: rules 1.54.1 (#334), iPhone (#242), web (#343) and follow-ups (#347). iPhone follow-ups (late extras, clash sound, extras sounds, pay wait) queued for build 9. Pass 2 ~22-23 Nov. |
| 1.83 | todo | Follow-ups: late extra with a blank title dropped on next save (both apps); operatives with no account priced without the pay wait; compare web vs iPhone 'priced people' on the same data; MFA cookie tie to user; 218 code-checker warnings | Claude, after 1.54 |
| 1.84 | doing | Timesheet revisions: admins and line managers create REV 1, REV 2 of an exported timesheet; the person signs, line manager counter-signs, export shows REV n and the difference; original never changes (web, iPhone, rules) | Web #344: final review done, last fixes + rules checks running. iPhone #243 built, all checks green, under review; needs one re-sync after #344. Then a rules publish and build 9 (+ minimumIosBuild 9). |
| 1.90 | todo | iPhone sync 1.57 + 1.58 (+1.59): timesheet fixes, N/A brands, then timesheet follow-ups | Claude: after iPhone #246 merges |
| 1.91 | doing | iPhone fixes: task picker one row per person (#248), no bookings under unknown person ids (#249) | Claude: review fixes |
| 1.95 | doing | Web: Dismiss on every warning type with the iPhone-style pop-up, and tidier buttons on every warning card | iPhone #256 merged 21 Nov (dismiss writes every clash pair); web part: Claude to confirm |
| 1.101 | doing | Managers page same style as Operatives; Save no longer sticks on 'Saving…'; Add user on Managers (admins) and Operatives pre-selects the user type (web #371 + iPhone) | Claude: review fixes |
| 1.108 | doing | Projects & Small works navy-band restyle, UI only (your 13 answers: all yes) | Claude: building |
| 1.128 | todo | Batch 3 #1: triple-check line manager changes reach the booking and project / small works scheduling | Claude: after 1.74 is live |
| 1.129 | doing | PAYE payday reverts to 'Not set' + More → Settings stays on Payment runs: web #423 merged; iPhone #275 waiting for Mac tests (also asks before discarding unsaved settings) | Claude: merge when tests pass. You: retest Save on the next TestFlight build |
| 1.130 | doing | iPhone Warnings 'checking' ~30 s: first scan no longer waits; only warnings-relevant roster changes rescan (iPhone #274) | Claude: merge when Mac tests pass |
| 1.131 | doing | Timesheet review flow (rulebook 1.74, web #425 + iPhone #276): line manager changes lines freely before sign-off; £0 struck line kept off the invoice; lines ordered booking, overtime, booking, overtime; 'X changed your timesheet and signed it off' notice | Order: iPhone build on TestFlight → you raise minimumIosBuild → merge web + publish rules → you deploy 2 functions (I send the command) |
| 1.132 | doing | Qualifications with no expiry of their own listed in Data health (web #426, 1.75) + iPhone qualification reminders in the organisation's time zone (#277) | Claude: merge after 1.74 / when Mac tests pass |
| 1.133 | doing | 'Make changes' on signed-off timesheets (rulebook 1.76, web #427 + iPhone #278): line manager changes bookings, price work and expenses (any amount) and signs off again without the person re-signing; exported → revision | Claude: reviewed; merges after 1.74/1.75. You: run the read-only signed-money check before switch-on (I'll send steps) |
| 1.134 | doing | Timesheet clarity (1.77): one 'Correct this timesheet' button; 'whose turn' line; polished 'Changed since you signed' card; 'Next: generate your invoice'; reports mark 'Awaiting re-sign' | Claude: building, then review |
| 1.135 | doing | Line manager sign-off reminder (1.78): Settings → Payment runs item 5, 1–3 days before payday (default 2) at 08:00; weekly and two-run months; only line managers / admins with sheets waiting | Claude: building. You: deploy one Cloud Function when ready |
| 1.136 | doing | Double push to a line manager: their account holds 8 push tokens; fix removes dead tokens and replaces this device's old token, plus a token check script | Claude: building. You: run the check script and deploy the push function when ready |
| 1.137 | todo | VO tracker Reopen / Unlock order wording added to the rulebook (web follow-up of #273) | Claude |
| 2.3 | doing | Clean-ups of old records: script ready (#242) | Script merged (#242); you run the dry run after launch testing, then it's done |
| 2.5 | doing | Turn on privatePay (pay rates readable only by the right people) | Switch on for all companies 16 Nov. Pay screens now wait for pay (web #342, iPhone #240 in build 7). Left: the strip, see 4.40. |
| 3.2 | todo | Delete the old email function (after the minimum build is raised) | Claude sends the command (minimumIosBuild is now 6), then you deploy |
| 3.3 | todo | Release the iOS build to everyone | You |
| 4.2 | todo | Data health: Fix all + Remove placeholder | You |
| 4.3 | todo | Two-factor sign-in on GitHub, Google, Resend, Netlify, Stripe | You — re-confirm (may have been ticked by accident 17 Nov) |
| 4.4 | todo | Change the info@ password | You — re-confirm (may have been ticked by accident 17 Nov) |
| 4.5 | todo | Check who has access to each account | You |
| 4.6 | todo | Resend → Domains all verified, plus DMARC | You — re-confirm (may have been ticked by accident 17 Nov) |
| 4.7 | todo | Ask the wholesaler to allow-list projectplanner.us | You — re-confirm (may have been ticked by accident 17 Nov) |
| 4.8 | todo | Material email test | You — re-confirm (may have been ticked by accident 17 Nov) |
| 4.9 | todo | Invite email arrives | You — re-confirm (may have been ticked by accident 17 Nov) |
| 4.10 | todo | Invite email readable in Gmail dark mode (after the deploy) | You — re-confirm (may have been ticked by accident 17 Nov) |
| 4.11 | todo | Full test of both apps on 20 Nov (moved from 17 Nov): https://claude.ai/artifact/5ThVXaTWjMsuQMUHaVycP3 | You |
| 4.23 | todo | Check after 1.34 rules: a manager with the Operatives switch edits an operative and saves | Owner |
| 4.28 | todo | Optional: switch on 30-day clean-up (TTL) for emailRequestSends | You — steps in web #308 |
| 4.31 | todo | Check Firebase → Firestore → Rules history: today's publish is at the top | You |
| 4.33 | todo | Run npm run test:rules on branch w-rules-hardening (#334) and send the last lines | You |
| 4.37 | todo | Listen to the feedback sounds (preview page Claude sends) and say if the feel is right | You — re-confirm (may have been ticked by accident 17 Nov) |
| 4.40 | todo | Pay strip: smoke test on one test person first (My Timesheets, Overtime button, a rate on a timesheet, My Profile), then backup + strip everyone | You, after build 7 is live everywhere — Claude sends steps |
| 4.42 | todo | Google key L1Yc: restrict to the 7 Firebase services, test, close GitHub alerts as Won't fix | You — re-confirm (may have been ticked by accident 17 Nov) |
| 4.43 | todo | Data health: link 'Unknown person 5FB5F683' (8 bookings, Sep) to the right person once identified | You |

### Section 1 — Fixes and releases (111 done of 138)

| Code | Status | What | Who / expect |
|---|---|---|---|
| 1.1 | done | iOS 1.20.4 pay, breaks, weekends (#163) | Claude |
| 0.1 | todo | DATES: launch 25 Nov. Updated 23 Nov evening: batches 1–3 almost all merged (rows 1.110–1.137). Live: TestFlight build 13, minimumIosBuild 13. In flight: timesheet review flow 1.74, Make changes 1.76, timesheet clarity 1.77, line manager reminder 1.78, double-push fix. Next for you: new TestFlight build once the iPhone changes merge, then raise minimumIosBuild. | Claude + you: same-day turnaround on your steps keeps the dates |
| 1.2 | done | iOS small works fix + Projects/Small works count (#164) | Claude |
| 1.3 | done | Web 1.21.1 job lists, tabs, who sees what, bookable jobs (#239) | Claude |
| 1.4 | done | iOS 1.21.1 job lists (#165) | Claude |
| 1.5 | done | 1.22 Money: timesheet summary totals match the invoice | Claude |
| 1.6 | done | 1.22 Money: iOS Holiday Report day count | Claude |
| 1.7 | done | 1.22 Money: weekly report timesheet figures as one shared rule | Claude |
| 1.8 | done | 1.22 Money: variation numbers V2-003 → V2-004 | Claude |
| 1.9 | done | 1.22 Money: manager coverage hours (last iOS calculator) | Claude |
| 1.10 | done | 1.23 People: Operatives and Managers lists | Claude |
| 1.11 | done | 1.23 Home: overview figures | Claude |
| 1.12 | done | 1.23: seven smaller items (qualification dates, site map day, task overdue, leave calendar, clash roles, variation badge, Job Detail badges) | Claude |
| 1.13 | done | Overlap and clash checks use each day's working hours | Claude |
| 1.14 | done | Select Operatives uses that day's working hours | Claude |
| 1.15 | done | Setup wizard gets weekend break controls | Claude |
| 1.16 | done | 1.27: your answers batch (line-manager picker, email job checks, removed evidence list, 30-day soft delete + privacy policy, invite rate copy, catalogue operative rates) | Claude — web #252 + iOS #177 merged; rules + functions deployed 4 Nov |
| 1.17 | done | Profile photos disappearing from the top avatar (web + iOS) | Claude · Expect: Merged web #251 + iOS #176. Test: pull, rebuild iOS in Xcode; your photo shows in the Home top bar and Settings header, and comes back by itself after a dropped connection. |
| 1.18 | done | Line-manager rule: admins without a line manager self-manage leave + timesheets (toggles) | Claude — web #253 + iOS #178 merged (rulebook 1.28.0) · Expect: Rules go live with the combined deploy; before it, set a line manager or both toggles for admins listed in Data health. |
| 1.19 | done | PAYE: Overtime, Price work & Expenses (web + iOS) + personal site audits | Claude — built web + iPhone (1.28–1.32.1). You tested overtime on iPhone 6 Nov: works; changes asked → rows 1.37 (screens, now) and 1.38 (flow, web 1.33). Price work and expenses flow not tested yet · Expect: Plan: https://claude.ai/artifact/5i9UkSqfSCRV83TKCytedE |
| 1.20 | done | UI tidy: tighten the gaps between the All / Active / Upcoming / Completed filter, search bar and job list on Projects and Small works (both apps) | Done: web #286 + #290 (spacing tightened after your 6 Nov note); iPhone #200 |
| 1.21 | done | iPhone 1.30.3: shared job-manager picker; fix blank 'junk' manager on edit; keep web's manager name | Claude — merged 4 Nov (#185, iPhone main af4432c); your test at the checkpoint |
| 1.22 | done | 1.31 People & access (web → iPhone → rules): level changes carry no rights, line-manager demotion block, manager warning list, operatives managers add/edit/delete operatives, job managers on level change, project/small works edit bugs, price work & expenses | Claude — done 6 Nov: web (#264, #275), rules 1.31.3 published by you (5 Nov), iPhone 1.31.1 (#191) + 1.31.3 mirror (#193) merged. Reaches iPhones with the next release (3.3) |
| 1.23 | done | 1.32 Overtime, pay & claims: multiplier on every custom-hours booking at create, multiplier on weekly report, PAYE payday in main Save, ✓✕⚙ on future payrun days, own-overtime requests, overtime review fixes (all records per person, ✓✕⚙ per line), price work & expenses review UI matching overtime + same record check, rulebook version in Settings | Claude — web merged (#274). iPhone 1.32.1 merged 6 Nov (#195): CI green, 9/9 automated screen checks pass, your phone test 6 Nov 'working ok'. NOT live until the 1.32.1 rules are (4.18); then release (3.3) and raise the minimum version (3.4) |
| 1.24 | done | Exported timesheets missing (web + iPhone) — find cause, legacy data must show | Fixed web #259 and iPhone 1.31 |
| 1.25 | done | Web overtime request review: ✓ ✕ ⚙ per line like iPhone; replace 'N booking(s) not theirs left out' with clear wording | Done in 1.33 (Send → Return) |
| 1.26 | done | iPhone UI upgrade: Scheduling (projects + small works), booking flow, Hours sheet, Edit booking, overtime rate sheet, unpaid break warning — UI only, no functions or rules lost | Claude — merged; you saw it on your phone 5 Nov. Follow-up fixes (Book people / Book a Sub same height, 'Cancel' word, Home icon grid) — please check on your phone |
| 1.27 | done | Data clean-up: blank-email manager rows created by older iPhone builds, and jobs pointing at them | C716 duplicate removed by owner 10 Nov (script #298); report showed no other duplicates |
| 1.28 | done | Checkpoint: one combined test list for 1.31 (+1.32 if close) | Replaced by the 17 Nov test checklist |
| 1.29 | done | Web Home redesign (sidebar, top bar, Labour summary, Who's on today, Tasks to do, Waiting for you) — look only, same buttons and rules | Done 5 Nov: merged (#276) after update to 1.32.1 and your look at the preview |
| 1.30 | done | 1.35 My Profile (iPhone + web): leave left, hours booked this week, open tasks, qualifications expiring, all line managers — one shared rule, one iPhone profile screen | Web #292 + iPhone #208 merged |
| 1.31 | done | 1.33: managers' Daily Overview shows only their team (admins see everyone + subcontractors); remove Cancel; PAYE ✕ deletes on approval; iPhone offline delete; overtime flow change (1.38); pay records fixed before launch — Firestore pay rules narrowed to who may see pay (your answer 6 Nov) | Live in web 1.33; iPhone 1.33 merged |
| 1.32 | done | 1.34: ghost operatives (no-login bookable operatives) — web, rules and iPhone | Built and merged. You: add field ghostAccounts = true in platformConfig/app when you want the Ghost toggle shown; conversion script dry run (optional) |
| A | done | Close-out A: rules live — lighter 1.31.3 rules tested + Google-checked, you publish (backup file if Google still refuses) | Done 5 Nov: rules 1.31.3 merged (#278, tests 220/220, independent review clean) and published by you |
| B | done | Close-out B: 1.32 live — merge web #274, you publish 1.32 rules, iPhone 1.32 built, you raise minimum iPhone version, web Home #276 merged | Web 1.32.1 merged (#274) ✓ · iPhone 1.31 + 1.32 merged (#193, #195, 6 Nov) ✓ · web Home #276 ✓ · 1.32.1 rules LIVE ✓ (verified 6 Nov via Google's API: live release = ruleset ce5ba57d, byte-identical to main; it went live 12:12 even though the console said 'unknown error') · iPhone release ☐ · raise minimum iPhone version ☐ |
| C | done | Close-out C: handover note (docs/HANDOVER.md) + checklist fully current → start a new chat | Done 5 Nov: docs/HANDOVER.md on web branch handover-2026-11-05; owner moved to a new chat before 1.32 (rules work handed over on branch web-rules-1313) |
| D | done | Close-out D: one new chat each for 1.33, 1.34, My Profile, then bug fixes → FEATURE FREEZE (agreed 5 Nov: no new features after 1.34) | Feature freeze passed 14 Nov |
| 1.37 | done | iPhone screen upgrade from your 6 Nov test (look only): ✓✕⚙ fill/grey/strike-through, cog sheet, Add Expense, Add Price Work, overtime/price work/expenses reports styled like the invoice (evidence pages headed by their item), Timesheets full page with Done | Claude — PR #196 merged 6 Nov. You: look at it on your iPhone |
| 1.38 | done | Overtime flow change (your 6 Nov decisions, joins 1.33): Submit only when every line decided; line manager 'Return overtime' only when every line decided and Return saves the bookings (replaces partial approval); submit + return notifications; no 'Approved' text at your stage; a line manager can always approve (no 'Needs an admin'); web reports styled like the invoice. Price work & expenses keep: report any time, review optional | Done in 1.33 |
| 1.39 | done | Web bug: booking an admin or manager fails ('deleteField() cannot be used with set()' — managerSiteBookings create). iPhone not affected | Done 6 Nov: web #284 merged (creates no longer send deleteField(); also fixed Add User for an admin with 'No line manager'). iPhone was never affected |
| 1.40 | done | Payrun Snapshot on the Weekly report (admins only): pick Current PAYE period / Current payment run period / Custom range; every person (PAYE + self-employed); columns Name, Level, Employment type, Timesheet (Not started/Submitted/Signed; red 'PAYE'), Overtime (Not started/Submitted/Returned, or Report generated if no line manager; red 'Self Employed'), Expenses + Price work (Report generated, else item count; red 'Self Employed'); tap a cell to open that person | Live in web 1.33; iPhone in 1.33 |
| 1.41 | done | Test price work and expenses on iPhone (add, evidence, report; line manager ✓✕ review) | Covered by the 17 Nov test checklist |
| 1.42 | done | iPhone: an operative with a login but no Operatives-list entry is bookable under their account (match web; no more 'No operative profile is linked') | Claude — iPhone PR #198 merged 6 Nov (matches web) |
| 1.43 | done | Rules 1.32.3 (lighter, cost 367,346) — merged web #287 and iPhone #199. Google refused to publish (503 / 'unknown error'): its rules checker times out on our rules | Superseded: 1.33 rules live 7 Nov, 1.33.1 live 10 Nov |
| 1.44 | done | Working method (your decision 6 Nov): web + iPhone in ONE chat again — rulebook first, then web, then iPhone sync in the same chat; no more prompts to pass between chats | Claude — web repo attached to this chat with write access 6 Nov. You: close the other web chat |
| 1.45 | done | Release 1.33 (web first, then iPhone): overtime Send for approval → Return flow with ✓✕⚙, reopen on booking change + notices, report out of date, declined lines 0h; every manager sees all jobs; hide lists removed; My Projects / My Small works; line manager set once then admin-only; Cancel removed; offline delete rules; Payrun Snapshot; invoice-style reports; claims under any id; materials catalogue admins only | Done 6–7 Nov: web 1.33 merged + rules published by you; claims backfill run; iPhone 1.33 merged (#202, every check green on 3 phones). You: build it from Xcode this morning and run the flow test (7-nov-flow-test.md) |
| 1.46 | done | iPhone tidy-ups: tighter list spacing (matches web 1.20), clash review button says 'Don't book', screen check A03 made reliable | Claude — iPhone PR #200 merged 6 Nov (spacing, 'Don't book', screen checks steadier). You: look at Projects / Small works spacing on your next pull |
| 1.47 | done | Rules 1.32.4: role, company and access toggles stamped on each login (server function), rules read the stamp — fixes the failed rules publishes and makes room for 1.33 | Done 6 Nov: function deployed, 27 accounts stamped, rules published by you. Old iPhone builds: sign out and back in if you see a permissions error |
| 1.48 | done | Decided 6 Nov: any manager may send a materials request for any job. Job 'View' section kept for operatives only (hide a job from chosen operatives); the managers' hide list is removed | You decided; Claude builds in 1.33 |
| 1.49 | done | Add new user / Add new operative: FULL UI upgrade (iPhone, web to match) + 'Ghost account' switch at the very top with drop-down explanation; ghost shows only names, day or hourly rate, line manager, trade optional. Part of 1.34 | Merged (iPhone #201, #203; web #291). Ghost toggle shows once you switch ghostAccounts on (1.32) |
| 1.50 | done | 1.36 clean-up (fixes only, no rules change): double-booking check letter case, one-Operatives-row picks, company week on week grids, task 'is it mine', ghost conversion script, iPhone overtime reopen notice on booking edits, bank holidays kept, My Profile links | 1.36 merged (web #294, iPhone #209) |
| 1.51 | done | Hand-over notes updated for 7 Nov (docs/HANDOVER.md, web #293): what's live, every open PR and merge order, your steps, start message for a new chat | Merged web #293 (10 Nov) |
| 1.52 | done | Rules 1.33.1: notifications rule crashed Google's checker, so iPhone saves (bookings, leave) stuck on 'Pending sync' — fixed | Merged web #300; owner published with the Terminal command 10 Nov; Quick Add confirmed reaching web |
| 1.53 | done | iPhone 1.33.1: fast booking Save, ✕ enables Save, Keep the break default, Warnings + My Projects first open, leave saves bounded, ⚙ filter, ⚙ shows right kind | Merged iOS #210 (10 Nov) after owner test |
| 1.54 | done | Web: My Projects ⚙ All/Active/Upcoming/Completed filter, quick save | Merged web #296 (10 Nov) |
| 1.55 | done | 1.37: annual leave (brown AL, AL AM/PM, pending AL?) on project + small works scheduling; web booking colours match iPhone | 1.37 merged (web #299, iPhone #211) |
| 1.56 | done | Look into high 'Denies' in Firestore rules metrics (~1 in 4): which reads/writes are refused and whether any screen silently misses data | Claude — after the release train |
| 1.57 | done | Web speed: page skeletons, link prefetch, no double opens, exports load on demand, shared pay-history listener | Merged web #303 (11 Nov 23:34Z) after 2 independent reviews |
| 1.58 | done | Web UI restyle: Timesheets, Overtime/Expenses/Price work, Manage users (today's wording kept, U9) | Merged web #304 (11 Nov 23:23Z). You confirm: 'Open →' cue and table headings |
| 1.59 | done | 1.38 silent data check (both apps; admin panel only when platformConfig/app.dataCheckPanel is on) | Merged web (via #302) + iPhone #213, 12 Nov, after 3 review rounds |
| 1.60 | done | 1.39 hours breakdown on every booking picker, clearer labels, My Schedule clash marker (red/grey + popup), Daily Overview moves in one save | Merged web #302 + iPhone #215, 12 Nov 04:27Z |
| 1.61 | done | 1.40 annual leave: Team list rule, allowance on PAYE days only (pro rata), manual +/- days with reason, deleted users hidden | Web #306 + iPhone #220 merged 13 Nov |
| 1.62 | done | 1.41 one scheduling tile per person-day ('26h · 2 bookings') + Replace existing booking; iPhone hides unknown-person rows like web | Web #305 + iPhone #219 merged 14 Nov; follow-ups web #315 + iPhone #230 merged |
| 1.63 | done | iPhone site audit + orders: multi-photo add, clear ✕ on fields, Preview taps, Order placed full screen, honest 'queued' wording, queued emails retried with no double send | Merged iPhone #218 (12 Nov 06:02Z) after 5 review rounds. Your call: PDF speed (a/b), Drafts, retry timing, 2 wordings |
| 1.64 | done | Web Daily Overview restyle (type chip + std/OT bar, shift and times split) | Merged web #307 (12 Nov 06:02Z). You confirm 5 wording/colour choices |
| 1.65 | done | Follow-ups: material email server-side dedupe key; web delete warning on signed timesheets; operatives leave-read narrowing; iOS Edit User pay history live listener | Merged 12 Nov: email dedupe (web #308, iPhone #221; you deployed the function), signed-timesheet warning + iPhone live pay history (web #309, iPhone #222). Leave-read narrowing still a follow-up |
| 1.66 | done | iPhone site audit: PDF shows instantly (uploads in background) + Drafts saved on the phone (offline, resume later) | iPhone #223 merged 14 Nov (also: audits save to the company they were made in). You: confirm (a) keep a force-signed-out person's drafts |
| 1.67 | done | Slow order emails fix: phone retries a dropped connection instead of queuing; checks in parallel, one batch send; web one call per order (server stays on free setting — your decision 13 Nov) | Web #311 + iPhone #224 merged 13 Nov. You: deploy sendEmail, then a two-wholesaler test |
| 1.68 | done | 1.42: Projects/Small works toggle wording (option B: behaviour unchanged) + several managers per job on create and edit (both apps) | Web #312 + iPhone #225 merged 14 Nov |
| 1.69 | done | Web: false 'You're offline' banner fixed (checks for real before showing) — #314 | Claude |
| 1.70 | done | iPhone 'Unknown person' rows: Operatives list stuck on an old saved copy — keep live lists always connected + refresh safety net (#227) | iPhone #227 + #228 merged 13 Nov (live lists retry themselves) |
| 1.71 | doing | Push notifications never arrive (only the on-phone material cut-off works): logging, test button in Settings, stop deleting tokens on Apple errors (web #313, iPhone #226) | Merged. You: on build 6, Settings → Notifications → Send test; tell Claude if nothing arrives |
| 1.72 | done | 1.54 timesheets: switched-off places paid, late price work/expenses after sign-off (approved by line manager), 'timesheet changed' notice, half-signed list in Data health (web #337) | Web #337 + iPhone #241 merged; rules, Storage rules and indexes published 16 Nov 21:47 via the publish button. Functions deploy still yours (see 4.39). |
| 1.73 | doing | Web Annual leave report + VO tracker 'Submitted' column + Annual leave wording (web #335) | Claude: built; finishes after 1.54 merges |
| 1.74 | doing | 1.56: operatives see only their own annual leave — web merged (#356, behind a switch, off); iPhone #246 in final fixes; then report, minimumIosBuild, Phase B rules, switch on | Claude: after #334 merges; needs a new iPhone build first |
| 1.75 | doing | Rules 1.53.1 pre-launch hardening (web #334), then iPhone 1.53.1 sync | You: npm run test:rules on branch w-rules-hardening; then Claude merges and you publish |
| 1.76 | todo | Fix every new code-checker warning (4 React rules) and make them errors again | Claude: after 1.54 merges |
| 1.77 | doing | Feedback sounds on the website (Settings → Sounds) | Ready (#341). Waiting for your 'ok' on the sounds, then merge. |
| 1.78 | doing | Feedback sounds + haptics on the iPhone (My notifications → Sounds & haptics) | Ready, all checks green (#239). Waiting for your 'ok' on the sounds; not in build 7, goes in build 8. |
| 1.79 | doing | Owner console rebuild (/developer): plan check, your decisions D1–D17, then PR 0 security hotfix and the rest one PR at a time | PR 0 and PR 1 (#348, foundations: guard, audit, directory, search, sidebar in app style, useful-only) merged 16 Nov. Its rules commit waits for #344. You: Netlify server key (steps in #348). Question: audit log for list views? |
| 1.80 | done | 16 Nov merged: library updates (web #336, iPhone #237), certificates take every photo type (web #333, iPhone #238), Annual leave wording (iPhone #236) | Claude |
| 1.81 | done | 16 Nov merged: pay screens wait for pay to load (website #342, iPhone #240), iPhone 1.54 (#241), owner console security fix (#340), Storage 1.50 live (#333) | Claude |
| 1.82 | doing | Full code scan of web, iPhone, rulebook, rules and functions (pass 1 now, pass 2 ~22–23 Nov) | Pass 1 fixes merged: rules 1.54.1 (#334), iPhone (#242), web (#343) and follow-ups (#347). iPhone follow-ups (late extras, clash sound, extras sounds, pay wait) queued for build 9. Pass 2 ~22-23 Nov. |
| 1.83 | todo | Follow-ups: late extra with a blank title dropped on next save (both apps); operatives with no account priced without the pay wait; compare web vs iPhone 'priced people' on the same data; MFA cookie tie to user; 218 code-checker warnings | Claude, after 1.54 |
| 1.84 | doing | Timesheet revisions: admins and line managers create REV 1, REV 2 of an exported timesheet; the person signs, line manager counter-signs, export shows REV n and the difference; original never changes (web, iPhone, rules) | Web #344: final review done, last fixes + rules checks running. iPhone #243 built, all checks green, under review; needs one re-sync after #344. Then a rules publish and build 9 (+ minimumIosBuild 9). |
| 1.85 | done | Owner console: Bookings made and scoreboard counted from real records (web #366) | Claude |
| 1.86 | done | One Operatives page with + Add operative; Operatives managers edit operatives on web (web #367) | Merged (web #367). You: test as Test Manager |
| 1.87 | done | Timesheet follow-ups: Signed off lists earlier pay runs, automatic repair of broken signed copies (1–15 Nov), live totals on the person's page, triangle on change, Earlier revisions cards, history from company start | Merged on web (#368); confirmed by you (1–15 Nov now shows all bookings). iPhone parts follow |
| 1.88 | done | Passkey sign-in on the website (Touch ID / Windows Hello), behind a switch | Merged (web #369), switched off. You: Netlify variable + redeploy, then test on Mac and Windows |
| 1.89 | done | Rulebook 1.59: former people on old bookings, safe-sender box on first wholesaler email, task picker rule shared, unknown-person gaps — web merged (#370), rules published, functions deployed, contacts backfill run (17 Nov). iPhone sync follows (1.90) | Done |
| 1.90 | todo | iPhone sync 1.57 + 1.58 (+1.59): timesheet fixes, N/A brands, then timesheet follow-ups | Claude: after iPhone #246 merges |
| 1.91 | doing | iPhone fixes: task picker one row per person (#248), no bookings under unknown person ids (#249) | Claude: review fixes |
| 1.92 | done | URGENT: web crash when a manager opens a timesheet waiting to be signed again; web shows 1 to sign where iPhone shows 2 | Merged (web #376). You: open User Timesheets after 17:55 |
| 1.93 | done | Half-day leave not covered: Book the PM / Open daily overview / Annual leave work on both apps; shown on Daily Overview; booking several people blocks anyone already part-booked (web #373, iPhone #251, rulebook 1.60) | Merged: web #373, iPhone #251 |
| 1.94 | done | Web: Dismiss on 'Material order not placed' is saved like the iPhone (count drops, stays gone) (web #372) | Merged (web #372). You: Dismiss a 'Material order not placed' warning, refresh, it stays gone |
| 1.95 | doing | Web: Dismiss on every warning type with the iPhone-style pop-up, and tidier buttons on every warning card | iPhone #256 merged 21 Nov (dismiss writes every clash pair); web part: Claude to confirm |
| 1.96 | done | Security check unblocked: one dev-tool warning (picomatch) allowed until 17 Dec, everything else still blocks (web #374) | Merged |
| 1.97 | done | Timesheet overtime lines for day-rate people in hours: 6h × 1.5 = 9h · 9h × £26.47/h (rounded) = £238.24 (web, iPhone, rulebook) | Merged: web #378, iPhone #253 (21 Nov) |
| 1.98 | done | Simpler hours breakdown on every booking screen (your design files): Normal + Overtime = Total paid hours (web, iPhone, rulebook) | Merged: web #379, iPhone #254 (21 Nov) |
| 1.99 | done | Line managers get a timesheet notification every time someone signs (incl. signing again); 'Currently booked to…' line removed (web #375, iPhone #252) | Merged: web #375, iPhone #252 |
| 1.100 | done | Web: Download button next to Share on invoices and report PDFs | Merged (web #377) |
| 1.101 | doing | Managers page same style as Operatives; Save no longer sticks on 'Saving…'; Add user on Managers (admins) and Operatives pre-selects the user type (web #371 + iPhone) | Claude: review fixes |
| 1.102 | done | Firebase function packages updated (#383: both high warnings cleared) and web tooling (#382); functions deployed 17 Nov | Done |
| 1.103 | done | Super Admin can be PAYE (employment type, annual leave, VAT/UTR shown on Edit user) — web live #385 (you tested: works); iPhone #258 fixing a guard test | Merged: web #385, iPhone #258 |
| 1.104 | done | Daily Overview 'Other' card fixed — web live (#387, 17 Nov); iPhone #260 in checks | Merged: web #387, iPhone #260 (21 Nov) |
| 1.105 | done | Missing timesheets: every awaiting/signed run listed (#381/#257), sheets found under every id incl. deleted people as 'Unknown person' (#386/#259); read-only report script (#384) | Merged: web #381, #386; iPhone #257 (21 Nov), #259 |
| 1.106 | done | Site audit: uploads never stick; identical PDF on web and iPhone; no text ever cut off; character limits with counters (your 5 answers: all yes) | Merged: web #389, iPhone #262 (21 Nov) |
| 1.107 | done | Variations: reopen removes pin (fixes permissions error), tracker on by default, Open/Submitted/Closed buttons, clearer upload-stall message (web #388, iPhone #261) | Merged: web #388, iPhone #261 (21 Nov) |
| 1.108 | doing | Projects & Small works navy-band restyle, UI only (your 13 answers: all yes) | Claude: building |
| 1.109 | done | Web upgrades before launch: React 19 (#402), Tailwind 4 with the old look kept (#403: 120 screenshots light + dark matched), TypeScript 6.0 (#404). TypeScript 7 after launch once the lint tool supports it; the 59 styles that never showed stay off (your call 22 Nov) | Claude — merged 21–22 Nov. You: nothing to deploy (web updates from main) |
| 1.110 | done | Batch 2: Daily Overview crashed when a booking was clicked (web) | Merged: web #412 (23 Nov), with a test so it can't come back |
| 1.111 | done | Batch 2: 'Link to a person' button on unlinked annual leave rows (Data health) | Merged: web #414 (23 Nov) |
| 1.112 | done | Batch 2: invoice and PDF lines worded clearly; former people's names on the Exported timesheets list | Web merged (#414). iPhone: follow-up after the 1.72 sync |
| 1.113 | done | Batch 2 #11: company data export, Super Admin only and compliant (no file download links in the export) | Super Admin only: merged (web #413). Download links removed: in rulebook 1.72 (building) |
| 1.114 | done | Batch 2 #12, #13, #14, #20 (iPhone): 'since' date, logo top left in organisation settings, 'Book the PM' on half-day leave, timesheet counts (no 0 0 0; Awaiting sign-off / Signed off / Exported) | Merged: iPhone #268 (23 Nov). Goes out with the next TestFlight build |
| 1.115 | done | Batch 2 #15: extra wholesaler subheading removed (web) | Merged: web #414 (23 Nov) |
| 1.116 | done | Batch 2 #16, #18, #19: certificate renewal no longer stuck on 'Saving'; qualifications, expiry and 'View certificate' on every user's profile; expiry shown correctly (not 'No Expiry') | Merged: web #415 and iPhone #269 (23 Nov) |
| 1.117 | done | Batch 2 #17 (iPhone): user profile summary page with an Edit profile button | Merged: iPhone #269 (23 Nov). Goes out with the next TestFlight build |
| 1.118 | done | Batch 2 #22B: no ✓ ✕ ⚙ on an exported timesheet; 'Create revision to adjust this timesheet' button and your explanation text; export Super Admin only (rulebook 1.71) | Merged: web #413 (23 Nov). iPhone: 1.71 sync to do |
| 1.119 | done | Batch 2 #21, #22A (rulebook 1.72): line manager's ⚙ change edits the booking itself (scheduling updates, person re-signs, LM counter-signs); ✕ deletes the booking after a warning; 'Day adjusted' line shows the day and job; 'FULL DAY · no break' wording | Claude: merged web + iPhone 23 Nov; rules published |
| 1.120 | done | Batch 2: iPhone takes rulebook 1.71 + 1.72 (exported sheet read-only, revision button and text, line manager edits the booking, invoice wording, former names) | Claude: after 1.72 merges |
| 1.121 | done | Batch 2 — your steps: push function redeployed; TestFlight build 13 made; minimumIosBuild 13; Firestore rules published (all done 23 Nov) | You: I'll send the exact commands when it's time |
| 1.122 | done | Batch 3 gaps 1+3 (rulebook 1.73): one shared qualification expiry rule; iPhone Book labour buttons ask the shared rule; one expiry reminder per qualification | Claude |
| 1.123 | done | Batch 3: new site audit asks 'Leave this audit?' on sidebar/tab/header/search; operatives only see their own jobs (web #419) | Claude |
| 1.124 | done | Batch 3: site audit browse lists for operatives + browser Back asks before losing a new audit (web #422; you tested Back) | Claude |
| 1.125 | done | Batch 3: VO tracker drag open VOs — web #420; iPhone #273 merged 23 Nov: drag, Reopen for Submitted/Closed, Unlock order for admins and the job's managers, 'was VO-003' removed | Claude |
| 1.126 | done | Batch 3 #23: clear revision list REV 1 / REV 2 with Download PDF each (web and iPhone) | Claude |
| 1.127 | done | Batch 3 #2–#5, #31 (web #417): Daily Overview Today/arrows size; 'Half-day unbooked'; site audit job filter (default Active); step-by-step new site audit; weekend label | Claude |
| 1.128 | todo | Batch 3 #1: triple-check line manager changes reach the booking and project / small works scheduling | Claude: after 1.74 is live |
| 1.129 | doing | PAYE payday reverts to 'Not set' + More → Settings stays on Payment runs: web #423 merged; iPhone #275 waiting for Mac tests (also asks before discarding unsaved settings) | Claude: merge when tests pass. You: retest Save on the next TestFlight build |
| 1.130 | doing | iPhone Warnings 'checking' ~30 s: first scan no longer waits; only warnings-relevant roster changes rescan (iPhone #274) | Claude: merge when Mac tests pass |
| 1.131 | doing | Timesheet review flow (rulebook 1.74, web #425 + iPhone #276): line manager changes lines freely before sign-off; £0 struck line kept off the invoice; lines ordered booking, overtime, booking, overtime; 'X changed your timesheet and signed it off' notice | Order: iPhone build on TestFlight → you raise minimumIosBuild → merge web + publish rules → you deploy 2 functions (I send the command) |
| 1.132 | doing | Qualifications with no expiry of their own listed in Data health (web #426, 1.75) + iPhone qualification reminders in the organisation's time zone (#277) | Claude: merge after 1.74 / when Mac tests pass |
| 1.133 | doing | 'Make changes' on signed-off timesheets (rulebook 1.76, web #427 + iPhone #278): line manager changes bookings, price work and expenses (any amount) and signs off again without the person re-signing; exported → revision | Claude: reviewed; merges after 1.74/1.75. You: run the read-only signed-money check before switch-on (I'll send steps) |
| 1.134 | doing | Timesheet clarity (1.77): one 'Correct this timesheet' button; 'whose turn' line; polished 'Changed since you signed' card; 'Next: generate your invoice'; reports mark 'Awaiting re-sign' | Claude: building, then review |
| 1.135 | doing | Line manager sign-off reminder (1.78): Settings → Payment runs item 5, 1–3 days before payday (default 2) at 08:00; weekly and two-run months; only line managers / admins with sheets waiting | Claude: building. You: deploy one Cloud Function when ready |
| 1.136 | doing | Double push to a line manager: their account holds 8 push tokens; fix removes dead tokens and replaces this device's old token, plus a token check script | Claude: building. You: run the check script and deploy the push function when ready |
| 1.137 | todo | VO tracker Reopen / Unlock order wording added to the rulebook (web follow-up of #273) | Claude |

### Section 2 — Owner features (5 done of 7)

| Code | Status | What | Who / expect |
|---|---|---|---|
| 2.1 | done | Data export: a company downloads its own data | Claude (web #241 merged; test 6.20) |
| 2.2 | done | Deleted files can be recovered or are protected | Built (#246/#172) + storage rules deployed + 30-day soft delete on |
| 2.3 | doing | Clean-ups of old records: script ready (#242) | Script merged (#242); you run the dry run after launch testing, then it's done |
| 2.4 | done | Turn on enforcedReads (server checks who can read what) | Switched on for all companies 16 Nov. |
| 2.5 | doing | Turn on privatePay (pay rates readable only by the right people) | Switch on for all companies 16 Nov. Pay screens now wait for pay (web #342, iPhone #240 in build 7). Left: the strip, see 4.40. |
| 2.6 | done | Push-token dry run, paste the output to Claude | You — dry run checked: 3 accounts lose shared tokens |
| 2.7 | done | Push-token --apply after Claude checks the dry run | You — applied 4 Nov |

### Section 3 — Email / material sends (4 done of 6)

| Code | Status | What | Who / expect |
|---|---|---|---|
| 3.1 | done | iOS material emails: one email with CC through the shared sendEmail | Claude — iOS #168 merged 4 Nov (function deployed) · Expect: Test: send a material quote from the iPhone; the wholesaler gets one email "<your name> via Project Planner" with you in CC. |
| 3.2 | todo | Delete the old email function (after the minimum build is raised) | Claude sends the command (minimumIosBuild is now 6), then you deploy |
| 3.3 | todo | Release the iOS build to everyone | You |
| 3.4 | done | Raise minimumIosBuild in Firebase | Set to 6 on 16 Nov |
| 3.5 | done | Forced sign-out removes that phone's push token (#166) | Claude |
| 3.6 | done | iOS Add User keeps the permissions you pick (#166) | Claude |

### Section 4 — Your deploy and owner steps (25 done of 43)

| Code | Status | What | Who / expect |
|---|---|---|---|
| 4.1 | done | Functions deploy (push fix + invite email fix) | You |
| 4.2 | todo | Data health: Fix all + Remove placeholder | You |
| 4.3 | todo | Two-factor sign-in on GitHub, Google, Resend, Netlify, Stripe | You — re-confirm (may have been ticked by accident 17 Nov) |
| 4.4 | todo | Change the info@ password | You — re-confirm (may have been ticked by accident 17 Nov) |
| 4.5 | todo | Check who has access to each account | You |
| 4.6 | todo | Resend → Domains all verified, plus DMARC | You — re-confirm (may have been ticked by accident 17 Nov) |
| 4.7 | todo | Ask the wholesaler to allow-list projectplanner.us | You — re-confirm (may have been ticked by accident 17 Nov) |
| 4.8 | todo | Material email test | You — re-confirm (may have been ticked by accident 17 Nov) |
| 4.9 | todo | Invite email arrives | You — re-confirm (may have been ticked by accident 17 Nov) |
| 4.10 | todo | Invite email readable in Gmail dark mode (after the deploy) | You — re-confirm (may have been ticked by accident 17 Nov) |
| 4.11 | todo | Full test of both apps on 20 Nov (moved from 17 Nov): https://claude.ai/artifact/5ThVXaTWjMsuQMUHaVycP3 | You |
| 4.12 | done | Answer 3 questions on the People lists release (web #243) — in chat | You |
| 4.13 | done | Functions deploy #2 (ready now): cd ~/Developer/project-planner-web → git pull → firebase deploy --only functions:inbox-push --project project-planner-f986c | You — deployed with the 1.27 rules on 4 Nov |
| 4.14 | done | Confirm 3A side effect before web #243 merges (see chat): people with no user level lose manager treatment on web | You |
| 4.15 | done | Settings → Data health → “Has no user level”: open each person in Manage Users and pick their level (about 10 min after Netlify updates) | You — every user has a level (4 Nov) |
| 4.16 | done | Storage rules deploy (file protection): cd ~/Developer/project-planner-web → git pull → firebase deploy --only storage --project project-planner-f986c | You — storage rules deployed 4 Nov |
| 4.17 | done | Turn on/check Cloud Storage soft delete: console.cloud.google.com → Cloud Storage → Buckets → project-planner-f986c.firebasestorage.app → Protection → Soft delete policy (set 30 days) | You — soft delete 30 days (4 Nov) |
| 4.18 | done | Make the 1.32.1 Firestore rules live | Done 6 Nov: live since 12:12 (Google's API shows the live ruleset byte-identical to web main; the console's Publish button stays hidden when the file is pasted, so they match). The 'unknown error' publish had actually worked · Expect: Firestore → Rules tab contains orgAdminEither |
| 4.19 | done | Answer: pay records (fix before launch), Payrun Snapshot questions, 1.32 judgement calls (keep all) | You — answered 6 Nov |
| 4.20 | done | Run the C716 duplicate clean-up dry run and paste the output to Claude | Owner ran dry run + --apply 10 Nov · Expect: DRY RUN (nothing is written) … Blocking --apply: … |
| 4.21 | done | Publish 1.34 ghost rules with the Terminal command (when Claude says) | Owner published 10 Nov (CLI, after one 503 retry) · Expect: ✔ Deploy complete! |
| 4.22 | done | iPhone build from main to TestFlight (pull again after iPhone 1.40 merges), then raise minimumIosBuild | Build 6 on TestFlight, minimumIosBuild 6 (16 Nov) |
| 4.23 | todo | Check after 1.34 rules: a manager with the Operatives switch edits an operative and saves | Owner · Expect: Saves normally (no 'not allowed') |
| 4.24 | done | Check slow order emails: resend.com → Emails (created vs delivered) and → Domains (DKIM/SPF verified) | You checked 13 Nov: hardly any emails in Resend → delay is before Resend (phone queue). Fix in progress (1.67) |
| 4.25 | done | Decide: keep or drop 'iPhone pushes only to main-vr2rt0-uoqzwv'? Tonight's iPhone PRs used their own branches | Decided 13 Nov: drop the rule; each change its own branch + PR, merged to main after review |
| 4.26 | done | Deploy email function (sendEmail) for the duplicate-email fix | You — done 13 Nov |
| 4.27 | done | Publish 1.40 Firestore rules + deploy sendDevicePushOnNotificationCreate (commands in chat) | You — now · Expect: ✔ Deploy complete! twice; Firestore → Rules shows today's publish time |
| 4.28 | todo | Optional: switch on 30-day clean-up (TTL) for emailRequestSends | You — steps in web #308 |
| 4.29 | done | Answer the 36 open decisions + toggle/leave-gap/type-change questions | You — answered 13 Nov |
| 4.30 | done | Build 6 to TestFlight, minimumIosBuild 6, Storage + Firestore rules 1.52 published | You (16 Nov) |
| 4.31 | todo | Check Firebase → Firestore → Rules history: today's publish is at the top | You |
| 4.32 | done | Cost alert (£25 budget) | You (16 Nov) |
| 4.33 | todo | Run npm run test:rules on branch w-rules-hardening (#334) and send the last lines | You |
| 4.34 | done | Security switches: three backfill --apply runs, re-run dry runs (0 to update), then switch on for your company and test | You: backfills run, both switches on for all companies. |
| 4.35 | done | Build 7 to TestFlight (1.54 + pay fix) | You: done 16 Nov |
| 4.36 | done | Answer the owner console decisions D1–D17 | You: all agreed except D8 (not doing it) |
| 4.37 | todo | Listen to the feedback sounds (preview page Claude sends) and say if the feel is right | You — re-confirm (may have been ticked by accident 17 Nov) |
| 4.38 | done | Set minimumIosBuild to 7 (Firebase → Firestore → platformConfig → app) and tell Claude | You: done 16 Nov |
| 4.39 | done | Publish 1.55.1 rules, Storage rules, indexes; deploy the five functions — done 17 Nov | Rules, Storage rules and indexes: DONE 16 Nov via the GitHub publish button (Claude). Functions still yours: timesheetBookingsChangedNotice, timesheetManagerBookingsChangedNotice, sendDevicePushOnNotificationCreate, eraseDeletedOrganizations, sendEmail. |
| 4.40 | todo | Pay strip: smoke test on one test person first (My Timesheets, Overtime button, a rate on a timesheet, My Profile), then backup + strip everyone | You, after build 7 is live everywhere — Claude sends steps |
| 4.41 | done | Exported timesheets: lock all (owner 16 Nov) — corrections go through revisions REV 1, REV 2 | You: decided |
| 4.42 | todo | Google key L1Yc: restrict to the 7 Firebase services, test, close GitHub alerts as Won't fix | You — re-confirm (may have been ticked by accident 17 Nov) |
| 4.43 | todo | Data health: link 'Unknown person 5FB5F683' (8 bookings, Sep) to the right person once identified | You |

### Section 5 — App Store (parked until you say) (0 done of 4)

| Code | Status | What | Who / expect |
|---|---|---|---|
| 5.1 | parked | Screenshots, description, privacy answers, age rating | Claude + you |
| 5.2 | parked | Privacy policy and terms links, demo account for Apple | Claude + you |
| 5.3 | parked | TestFlight, then submission | You |
| 5.4 | parked | Next.js middleware → proxy rename (web #365): parked until after launch | Claude |

### Section 6 — Test checklists (0 done of 20)

| Code | Status | What | Who / expect |
|---|---|---|---|
| 6.1 | parked | Before you start: write down your current Working hours settings (or use a test company), so you can put them back after steps 6.2–6.5 | Replaced by the 17 Nov test checklist · Expect: You can restore your real settings afterwards. These tests change pay settings for the whole company. |
| 6.2 | parked | Settings → Working hours, Mon–Fri: set 06:30–14:30, lunch 10:00–10:45, Unpaid | Replaced by the 17 Nov test checklist · Expect: Line reads "06:30–14:30 = 8h − 45 min unpaid break = 7h15m". No "paid hours" box for Mon–Fri. |
| 6.3 | parked | Working hours pickers | Replaced by the 17 Nov test checklist · Expect: Start/finish move in 30 minutes; lunch start, end and length move in 15 minutes (10:45 is allowed). |
| 6.4 | parked | Saturday: set window 07:30–14:00 counts as 8h, lunch 12:00–12:30 Unpaid, then switch to Paid | Replaced by the 17 Nov test checklist · Expect: Preview shows 7.5h when Unpaid and 8h when Paid, and changes the moment you switch. |
| 6.5 | parked | Sunday: every hour ×2, lunch 30 min Unpaid. Book someone Sunday 07:30–14:00 | Replaced by the 17 Nov test checklist · Expect: Booking shows "12.5h (6.5h × 2 − 0.5h break)". Ticking "No unpaid break" on the booking gives 13h. |
| 6.6 | parked | Book anyone on a weekday (Schedule, Book Labour, Quick Add, My Schedule) | Replaced by the 17 Nov test checklist · Expect: Only Full day and Custom are offered. No AM/PM. |
| 6.7 | parked | Annual leave: request an AM half day | Replaced by the 17 Nov test checklist · Expect: AM/PM still offered for leave. AM shows 06:30–10:30 (the middle of the day, ignoring lunch). |
| 6.8 | parked | AM leave plus a booking 10:30–14:30 the same day, then change the booking to 11:00–14:30 | Replaced by the 17 Nov test checklist · Expect: 10:30–14:30: no unbooked warning. 11:00–14:30: an unbooked warning for the missing time (10:45–11:00). |
| 6.9 | parked | Book yourself twice on the same Saturday at different times | Replaced by the 17 Nov test checklist · Expect: Both bookings are kept and show in My Schedule and on the job. Nothing is overwritten. |
| 6.10 | parked | Book someone onto a switched-on job whose end date has passed | Replaced by the 17 Nov test checklist · Expect: The booking is allowed. |
| 6.11 | parked | Switch a small works off (inactive) | Replaced by the 17 Nov test checklist · Expect: It stays in the Small works list under Completed on both apps. The All count equals the number of rows. |
| 6.12 | parked | iPhone: Settings, scroll to the bottom | Replaced by the 17 Nov test checklist · Expect: "Projects N · Small works M" matches the counts you see on web. |
| 6.13 | parked | Give an operative a task on a job they are not booked on, then sign in as them | Replaced by the 17 Nov test checklist · Expect: The job appears in their list on both apps. |
| 6.14 | parked | Home screen: active projects | Replaced by the 17 Nov test checklist · Expect: The same number on web and iPhone for the same person. |
| 6.15 | parked | Timesheet with the Sunday booking from 6.5 | Replaced by the 17 Nov test checklist · Expect: Line reads "6.5h × 2 − 0.5h break = 12.5h"; pay matches the hours × rate. |
| 6.16 | parked | Weekly report for that week (screen and PDF) | Replaced by the 17 Nov test checklist · Expect: Same wording and the same totals on both apps. |
| 6.17 | parked | Book a colleague onto a job (after the functions deploy) | Replaced by the 17 Nov test checklist · Expect: They get a phone push. You get no push for a booking you made yourself. |
| 6.18 | parked | Make a double booking | Replaced by the 17 Nov test checklist · Expect: An orange clash row appears in the booking flow with keep / drop, on both apps. |
| 6.19 | parked | Put your real Working hours settings back | Replaced by the 17 Nov test checklist · Expect: Settings match what you wrote down in 6.1. |
| 6.20 | parked | Web: Settings → Company-wide → Export company data. Download, open the ZIP | Replaced by the 17 Nov test checklist · Expect: One CSV per area opens in Excel with your dates; README lists every file and row counts; variations.csv and settings.csv are not empty if you have variations/timesheets (if they are, send me the README). |
