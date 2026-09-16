# 11 — Operatives

## Evidence
- `Views/OperativesView.swift` (Active/Inactive/Pending, search, roster = `AppUser` with `operativeMode`)
- `Views/OperativeProfileView.swift` (tap row → user profile)
- `Views/CreateOperativeView.swift` (operative catalogue doc)
- `Core/OperativeStore.swift`

## List (“Manage Operatives”)
Segments Active / Inactive / Pending. Default Active.
Search: **Search operatives by name** — token match on first, surname, full name, email, phone.
Source of truth: **users** with `permissions.operativeMode`, linked to `operatives` by email.
Row: initials, name, email, Pending/Inactive chips.
Tap → `/dashboard/users/{id}?from=operatives` (iOS `EditUserView`).
+ → Create Operative (`organizations/{orgId}/operatives/{UUID}`).

## Create
Fields: First Name *, Surname *, Email *, Phone *, Trade type *, Day Rate (Optional).
Duplicate first+last blocked.
Writes empty strings for phone/notes/trade blanks, `currencySymbol: "£"`, uppercase UUID.

## Do not
Do not list from the operatives collection alone.
Do not put employment type on the operative doc (it lives on `users/{uid}`).
