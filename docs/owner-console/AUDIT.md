# Owner console — Phase 1 audit

Code read: `main` at `fc1c5b9` (rulebook 1.49.0). Written 15 Nov 2026, deeper scan 16 Nov. No code was changed by this audit.
Tags: [Certain] = seen in the code or a test run; [Likely] = strong inference; [Guessing] = filling a gap.

Not checked in this audit: the live site, production data or real read counts (no production access), the iPhone app, a browser run of the console (no Firebase config on this machine), and whether `FIREBASE_SERVICE_ACCOUNT_JSON` is set on Netlify.

---

## 1. Test baseline (§6.1)

Run in a scratch copy of the repo on this cloud machine. One change was needed only to install: the `xlsx` library downloads from cdn.sheetjs.com, which this machine's network blocks, so the scratch copy used the npm-registry `xlsx@0.18.5`. The repo itself is untouched.

| Command | Result | Notes |
|---|---|---|
| `npm run lint` | ✅ pass | 26 warnings, 0 errors |
| `npm test` | ✅ pass | 2,087 + 170 tests, 0 failed, 0 skipped |
| `npm run test:rules` | ✅ pass | 298 tests: 297 pass, 1 skipped (marked skip in the suite itself) |
| `npm run test:rules:storage` | ❌ **pre-existing failure** | 8 pass, **20 fail**. Every test that *allows* a write is refused (`storage/unauthorized`). It happens with firebase-tools 15.34.2 (the version CI pins) and with 15.36.0. [Likely] this is the emulator's Storage→Firestore lookups on this machine, not the rules — but I can't prove that here. **CI never runs this suite**, so nobody would have noticed. Owner check: run it once on your Mac. |
| `npm run build` | ✅ pass | Fails without Firebase settings (the same as CI, which passes placeholder values). Passes with CI's placeholders. |
| `npm run check:calculators` | ✅ pass | |
| `npm run check:rules-budget` | ✅ pass | |

**Also found:** CI (`.github/workflows/web-ci.yml`) runs neither `test:rules` nor `test:rules:storage`. It only runs the rules *type check*. Your §6.3 asks for both in CI, so that goes into PR 1.

---

## 2. Page-by-page status

Every page in the console reads from one shared store (`lib/analytics/analyticsStore.ts`). How that store loads is in §3. Statuses: **Works**, **Broken**, **Placeholder**, **Fake** (shows a number that isn't what it says) or **Slow**.

| Page | Status | Evidence |
|---|---|---|
| **Overview** `/developer` | Fake + Slow | See issues O1–O9 below. |
| **Organisations** list | Works, partly Fake | "Registered users" ignores *Include test data*, while the org count above it respects it (`DeveloperOrganisations.tsx:76`). "Active in range" uses the same max-of-two-counts trick as the Overview (O3). |
| **Organisation detail** | Broken in parts | People = only users documents whose `organizationId` is this org (`DeveloperOrganisationDetail.tsx:39`). A member who joined from another company through a membership is missing. The delete dialog says "This can't be undone", which contradicts rulebook §20 (30-day restore). It has no reason box, no type-to-confirm, and the button always returns a 501 error (`delete-organisation/route.ts:26`). |
| **Users** | Works, partly Fake | Duplicates are folded by a console-only rule (`lib/owner/collapseDirectoryUsers.ts`), not the rulebook's person-id rule (guardrail 1). "Show full emails" writes one audit entry for all emails. |
| **Growth** | Fake | "Accounts" falls back to the total user count when the `user_signed_up` event count is 0, and "Org set up" does the same with the org count (`DeveloperConsolePages.tsx:50–51`). **Nothing in the app ever sends `user_signed_up`, `org_setup_completed`, `timesheet_signed` or `timesheet_approved`** [Certain: searched all of app/components/lib/functions]. So "Timesheet signed" is always 0, and the other two always show the directory totals labelled as funnel steps. |
| **Revenue** | Fake | MRR counts **trials** as paying (`DeveloperConsolePages.tsx:81`). When `mrrPence` is missing it fills in the list price (`:82`), which is an invented number. Ignores *Include test data*. |
| **Feature usage** | Works, reliability unknown | Counts consented web page-view events only. Ignores *Include test data*. |
| **Pages & errors** | Placeholder | `client_error` is never sent by anything [Certain]. Counts are over all time, not the chosen period. |
| **Website stats** | Placeholder / Fake | "Live organisations (unrounded)" = every org document, including test, unfinished and deleted ones. |
| **Analytics** | Works, partly Fake | Same event-only data. Ignores *Include test data* (`DeveloperAnalytics.tsx`). |
| **Feedback / Roadmap** | Works [Likely] | Owner edits are written straight from the browser (`lib/feedback/feedbackStore.ts`), not through a server route with an audit entry. Failures are swallowed (`ignoreIfDenied` returns false and the screen carries on). A second copy of ideas, votes and comments is written **into customers' `users/{uid}` documents** (`lib/feedback/platformBoard.ts:323`, fields `ppIdeas`, `ppIdeaVotes` …). That's customer data written from the owner's browser. |
| **Register interest** | Works [Likely] | Status, notes and delete fall back to direct browser writes (`lib/interest/interestStore.ts:189–226`) with no audit entry. Live listener ✅. |
| **Data quality** | Broken | "Unfinished setup" = any user whose org document **wasn't loaded** (`DeveloperDataQuality.tsx:27–30`). If the org read is refused or partial, live people show as unfinished. Their Delete button then deletes their users document (see H2). "Events missing source" is always every event, because the store never copies `source` or `path` from the event (`analyticsStore.ts:47–61`). |
| **Account** | Works [Likely] | Not tested in a browser. |

### Overview issues
- **O1 Logins doubled.** Every web login writes *two* events (`user_logged_in` and `login`, `trackEvent.ts:47–48`), and the Overview counts both (`DeveloperOverview.tsx:146`). [Certain]
- **O2 Signed timesheets from events that don't exist.** While the money figure loads, "Timesheets signed" shows an event count that is always 0 (`:15` of the KPI list).
- **O3 "Active" is the larger of two unrelated counts** (`:156`, `:242`): unique users with an event, versus users whose *last* seen time falls in the period. The second is wrong for any past period: someone active last month and again today counts only for today.
- **O4 Events ignore the test-data filter.** Only users and orgs are filtered.
- **O5 Timesheet value silently under-counts** (`lib/owner/signedTimesheetValue.ts`):
  - (a) a sheet whose person isn't found by exact id is skipped (`:137`). Sheets filed under a former invite id, a same-email id, a person from another company or a **deleted person** vanish (guardrails 1 and 3);
  - (b) an org that fails or times out (8 s) is skipped with only a browser-console warning (`:123`, `:164`);
  - (c) after 20 s a watchdog shows **£0 as if it were real** (`DeveloperOverview.tsx:130–133`);
  - (d) sheets of users matched by the test-data name rule (for example a real person with "test" in their name) are dropped even in real orgs;
  - (e) a reopened sheet (rulebook 1.47) is valued from its stale signed copy (already in `OWNER_DECISIONS.md` as a follow-up).
- **O6 Money period = the sign-off date, not the work period.** A sheet for October signed in November counts in November. This needs to be a definition you choose (Decision).
- **O7 MRR on the Overview** uses the same trial and list-price fill-in as Revenue.
- **O8 Previous-period comparison** is GBP only. Other currencies have no comparison.
- **O9 Re-reads everything when nothing changed.** Changing the period, or any refresh of the user list, re-downloads every org's whole `settings` collection.

---

## 3. What the console reads (load cost)

I can't count real reads without production access. Per console visit (the store's cache only lasts 15 seconds), the code reads [Certain]:

| What | Reads |
|---|---|
| `users` | every document (U) |
| `organizations` | every document (O) |
| `productEvents` | **every event ever written**: it asks for events since 1 Jan 2018 with no limit (`analyticsStore.ts:204`) |
| `productSessions` | every session ever |
| Feedback board | every idea, vote, comment and history row, plus `users` where `ppIdeaBoard == true`. If none are flagged, **every user again** (`platformBoard.ts:300`) |
| Overview timesheet value | for every org, its **entire** `settings` collection (every timesheet ever, plus all settings documents) and the org document. Re-run on each period change |

That means the cost grows with every event ever recorded and every timesheet ever signed. You can see the real numbers in the Firebase console under **Firestore → Usage**. The after-numbers will come from the seeded emulator in PR 1.

---

## 4. Owner server routes

Every route checks `requireOwner`, which means the token email is `info@projectplanner.us` and that email is verified (`lib/owner/requireOwner.ts`).

| Route | What it does | Guarded | Rate-limited | Audited | MFA checked | Problems |
|---|---|---|---|---|---|---|
| `POST /api/owner/audit` | writes any audit text the browser sends | ✅ | ✅* | it *is* the audit | ❌ | The browser decides what is logged. Used for "reveal email". |
| `POST /api/owner/send-password-reset` | reset email, via the Admin SDK if configured, else Firebase's own email | ✅ | ✅* | ✅ | ❌ | The 2-minute repeat guard is in server memory (`:14`), so it resets whenever Netlify starts a new instance. |
| `POST /api/owner/change-email` | Auth email, then users doc, email claim, roster rows | ✅ | ✅* | ✅ masked | ❌ | Needs the service-account key (501 otherwise). Not atomic: Auth changes first; if Firestore then fails, Auth and Firestore disagree (`:69–95`). Reason is optional. Only the person's home org's claim and roster rows are updated, not their other memberships. |
| `POST /api/owner/delete-unfinished-user` | deletes `users/{uid}` | ✅ | ✅* | ✅ | ❌ | **H2** below. |
| `POST /api/owner/mark-internal` | sets `isInternal` (and `isTest`) on an org or user | ✅ | ✅* | ✅ (no before value) | ❌ | Sets `isTest` to the same value as `isInternal`; there's no separate flag. |
| `POST /api/owner/delete-organisation` | always returns 501 | ✅ | ✅* | logs "blocked" | ❌ | Not built. |

\* Rate limits are in server memory per instance (`lib/security/rateLimit.ts`), so they are weak on Netlify's serverless functions.

**Audit log writes are best-effort** (`requireOwner.ts:50–60`): the fetch result is never checked. A failed audit write is silent, and the action still reports success.

---

## 5. Security findings

| # | Severity | Finding | Evidence |
|---|---|---|---|
| **C1** | **Critical** | **The platform owner can skip the emailed MFA code entirely.** `POST /api/auth/mfa/grant-setup` hands out a signed "MFA done" cookie (12 h) whenever `mfaSetupGrantAllowed` is true, and that function returns true for the owner email with no other condition (`lib/security/mfaSetupGrant.ts:22`, `app/api/auth/mfa/grant-setup/route.ts:89–106`). The path exists for the owner's first sign-up (`authStore.signUpOwner`), but nothing limits it to that. Anyone with the owner password can call it once, get the cookie and open `/developer`. | [Certain] read in code; the unit test `lib/security/mfaSetupGrant.test.ts:19` even asserts it |
| **C2** | **Critical** | **Any customer can skip the emailed MFA code.** The same route also skips MFA when the person's own users document says `accountConfirmed: false` (`mfaSetupGrant.ts:23`). The security rules let a person set that field on their own document. Proven on the emulator: an operative's `updateDoc(users/self, { accountConfirmed: false })` is **allowed**. So a stolen customer password plus two requests gets past MFA. | [Certain] emulator probe (throwaway test, not committed) + code |
| **H1** | **High** | **MFA is only a browser and page gate.** The `/developer` pages need the signed MFA cookie (`middleware.ts:15–43`), but **no `/api/owner/*` route checks it**, and Firestore can't. With the owner password alone, someone can call every owner route, and read every company's data straight from Firestore (the rules let the verified owner email read nearly everything), without the second step. | `requireOwner.ts`; `firestore.rules` `isPlatformOwner()` line 400 |
| **H2** | **High** | **"Delete unfinished user" deletes any user.** The server never checks that the account is actually unfinished or abandoned. It only refuses the owner's own email (`delete-unfinished-user/route.ts:21–25`). The console decides "unfinished" from whether the org document *loaded* (Data quality, §2), so a failed org read can label live people as deletable. It deletes only the users document: the Auth login, memberships, email claim and `members` entry are left behind, orphaned. There's no confirmation beyond a browser `confirm()`. | as cited |
| **H3** | **High** [Likely] | **Customer account deletion may be broken in production.** If `FIREBASE_SERVICE_ACCOUNT_JSON` isn't set on Netlify, as the 501 on organisation delete suggests, then a customer's **Delete my account** (`app/api/account/delete/route.ts:54`) and **Delete organisation** (`app/api/organization/delete`) also return "unavailable". Apple requires in-app account deletion. Owner check: open Netlify → Site configuration → Environment variables and see whether that variable exists. | as cited |
| M1 | Medium | Owner writes to customer data from the browser with no audit: feedback copies inside customers' `users` documents, plus register-interest edits and deletes. | §2 |
| M2 | Medium | `productEvents` accept any document from any signed-in user, with no shape or size check (`firestore.rules:2466`). Anyone can inflate or poison console figures, and every event is downloaded by the console (§3). | |
| M3 | Medium | `productFeedback` lets any signed-in user set `voteCount` / `commentCount` to any number (`firestore.rules:2422`). The Feedback ranking can be faked. | |
| M4 | Medium | Rate limits and the reset repeat guard live in memory per instance (§4). | |
| L1 | Low | Rules exist for `analyticsDaily`, `analyticsMonthly`, `analyticsTotals`, `ownerAlerts`, `adminJobs` and `deletedOrganisations`, but **nothing writes them**. They are dead rules. | `firestore.rules:2495–2517` |
| L2 | Low | The audit log can't be edited or deleted by anyone (default deny) ✅. But there's no test that proves it. | |
| L3 | Low | `erasedOrganizations/{orgId}` (the eraser's audit row, §20) has **no rule**, so the owner can't read the erase history in the console. | `firestore.rules` (no match) |
| L4 | Low | `adminAuditLog` can be created by the owner straight from the browser, not only by the server, so the browser can write any entry. | `firestore.rules:2477–2480` |

## 5b. Deeper scan (16 Nov)

- **Scale today:** about 27 accounts (the 1.32.4 auth-claims backfill stamped 27, `docs/HANDOVER.md`). Today's full scans are cheap; they get expensive as customers arrive. Correctness and security matter more than speed right now.
- **Server tools that exist and can be reused** [Certain]:
  - `lib/owner/identityToolkitAdmin.ts`: Auth look-up by uid or email, password-reset link, change email, **revoke refresh tokens, delete Auth user** (all via a service-account access token over REST; there's no `firebase-admin` package on web);
  - `lib/owner/firestoreRest.ts`: reads and writes as the signed-in owner;
  - `lib/organizationDeletion/server.ts`: `scheduleOrganizationDeletion` (§20). **It also cancels the Stripe subscription at the period end** (see Decision D5);
  - `app/api/organization/restore`: already lets the verified platform owner restore;
  - `lib/account/accountDeleteAdmin.ts`: `evaluateAccountOrgs` and `executeAccountDelete` (§11 account deletion).
- **Rulebook functions that already exist** for the console [Certain]: `accountDeletionPath`, `organizationDeletionState`, `canRestoreOrganization`, `organizationEraseDue`, `rosterPeople`, `personIdSet`, `rosterMembersForOrganization`, `organizationLevelFor`, `organizationMemberActive`, `rosterSegment`, `isAnonymisedDeletedProfile`, `timesheetTotals`, `isTimesheetFullySigned`, `signedTimesheetBookingChanges`, `timesheetListBucket`, `employmentTypeOnDay`, `hasAccess`, `resolveOrganizationCurrency`, `organizationTimeZone`, `organizationWeekDayKeys`, `appUpdateRequired`, `securitySwitches`, `superAdminTransferWrites`, `userActiveWrites`, `rulebookStamp`.
- **Missing for the console:**
  - the signed-timesheet value rule lives in a web-only file (`lib/owner/signedTimesheetValue.ts`), and its "fully signed?" test goes through web-only `lib/timesheets/timesheetApprovalPolicy.ts` and `draftFromFirestoreMap`. A Cloud Function can't call either, so the rollup needs it moved into `lib/canonical` (a rulebook change);
  - users documents store **no app platform or version** (`USER_DOCUMENT_FIELDS` has `lastSeenAt` only), so "web vs iOS" and "app versions in use" have no source;
  - **no email log, no push log, and no scheduled-job last-run record** are written anywhere.
- **The design reference** `docs/design/admin-console/admin-console-reference.html` named in the spec **isn't in the repo.** It has to be added before the UI PRs.
- **Feedback:** owner edits write a second copy of ideas into customers' `users/{uid}` documents (`ppIdeas`, `ppIdeaVotes`, `ppIdeaComments`, `ppIdeaAdmin`, `ppIdeaHistory`, flag `ppIdeaBoard`). That's a fallback from when the feedback rules weren't deployed. Ending it is a separate decision (D11).

---

## 6. Your wants (§4–§5): already possible vs needs new work

| Want | Today | Needs |
|---|---|---|
| Live queues (feedback, register interest, audit) | Register interest is live; the others load once | listeners |
| Headline counts | full scans | `count()` aggregations or a server route |
| £ by day / week / month / year / all time | one figure per period, slow and lossy (O5) | a server-side rollup function using the rulebook bundle, plus a backfill |
| £ by org, PAYE vs self-employed, by category | no | the rollup (the rulebook's `timesheetTotals` already gives labour, overtime, price work and expenses) |
| MRR, ARR, trials, churn | partly, and wrong (trials, list price) | correct definitions; churn needs history (a rollup or Stripe) |
| Activation funnel, retention, DAU/WAU/MAU, web vs iOS | **no source**: the funnel events aren't sent; iOS sends no events [Guessing — the iOS repo isn't here]; web events need cookie consent | **Decision**: build the funnel from real records (first invite, first booking, first signed timesheet), not from events. DAU from `users.lastSeenAt` history needs a daily rollup. |
| Auth facts (last sign-in, MFA, disabled) | no | service-account key + a server route |
| Delete user / org, disable, revoke, reset MFA | no (org delete returns 501) | service-account key; rulebook §11 / §20 paths already exist in `lib/account/accountDeleteAdmin.ts` |
| Restore org | no | §20 restore through a server route |
| Owner notes and tags | no | new `ownerNotes` collection + rule |
| Emails sent / bounced | **no log is written anywhere** | log in the email function, or read the Resend API (**Decision**) |
| Push sent / failed | no log | log in the push function |
| Scheduled job status (eraser, auth claims) | no record | each job writes a last-run document |
| App versions in use | web events carry `appVersion`; iOS unknown | a decision on where iOS reports its build (the `users` doc already gets `lastSeenAt` [Likely]) |
| Errors | nothing sends errors | **Decision** (§4.10) |
| Releases & switches (read-only) | `platformConfig/app` is readable | small page |
| Reveal masked fields with audit | partly (emails) | tax ids, rates and phones need server routes |
| Fresh-MFA check on destructive actions | no (H1) | server-side MFA check on `/api/owner/*` |

---

## 7. Broken list (each becomes a failing test first, in Phase 3)

1. Logins counted twice (O1).
2. Growth funnel shows directory totals as funnel steps; "Timesheet signed" is always 0 (Growth).
3. "Active" uses max-of-two and is wrong for past periods (O3).
4. Events, Analytics, Feature usage and Revenue ignore *Include test data* (O4, §2).
5. MRR counts trials and invents list-price MRR (O7, Revenue).
6. Timesheet value skips sheets filed under any id other than the person's current one, including deleted people (O5a).
7. Timesheet value hides failed or slow orgs and shows £0 after 20 s (O5b, O5c).
8. Timesheet value drops real people whose name contains "test" (O5d).
9. Reopened sheets valued from the stale snapshot (O5e; a rulebook fix).
10. Previous-period comparison is GBP only (O8).
11. Org detail misses members who joined through a membership (§2).
12. Data quality labels live people "unfinished" when their org didn't load (§2).
13. Data quality "events missing source" is always all events, because the store drops `source` and `path` (§2).
14. Organisations "Registered users" ignores the test filter (§2).
15. Website stats counts every org document as "live".
16. Delete-organisation dialog says "can't be undone" and always fails (501).
17. Delete-unfinished-user deletes any user and leaves orphans (H2).
18. Owner routes don't check MFA (H1).
19. Audit writes fail silently (§4).
20. Change-email leaves Auth and Firestore out of step on a part failure, and misses other memberships (§4).
21. Password-reset repeat guard and rate limits reset per server instance (M4).
22. Feedback owner edits fail silently (`ignoreIfDenied`) and write into customers' users documents (M1).
23. The console downloads every event, session, user, org and timesheet on every visit (§3).
24. The duplicate-person fold is a console-only rule, not `rosterPeople` / `personIdSet` (guardrail 1).
25. The storage-rules suite fails on this machine, and CI never runs either rules suite (§1).

---

## 8. Questions only you can answer before Phase 2

1. **Is `FIREBASE_SERVICE_ACCOUNT_JSON` set on Netlify?** (H3; this decides whether customer account deletion works today.)
2. **Does `npm run test:rules:storage` pass on your Mac?** (Pre-existing failure here.)
3. **Should C1, C2 and H1 (the MFA bypasses, and MFA not checked on the server) be fixed first, in their own small PR (PR 0 in `PLAN.md`), before the rebuild?** My recommendation: **yes**. They expose every customer's data today.
