# 04 — Job Types

iOS source: `Views/JobTypesManagementView.swift`, `Core/ProjectStore.swift` `addJobType`/`removeJobType`, `FirebaseBackend.swift` ~2080.

## Access
Admin only (`hasAdminAccess`). Title **Job Types Management**.

## UI
Empty: “No Job Types Added Yet”, helper + recommended CAT A/B copy, **Add Your First Job Type**.
List: purple folder + name, A–Z. Delete from the row menu.
Add: “Add New Job Type”, field **Job Type Name** (`e.g., Renovation, New Build, Repair`), **Create New Job Type**.
Errors: empty / already exists (case-sensitive exact match).

## Data
`organizations/{orgId}/settings/jobTypes` overwritten (`jobTypes[]`, `organizationId`, `updatedAt`). No merge.

## Desktop
Centred card max 720px.
