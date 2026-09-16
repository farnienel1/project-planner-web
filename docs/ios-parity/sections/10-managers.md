# 10 — Managers

## Evidence
- `Views/ManagersView.swift` (roster = manager users, not admins)
- `Views/CreateManagerView.swift` (catalogue `organizations/{orgId}/managers/{UUID}`)

## List (“Managers”)
Segments Active / Inactive / Pending. Default Active.
Who: `permissions.manager` and not `operativeMode` and not `adminAccess` and not `isSuperAdmin`.
Row: name, email, mobile, trade, Pending/Inactive.
Tap → `/dashboard/users/{id}?from=managers`.
+ (admin) → Create manager catalogue record.

## Create (catalogue)
First/Last *, Email *, Mobile *, Trade type *, Department optional, Notes optional.
Writes `mobileNumber` (not `mobile`), empty strings for optional blanks.

## Do not
Do not treat the `managers` collection as the login roster.
Picker screens still use `getManagerUsers` (includes admins) so jobs can assign admin users.
