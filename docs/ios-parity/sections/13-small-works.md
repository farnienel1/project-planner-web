# 13 — Small works

## Evidence
- `Views/SmallWorksView.swift` (list, filters, cards, empty, visibility)
- `Views/CreateSmallWorksView.swift` (required fields, Firestore write)
- `Core/WorkAccess.swift` via web `visibleWorks` catalogue `.smallWorks`

## List (“Small works”)
Default filter **Active**.
Stats: Active / Upcoming / Completed.
Search placeholder **Search small works…** matches job number, site name, address, client name.
Chips: All · n, Active · n, Upcoming · n, Completed · n.
Work cards reuse Projects `WorkCard` (staff vs operative compact).
Empty: “No small works found”.
+ New small works if `canManageWorkCatalogue(.smallWorks)`.
Loading: “Loading small works...”

## Create
Nav **New small works**. Copy: “Create a new small works job”.
Writes `organizations/{orgId}/smallWorks/{UUID}` via `serializeProject` with `jobType: "Small Works"`, `manager: "Custom"`, empty `addressLine2` / `description` / client email/phone.

## Desktop
Same as Projects list: stats/search/chips then 2 cols @lg, 3 @2xl.

## Out of this chat
Job tiles on the existing small-works hub (section 16). Map pin sheet stays on the existing form.
