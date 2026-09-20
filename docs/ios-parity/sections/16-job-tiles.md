# 16 — Job tiles (Materials, View, My Tasks, H&S, Site Audit, Location)

iOS source of truth: `Views/ProjectDetailView.swift` hub tiles + destination screens. Same screens for Projects and Small Works (`jobType`); persistence collection is `projects` vs `smallWorks`. Deadlines and Active users are **out of this round**.

Screenshots: none in `docs/ios-parity/screenshots/` this run — built from Swift + Blueprint §6.24.

## Shared hub (`ProjectDetailView.swift` ~L507–707)

| Role | Tiles |
|---|---|
| Operative | My Tasks; Materials if `canViewMaterials`; H&S; Site Audit if `canViewSiteAudit`; Location. No Scheduling / View. |
| Manager/Admin | Scheduling; View if `canConfigureProjectVisibility`; My Tasks; Materials; H&S; Site Audit; Location |

Root title: **Project** vs **Small work**.

## Materials

Files: `Views/MaterialsView.swift`, `AdminManagerMaterialsView.swift`, `MaterialsProjectListUI.swift`. Nav **Materials**.

Week navigator (`d – d MMM yyyy`, “{n} items this week”) + 7-day strip + day header `d MMM · {n} items` + line cards.

Empty: **No materials for {date}** / *Add what you need delivered on this day.* CTA **Add material**.

Staff: Add, send (paperplane), Quote/Order History. Operative: Add only; cannot send.

Data: `organizations/{orgId}/materials` where `projectId` matches. Status raw values `draft` / `sentForQuote` / `ordered`. Send writes `materialSendRecords` with `requestType` **Quote** or **Order**, then updates line `status`, `lastSentAt`, `lastSentRequestType`. Email via Cloud Function is a follow-up if not already wired.

## View (visibility)

`ProjectVisibilitySettingsView` (`ProjectDetailView.swift:2517–2668`). Title **View**.

Copy: *This feature can be used to select who will not be able to view the project or small works. Admins always have access and cannot be hidden.*

Tabs: Managers | Operatives. Filter: All / Active / Inactive / Pending. Search field **Search user**. Checkmark = visible; empty circle = hidden. Writes `hiddenManagerUserIds` / `hiddenOperativeUserIds` on the job doc. Operatives never see the tile.

## My Tasks (job tile, not Home Tasks)

`ProjectDetailView.swift` ~L2299–2462. Nav **Tasks**. Default scope **Assigned to me**.

Stats: To do · In progress · Overdue · Done. Search **Search tasks…**. Pills: Assigned to me · Active · n · Overdue · n · Completed · n. Trailing **+**.

Empty titles/subtitles: `ProjectDetailView.swift:2008–2027`. Create requires title, assignee, due date (*Every task must have a due date.*). Firestore `organizations/{orgId}/tasks`. Assignment IDs are operative/manager catalogue UUIDs (`assignedOperativeId(s)` / `assignedManagerId(s)`).

## H&S

`Views/ProjectHealthSafetyView.swift`. Title **Health & Safety**, subtitle `{jobNumber} · {siteName}`. Kind **Project** / **Small Work**. Settings doc `settings/healthSafety_{projects|smallWorks}_{projectId}`.

Manager tabs: Hub, Library, Tracking, RAMS, Other. Operative: Toolbox, RAMS, Other. Hub banner **Manager access**. Empties: Nothing to sign / No talks found / Nothing sent yet / No RAMS yet / No documents yet.

## Site Audit (per-job)

`SiteAuditProjectHubView` / `SiteAuditProjectListView`. Hero **THIS PROJECT** even for small works. Empty **No site audits** / *Create your first audit for this project.* Types: All, Pre-Start, General, Variations, Snags. Path `organizations/{orgId}/siteAudits` filtered by `projectId`. Operatives: `visibleToOperatives || createdByUserId == me`.

## Location

`ProjectDetailView.swift:1745–1858`. Header **Site Location**. Valid location = non-empty address (not “Site Location not available”) **or** lat/lon. Else grey box **Site Location not available**. Buttons **Apple Maps** | **Google Maps**. Non-interactive map ~200pt, marker = site name.

## Desktop (≥1280)

Materials: week strip + lines table; send panel on the right. View: two-column people list. Tasks: stats + list (not a phone kanban). H&S / Site audit: existing hub cards in a wider grid. Location: address + map side by side.

## Cross-platform test script (Farnie)

Create/edit on web for a project **and** a small work, then confirm on iPhone: materials for a day, hide a user, a task assigned to you, H&S hub, a site audit, location map. Repeat as an operative (no View tile; materials/site audit gated).
