# 06 — Wholesalers

iOS source: `WholesalersRevampViews.swift`, `WholesalersView.swift`, `FirebaseBackend.swift` wholesaler save merge.

## Access
Admins and managers. History also needs `wholesalersOrderHistory` for managers.

## List / detail
Search name, trade, city, contacts. Cards show PRIMARY. Master–detail at ≥1280 (`/dashboard/wholesalers/{id}`).
Editor requires name + at least one named email contact. Delete confirm copy matches iOS.
History: Quotes/Orders, materials-day filter, material search. Each send shows **line items** (name, qty/unit, brand, code) like iOS, not only “N items”.
Load is lenient: missing timestamps no longer hide a wholesaler.

## Data
`organizations/{orgId}/wholesalers/{UUID}` `setDoc` merge. Send history from `materialSendRecords`.
