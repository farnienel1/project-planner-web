# 12 — Projects (list + detail hub)

> This chat covers the list, work cards, and hub chrome. Job tiles (Scheduling, Tasks, …) stay on existing routes; Deadlines / Active users tiles are section 16.

## Evidence
- `Views/ProjectsView.swift` (list, empty states, `ProjectDetailRowView`)
- `Views/ProjectDetailView.swift` hub ~L148–534, summary ~L401
- `Views/ProjectSmallWorksRevampTokens.swift` `WorksListStatsRow`
- `Core/WorkAccess.swift` via web `visibleWorks`

## List (“Projects”)
Default filter **Active**.
Stats: Active / Upcoming / Completed.
Search placeholder **Search projects, addresses…** matches job number, site name, address, client name.
Chips: All · n, Active · n, Upcoming · n, Completed · n.
Work cards (staff): job number, job type pill, status pill, client, address, manager, date `d MMM yyyy`, Progress bar.
Operative compact: job number, site name, address (3 lines).
Empty: “No projects found” / “Get started by adding your first project”.
Filter-only empty: “The current filter hides older or completed jobs. Choose “All” or “Completed” above to see everything.” + **Show all projects**.
Search empty: “No projects match your search.”
+ New project if `canManageWorkCatalogue(.projects)`.
Loading: “Loading projects...”

## Hub
Hero (blue gradient): job number, type pill, status, progress, days left.
**Manage** tiles (existing routes). **Details** sticky on desktop 4/12: Client, Manager, Timeline `dd MMM yy`, Description (“No description added”), **Edit Project Details**, Notes.

## Desktop
List: stats/search/chips then 2 cols @lg, 3 @2xl.
Hub: hero full width; Manage 8/12 (4 tiles @xl); Details 4/12 sticky.

## Out of this chat
Create/edit project forms (existing pages). Deadlines / Active users tiles. Full `ProjectDetailView` task/scheduling internals.
