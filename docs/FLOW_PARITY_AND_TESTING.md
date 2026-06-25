# Flow parity & testing without manual web QA

Use this with the iOS repo linked **read-only** so agents can compare Swift ↔ web without you clicking through every screen.

## Link the iOS repo in Cursor (read-only)

You already have instructions in `docs/IOS_FIRESTORE_PARITY.md`. Quickest options:

### Option A — Multi-root workspace (best)

1. **File → Add Folder to Workspace…**
2. Add your iOS folder, e.g.  
   `/Users/farnienel/Desktop/Project Planner/Project Planner`
3. Save as `Project Planner.code-workspace` with both `web-app` and iOS folders.

Then in chat: *“Compare web daily overview to iOS `DailyOverviewView.swift`”* and `@` the Swift file.

### Option B — Paste the iOS path in chat

Send the absolute path to the iOS `Project Planner` folder. Agents can read Swift files directly (no edits to iOS).

### Option C — GitHub link

If iOS is on GitHub, paste the repo URL. Clone is not required if the folder is already on disk.

**Important:** Web and iOS share the **same Firestore** when `projectId` matches — parity is about **UI + which collections each screen reads/writes**, not separate test data.

---

## End-to-end data chain (what must line up)

```
Booking created (project schedule / My Schedule)
        ↓
┌───────────────────┬────────────────────┬─────────────────────┐
│ bookings          │ managerSiteBookings│ subcontractorBookings│
│ (operatives)      │ (managers/admins)  │ (subs)               │
└─────────┬─────────┴──────────┬─────────┴──────────┬──────────┘
          ↓                    ↓                    ↓
   Daily overview        Daily overview         (iOS only today)
   Weekly report         Weekly report
   Warnings (clashes)    Warnings (mgr overlaps)
   Timesheets            Timesheets (if timesheetsEnabled)
          ↓
   My Schedule (per user: linked operative bookings + own manager bookings)
          ↓
   Timesheet sign-off (settings/timesheet_{userId}_{week} on iOS)
          ↓
   Manager approval → Invoice PDF (iOS InvoicingView)
```

---

## Web vs iOS status (March 2026 audit)

| Flow | iOS reference (typical) | Web route | Status |
|------|-------------------------|-----------|--------|
| Project operative booking | Schedule flow | `/dashboard/projects/[id]/schedule/operatives` | ✅ Wizard + clashes |
| Manager/admin on project | Same | Same picker (`managerSiteBookings`) | ✅ Save works |
| Manager self-book | `MyScheduleView` | `/dashboard/my-schedule` | ✅ |
| Subcontractor booking | Sub schedule | `…/schedule/subcontractors` | ⚠️ No clash detection |
| **Daily overview** | `DailyOverviewView` | `/dashboard/daily-overview` | ✅ Operative + manager bookings |
| **Weekly report** | Weekly report view | `/dashboard/weekly-report` | ✅ Invoicing period / week / custom range + Generate report PDF |
| Warnings — operative clashes | Warnings | `/dashboard/warnings` | ✅ |
| Warnings — unbooked labour | Warnings | `/dashboard/warnings` | ✅ |
| Warnings — manager overlaps | Warnings / weekly | `/dashboard/warnings` | ✅ |
| **Timesheets** | `InvoicingView` | `/dashboard/timesheets` | ✅ Sign-off, approval, invoice HTML |
| Timesheet sign-off | `timesheet_{userId}_{week}` | `/dashboard/timesheets` | ✅ Firestore settings doc |
| Invoice after approval | InvoicingView | `/dashboard/timesheets` | ✅ Generate invoice download |
| My Schedule read-only | MyScheduleView | `/dashboard/my-schedule` | ⚠️ Manager rows not editable |
| Project week overview | — | Project schedule hub | ✅ Ops + managers + subs |

---

## How we verify without days of manual testing

### 1. Agent parity pass (you link iOS once)

Ask in Agent mode:

> Run an iOS ↔ web parity pass for: booking → daily overview → weekly report → My Schedule → timesheets → invoice. Read iOS from `[path]`. Produce a gap list with Swift file + web file for each screen.

The agent should check:

- Firestore collections read/written
- Field names (`timeSlot`, `locationType`, `status`)
- Permission gates (`weeklyReports`, `timesheetsEnabled`, `dailyOverview`)
- Clash / warning acceptance (`acceptedBookingClashes`)

### 2. Firestore contract tests (automated)

Same Firebase project → after one iOS booking, query:

- `organizations/{orgId}/bookings`
- `organizations/{orgId}/managerSiteBookings`

Then assert web screens that **should** show that row actually load that collection. (Can add a small script under `scripts/parity-check.ts`.)

### 3. Priority build order (closes the chain)

| Priority | Work | Unblocks |
|----------|------|----------|
| P0 | Daily overview + `managerSiteBookings` | Managers/admins visible org-wide |
| P0 | Timesheets port (`InvoicingView`) | Sign-off + approval + invoice |
| P0 | Weekly report screen | Admin reporting |
| P1 | Manager clash warnings | Parity with iOS warnings |
| P1 | Timesheets include manager hours | Manager payroll |
| P2 | Subcontractor clash detection | Scheduling quality |

### 4. Smoke checklist (15 min after each release)

1. Book operative on project → appears in daily overview + week view + My Schedule (operative).
2. Book admin on project → appears in week view + daily overview (after P0).
3. Accept clash → warning dismisses; still on schedule.
4. Operative My Schedule shows both operative + manager rows if linked.
5. Timesheets week total matches booking count (after timesheet port).

---

## iOS files to @ when auditing

| Topic | Likely Swift paths (under iOS folder) |
|-------|--------------------------------------|
| Firestore paths | `FirebaseBackend.swift`, `Core/*Store.swift` |
| Daily overview | `DailyOverviewView.swift` |
| My Schedule | `MyScheduleView.swift` |
| Warnings | Warnings / clash views in `Core/` or `Views/` |
| Weekly report | Search `weeklyReport` / `WeeklyReport` |
| Timesheets / invoice | `InvoicingView.swift` |
| Project scheduling | Project schedule / booking views |

---

## Web files (same flows)

| Flow | Web entry |
|------|-----------|
| Booking wizard | `components/projects/scheduling/ScheduleOperativeForm.tsx` |
| Daily overview | `components/schedule/ScheduleScreen.tsx`, `app/dashboard/daily-overview/page.tsx` |
| Warnings | `components/warnings/WarningsScreen.tsx` |
| My Schedule | `app/dashboard/my-schedule/page.tsx` |
| Timesheets | `app/dashboard/timesheets/page.tsx` |
| Stores | `lib/stores/bookingStore.ts`, `managerScheduleStore.ts` |

---

*Update this doc when iOS or web flows change.*
