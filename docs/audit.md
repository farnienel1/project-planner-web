# Project Planner — Bug Fix Workplan (Cursor-Optimised)

**How to use this file**
1. Put this in your repo (e.g. `/docs/audit.md`) so Cursor can `@`-reference it across sessions.
2. Work **one batch at a time** in the order below. Each batch is grouped by shared root cause, so a single fix often clears multiple bugs.
3. Each batch has a **ready-to-paste prompt**. Paste it, let Cursor locate the files and show you a diff, review, then accept.
4. Don't paste all batches at once — Cursor does its best work on focused, scoped tasks.

**Source of findings:** automated browser audit (UI behaviour only). File paths below are *best guesses* based on Next.js App Router conventions and observed routes — let Cursor grep to confirm before editing. Where I inferred a data-layer cause, ask Cursor to verify against the real Firestore write function.

**Suggested batch order:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

---

## BATCH 1 — Unresolved template literals (highest ROI, ~5 min)

**Bugs:** BUG-003, BUG-013, BUG-019
**Shared root cause:** Static strings containing `{orgId}`, `{userId}`, `{week}` are rendered literally instead of being interpolated. The `{...}` was written inside a normal quoted string rather than a template literal (backticks), or the variable isn't in scope.

**Where it shows (routes → likely files):**
- `/dashboard/projects/new` → `app/(dashboard)/dashboard/projects/new/page.tsx`
- `/dashboard/small-works/new` → `app/(dashboard)/dashboard/small-works/new/page.tsx`
- `/dashboard/operatives/new` → `app/(dashboard)/dashboard/operatives/new/page.tsx`
- `/dashboard/timesheets` → `app/(dashboard)/dashboard/timesheets/page.tsx`

**Exact strings observed in the UI:**
- `"New project synced to Firebase organizations/{orgId}/projects"`
- `"New small work synced to Firebase organizations/{orgId}/smallWorks"`
- `"Create operative profile in Firebase organizations/{orgId}/operatives"`
- `"...stored per user/week in organizations/{orgId}/settings/timesheet_{userId}_{week} on iOS."`

### 📋 Cursor prompt
```
Using @audit.md BATCH 1: search the codebase for the literal strings "organizations/{orgId}" and "timesheet_{userId}_{week}". These are subtitle/help texts that render the raw placeholders {orgId}, {userId}, {week} to users instead of interpolating them.

For each occurrence:
1. Confirm whether orgId/userId/week are in scope at that point (from auth context, props, or a hook).
2. If in scope, convert the string to a template literal using the real values.
3. If NOT in scope, tell me — don't guess the variable source.

Also flag the timesheets one specifically: it reads like internal developer debug text. Ask me whether to interpolate it or remove it from the production UI entirely. Show me a diff per file before applying.
```

---

## BATCH 2 — Managers don't load in create forms (unblocks project creation)

**Bugs:** BUG-006 (root) → likely also resolves BUG-004
**Shared root cause:** The Managers `<select>` on the project and small-works create forms has **zero options** even though an active manager exists. Confirmed via DOM: the select renders with `optionCount: 0`. Because Managers is a required field, the form then fails validation silently (BUG-004).

**Where it shows:**
- `/dashboard/projects/new` → `app/(dashboard)/dashboard/projects/new/page.tsx`
- `/dashboard/small-works/new` → `app/(dashboard)/dashboard/small-works/new/page.tsx`

**What to check:** the manager-fetching query (likely a `useEffect` + `getDocs`, or an `onSnapshot`). Compare it to the query used by the **Managers list page** (`/dashboard/managers`), which DOES correctly show the manager. The difference between those two queries is almost certainly the bug — wrong collection path, missing `orgId` scoping, or the result not being mapped into option state.

### 📋 Cursor prompt
```
Using @audit.md BATCH 2: the Managers multi-select on the project create form (projects/new) and small-works create form renders zero options, even though an active manager exists and shows correctly on the Managers list page (/dashboard/managers).

1. Open the Managers LIST page and find the query it uses to fetch managers (this one works).
2. Open the project create form and find the query IT uses to populate the Managers select (this one returns nothing).
3. Diff the two queries — collection path, orgId scoping, where/filter clauses, and how results are mapped into state/options.
4. Fix the create-form query to match the working one. Show me both queries side by side and the proposed fix before applying.

Do not change the Managers list page — it works.
```

---

## BATCH 3 — Forms & saves fail silently (no user feedback)

**Bugs:** BUG-004, BUG-022, BUG-023
**Shared root cause:** Multiple flows perform a write (or a failed validation) with **no toast, no inline error, no state change**. The user can't tell if anything happened.

**Sub-issues:**
- **BUG-004** — Create Project submit with empty Managers: no error shown, and the "Active / live project" checkbox resets as a side effect.
- **BUG-022** — Working Hours saves an invalid config (start time `20:00` after end time `16:00`) with no validation.
- **BUG-023** — Working Hours Save and My Profile Save show no success confirmation.

**Where it shows:**
- Project/small-works create forms (same files as Batch 2)
- `/dashboard/settings` Working hours → likely `app/(dashboard)/dashboard/settings/...working-hours.../page.tsx` (confirm path)
- My Profile → settings profile component

### 📋 Cursor prompt (do as 3 small steps, not all at once)
```
Using @audit.md BATCH 3. Do these one at a time and show me a diff after each.

STEP A (BUG-004): On the project create form, failed submission gives no feedback. Add: (1) inline validation that highlights the Managers field and shows a message when empty, (2) a scroll-to-first-error, (3) an error toast. Also investigate why the "Active / live project" checkbox resets on failed submit and fix it so its state persists.

STEP B (BUG-022): On the Working Hours settings page, add validation before save that rejects startTime >= endTime, and rejects break times outside the working window. Show an inline error and block the save when invalid.

STEP C (BUG-023): Add a success toast ("Saved") after a successful Firestore write on the Working Hours save and the My Profile save. If the app already has a toast utility, use it; otherwise tell me what's available before adding a new dependency.
```

---

## BATCH 4 — Client record is read-only (data dead end)

**Bugs:** BUG-001, BUG-002, BUG-007
**Shared root cause:** The Clients feature is create-only and partially broken on write.

**Sub-issues:**
- **BUG-001** — Email entered on creation is dropped; saved client shows `—` for email.
- **BUG-002** — Clicking a client row does nothing.
- **BUG-007** — No edit or delete anywhere.

**Where it shows:** `/dashboard/clients` → `app/(dashboard)/dashboard/clients/page.tsx`

### 📋 Cursor prompt
```
Using @audit.md BATCH 4, on the Clients page (/dashboard/clients):

1. (BUG-001) The email field is not saved on client creation — created clients show no email. Find the add-client submit handler, confirm the email input is wired to state, and confirm `email` is included in the Firestore write payload. Fix whichever is broken.

2. (BUG-002 + BUG-007) Client rows are not interactive and there's no edit/delete. Add a row action: either an edit modal or a /dashboard/clients/[id] detail page, plus a delete action with a confirmation dialog.

Show me the current add-client write payload first so I can confirm the email bug before you change anything else.
```

---

## BATCH 5 — Custom 404 inside the dashboard shell

**Bug:** BUG-024
**Root cause:** No `not-found` boundary inside the dashboard route group, so unknown routes (e.g. `/dashboard/settings/profile`, `/dashboard/anything-wrong`) fall through to the bare Next.js 404 with no sidebar or app chrome.

### 📋 Cursor prompt
```
Using @audit.md BATCH 5: unknown routes under /dashboard render the default bare Next.js 404 with no app shell. Add a custom not-found.tsx inside the dashboard route group so 404s render within the dashboard layout (sidebar + header) and include a "Back to dashboard" link. Confirm the correct route-group folder first, then add the file.
```

---

## BATCH 6 — Dead-end pages need real content or a CTA

**Bugs:** BUG-016, BUG-018
**Shared theme:** Pages that render an unhelpful empty state with no path forward.

**Sub-issues:**
- **BUG-016** — `/dashboard/my-schedule` is blank for admin/manager accounts; only message points to the iOS app.
- **BUG-018** — `/dashboard/tasks` has no way to create a task.

### 📋 Cursor prompt
```
Using @audit.md BATCH 6, two empty-state improvements:

1. (BUG-016) /dashboard/my-schedule shows only "no operative profile linked / use the iOS app" for admin accounts. For manager/admin accounts, show their manager bookings/assigned projects instead. If genuinely empty, replace the iOS-only message with a CTA linking to Daily Overview or Projects.

2. (BUG-018) /dashboard/tasks has no task-creation affordance. Either add a "New Task" button, or add an empty-state CTA explaining tasks are created from the Project Hub with a link to /dashboard/projects.

Tell me how tasks are currently created elsewhere in the app before adding the CTA, so the message is accurate.
```

---

## BATCH 7 — Visual / copy polish (quick wins, low risk)

**Bugs:** BUG-010, BUG-011, BUG-014, BUG-020, BUG-021
**Theme:** Cosmetic and copy issues. Safe to batch together.

| Bug | Location | Issue | Fix |
|-----|----------|-------|-----|
| BUG-010 | `/dashboard/warnings`, `/dashboard/tasks` | Stat cards (Booking clashes, Overdue, Approvals) use red/amber at value `0` | Apply warning colour only when `value > 0`; neutral grey at zero |
| BUG-011 | project/small-works create | "Hold Cmd/Ctrl to select multiple" native multiselect hint | Replace native `<select multiple>` with a searchable multi-select component |
| BUG-014 | `/dashboard/operatives/[id]` | Detail shows "Hourly Rate £0.00/hr" but form field is "Day rate" | Make label consistent across create/edit/detail |
| BUG-020 | `/dashboard/edit` | Editor instruction text renders inside the hero preview card | Move instruction text outside/above the hero preview boundary |
| BUG-021 | Org settings → Roles & permissions | "1 managers" pluralisation | Use a pluralise helper for manager/admin/ops counts |

### 📋 Cursor prompt
```
Using @audit.md BATCH 7, apply these low-risk polish fixes. Do them as one PR but show me a diff per file:

1. BUG-010: stat cards on /dashboard/warnings (Booking clashes) and /dashboard/tasks (Overdue, Approvals) use warning colours even at 0. Make warning/error colour conditional on value > 0.
2. BUG-021: in Org settings Roles & permissions, "1 managers" should be singular. Add a pluralise helper and apply to manager/admin/ops counts.
3. BUG-014: operative detail view labels the rate "Hourly Rate (£/hr)" but the form calls it "Day rate". Make the term consistent across create form, edit form, and detail view — tell me which is correct if it's ambiguous in the data model.
4. BUG-020: on /dashboard/edit, the "Drag eligible tiles..." instruction text renders inside the blue hero preview card. Move it outside the hero so it reads as editor guidance, not previewed content.
```

(BUG-011 left out of the batch above because swapping the multiselect component is a bigger change — do it separately if/when you want it.)

---

## BATCH 8 — Auth guards & route hygiene

**Bugs:** BUG-008, BUG-009
**Theme:** Routes that should be guarded or surfaced.

**Sub-issues:**
- **BUG-009** — `/setup` is reachable while logged in; its email field contains the literal test string `"Setting an org when I already setup."` (dev data left in the account).
- **BUG-008** — `/dashboard/timesheets` and `/dashboard/skills` are live and functional but absent from the sidebar.

### 📋 Cursor prompt
```
Using @audit.md BATCH 8:

1. (BUG-009) Add an auth guard to /setup that redirects an authenticated user who already has an org to /dashboard. Separately, remind me to delete the stray test value "Setting an org when I already setup." from the account in Firebase — that's data, not code.

2. (BUG-008) /dashboard/timesheets and /dashboard/skills are reachable but not in the sidebar. Tell me: are these intentionally hidden? If they should be live, add them to the sidebar nav under the right section. If not, add a guard/redirect. Don't leave functional routes invisible.
```

---

## Appendix — Full bug index

| ID | Severity | Batch | One-line |
|----|----------|-------|----------|
| BUG-001 | 🔴 | 4 | Client email dropped on creation |
| BUG-002 | 🟠 | 4 | Client rows not clickable |
| BUG-003 | 🔴 | 1 | `{orgId}` literal on project form |
| BUG-004 | 🔴 | 2/3 | Project create fails silently |
| BUG-006 | 🔴 | 2 | Managers select empty on create forms |
| BUG-007 | 🟡 | 4 | No client edit/delete |
| BUG-008 | 🟡 | 8 | Hidden timesheets/skills routes |
| BUG-009 | 🟡 | 8 | `/setup` reachable when logged in + test data |
| BUG-010 | 🟡 | 7 | Warning colours at zero |
| BUG-011 | 🟡 | 7* | Native multiselect hint (separate task) |
| BUG-012 | 🟠 | — | Line manager required but unfillable (see note) |
| BUG-013 | 🔴 | 1 | `{orgId}` literal on operative form |
| BUG-014 | 🟠 | 7 | "Hourly Rate" vs "Day rate" label mismatch |
| BUG-016 | 🟠 | 6 | My Schedule dead end for admins |
| BUG-018 | 🟠 | 6 | No task creation on Tasks page |
| BUG-019 | 🔴 | 1 | `{orgId}/{userId}/{week}` literals on timesheets |
| BUG-020 | 🟠 | 7 | Editor text inside hero preview |
| BUG-021 | 🟡 | 7 | "1 managers" pluralisation |
| BUG-022 | 🔴 | 3 | Invalid working hours save without validation |
| BUG-023 | 🟠 | 3 | No save-success feedback |
| BUG-024 | 🟠 | 5 | Bare Next.js 404 in dashboard |

**Note on BUG-012** (Line manager required but unfillable for single-manager orgs): not assigned to a batch because the right fix depends on intended behaviour — is Line Manager meant to be required for admins at all? Decide the rule first, then it's a one-line change. Raise it with Cursor as: *"Should the Line Manager field be required for admin accounts? It's currently required but unfillable when the org has only one manager."*

---

## Important caveats for Cursor (and you)

- File paths are **inferred from routes**, not read from your repo. Always let Cursor grep/confirm before editing.
- All **data-layer diagnoses** (email not saving, managers query, etc.) were inferred from UI behaviour. Cursor should verify against the actual Firestore read/write functions, not trust the inference.
- Some bugs (BUG-004 ↔ BUG-006, BUG-003 ↔ BUG-019) are **linked** — fixing the root may clear the dependent one. Re-test the dependent bug after fixing the root rather than fixing both blindly.
- This audit covered the **web app only**. iOS/Android share the Firestore backend, so any data-layer fix (e.g. the email write) should be checked for parity on mobile.
