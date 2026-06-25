# iOS ↔ Web parity reference

**iOS source (read-only for web work):**  
`/Users/farnienel/Desktop/Project Planner/Project Planner/`

**Menu source of truth:** `Navigation/MainMenuCatalog.swift`  
**Firestore source of truth:** `FirebaseBackend.swift` + `Core/*Store.swift`

## Cursor workspace — link iOS without changing iOS code

Pick one:

### Option A — Multi-root workspace (recommended)

1. **File → Add Folder to Workspace…**
2. Add: `/Users/farnienel/Desktop/Project Planner/Project Planner`
3. Save workspace (optional): `Project Planner.code-workspace` at repo root with:

```json
{
  "folders": [
    { "path": "web-app", "name": "Web" },
    { "path": "Project Planner", "name": "iOS" }
  ]
}
```

Agents can then `@` iOS files directly (e.g. `MainMenuCatalog.swift`, `FirebaseBackend.swift`).

### Option B — Open parent folder

Open `/Users/farnienel/Desktop/Project Planner` as the workspace root (contains `web-app/`, `Project Planner/`, `.xcodeproj`).

### Option C — No workspace change

Terminal and agents can still read iOS via **absolute paths** (as in this doc). Linking is mainly for convenience and `@` references.

**Do not** symlink iOS into `web-app/` unless you want it in git — use multi-root instead.

---

## Main menu sections (iOS)

| Section | iOS enum | Web sidebar |
|---------|----------|-------------|
| Navigate | `.navigate` | **Navigate** |
| Tools | `.tools` | *(currently merged into Navigate — can split later)* |
| Team | `.team` | **App & account** (Add / Manage users) |
| App & account | `.account` | **App & account** |

### Navigate rows

| iOS id | Title | Web route | Data source |
|--------|-------|-----------|-------------|
| `clients` | Clients | `/dashboard/clients` | `organizations/{orgId}/clients` |
| `projects` | Projects | `/dashboard/projects` | `…/projects` |
| `small_works` | Small works | `/dashboard/small-works` | `…/smallWorks` |
| `operatives` | Operatives | `/dashboard/operatives` | `…/operatives` |
| `managers` | Managers | `/dashboard/managers` | `…/managers` |
| `holiday` | Holiday | `/dashboard/annual-leave` | `…/holidayBookings` |
| `site_map` | Site map | `/dashboard/site-map` | **No collection** — map from projects + bookings |
| `site_audit` | Site audit | `/dashboard/site-audit` | `…/siteAudits` |
| `invoicing` | Timesheets | `/dashboard/timesheets` | **No collection** — bookings + users + org settings |

### Tools rows

| iOS id | Title | Web route | Firestore |
|--------|-------|-----------|-----------|
| `skills` | Skills | `/dashboard/skills` | `…/skills` |
| `qualifications` | Qualifications | `/dashboard/qualifications` | `…/qualifications` |
| `job_types` | Job types | `/dashboard/job-types` | `…/settings/jobTypes` **document** (`jobTypes: string[]`) |
| `wholesalers` | Wholesalers | `/dashboard/wholesalers` | `…/wholesalers` |
| `material_catalogue` | Material catalogue | `/dashboard/materials` | `…/materialCatalogue` |
| `subcontractors` | Sub contractors | `/dashboard/sub-contractors` | `…/subcontractors` (+ `subcontractorBookings`) |

### Team / account

| iOS id | Web route | Firestore / Auth |
|--------|-----------|------------------|
| `add_user` | `/dashboard/settings/users/new` | `users`, `invitations`, Firebase Auth |
| `manage_users` | `/dashboard/settings/users` | `users` (org members) |
| `settings` | `/dashboard/settings` | `users`, `organizations` |
| `help` | `/dashboard/help` | — |
| `reset_password` | `/dashboard/settings/password` | Firebase Auth |

---

## Top-level collections (not under org)

| Collection | Purpose |
|------------|---------|
| `users` | Profile, permissions, `organizationId` |
| `organizations` | Org doc + `settings` embedded / subdocs |
| `invitations` | Pending invites |
| `platformConfig` | Global templates e.g. `webDashboard` default layout |

---

## Schedule routes (web ↔ iOS)

| Screen | iOS | Web route | Firestore |
|--------|-----|-----------|-----------|
| My Schedule | `MyScheduleView` | `/dashboard/my-schedule` | `bookings` (linked operative) + `managerSiteBookings` (current user) |
| Daily overview | `DailyOverviewView` | `/dashboard/daily-overview` | `managerSiteBookings` + operative roster (web daily overview still simplified) |

**Same Firebase project:** localhost and TestFlight use the same Firestore when env points at the same `projectId`. TestFlight is only iOS distribution — not a separate database.

**Deploy rules** (from the iOS app folder — `firebase.json` lives next to `firestore.rules`):

```bash
cd "/Users/farnienel/Desktop/Project Planner/Project Planner"
firebase deploy --only firestore:rules
```

---

## Org subcollections (common)

Path prefix: `organizations/{organizationId}/`

| Collection | Used for |
|------------|----------|
| `clients` | Clients |
| `projects` | Projects |
| `smallWorks` | Small works |
| `operatives` | Operatives |
| `managers` | Managers |
| `bookings` | Operative schedule, timesheets, site map pins |
| `managerSiteBookings` | Admin/manager self-bookings (office, WFH, site) — **My Schedule** on iOS |
| `acceptedBookingClashes` | Dismissed booking clash pairs (web warnings) |
| `dashboardLayouts` | Legacy per-user web dashboard layout under org |
| `holidayBookings` | Annual leave / holiday |
| `skills` | Skills catalogue |
| `qualifications` | Qualification types |
| `siteAudits` | Site audits |
| `wholesalers` | Wholesalers |
| `materialCatalogue` | Material catalogue (org library) |
| `materials` | Per-project material lines |
| `materialSendRecords` | Sent-to-wholesaler history |
| `subcontractors` | Sub contractor companies |
| `subcontractorBookings` | Sub contractor schedule |
| `tasks` | Project tasks |
| `settings` | Subdocs e.g. `jobTypes` |
| `operativeProfiles` | Operative ↔ user linkage |
| `userEmails` | Email → userId map |
| `healthSafety` | Per-project H&S at `projects/{id}/healthSafety/data` (+ `platformConfig/toolboxTalkLibrary`) |

### Settings subdocuments

- `organizations/{orgId}/settings/jobTypes` — field `jobTypes: string[]`

---

## Storage paths (iOS)

Examples from `FirebaseBackend.swift`:

- `organizations/{orgId}/siteAudits/{auditId}/images/…`
- `organizations/{orgId}/tasks/{taskId}/files/…`
- `organizations/{orgId}/branding/company_logo/…`
- `organizations/{orgId}/operatives/{operativeId}/qualifications/…/certificates/…`

---

## Web gaps to close (by priority)

See also **`docs/FLOW_PARITY_AND_TESTING.md`** for the full booking → daily overview → weekly report → timesheets chain and how to link the iOS repo for agent parity passes.

1. Fix collection names on catalog pages (see `lib/firebase/orgCollections.ts`).
2. Job types: read/write `settings/jobTypes` document, not a subcollection.
3. Site map: map view from `projects` + `bookings` (like `OrgSitesMapView.swift`).
4. Timesheets: port `InvoicingView` / booking payroll logic (uses `bookings`, not `timesheets`).
5. Add user / manage users: port `AddUserView` / `ManageUsersView` + `invitations`.

---

*Generated from iOS repo on disk — update when `FirebaseBackend.swift` changes.*
