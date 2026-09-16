# 09 — Clients

> iOS source of truth. Desktop-first (Blueprint §3.3 master–detail).

## Evidence
- `Views/ClientsView.swift` (ClientsView, ClientCardView, ClientDetailsView)
- `Views/CreateClientView.swift`
- `Views/EditClientView.swift`
- `FirebaseBackend.swift` `saveClient` ~L1696, `loadClients` ~L1743, `deleteClient` ~L1788
- `Core/ProjectStore.swift` `addClient` ~L792, `updateClient` ~L810, `deleteClient` ~L818
- `Core/NotificationService.swift` `notifyClientCreated` ~L368
- Screenshots: none in `docs/ios-parity/screenshots/clients/` (Q12)

## Access
Not operatives (`canViewClients`). Entry: Main Menu, Home quick action, `client_created` notification.

## List (“Clients”)
Toolbar: Done (web: sidebar back), **New Client**.
Empty: 60pt `person.2.fill`, “No Clients Added Yet”, “Add clients to your organisation. Clients are the companies or individuals you work for.”, **Create Client**.
Cards: name bold; email + blue envelope; phone right + green phone; address + orange pin, 2 lines. White, radius 12, light shadow.
Tap → detail.

## Detail (“Client Details”)
Toolbar: Done, **Edit**.
Info card: large name, then email/phone/address.
**Projects ({n})**: `WorkAccess.visibleWorks` of jobs whose `client.id` matches. Jobs keep their own embedded client copy — `updateClient` does **not** rewrite jobs (`ProjectStore.swift:810`).

## New Client
Title “New Client”. Cancel. Section “Client Information”: Client Name, Email (`emailAddress`, no autocap), Phone (`phonePad`), Address.
Required: name trimmed non-empty.
**Create Client** (disabled if invalid). Success alert “Client Created” / “Client '{name}' has been created successfully!” / OK.
Write: `organizations/{orgId}/clients/{UUID uppercase}` with keys `id,name,contactPerson,email,phone,address,organizationId,createdAt,updatedAt` (empty strings). Then `client_created` notification.

## Edit Client
Same fields. **Save Changes**. **Delete Client** (red). Confirm “Delete Client” / “Are you sure you want to delete {name}? This action cannot be undone.” Cancel / Delete.
**Only admins can delete** (blueprint + rules).

## Desktop
≥1280: 400px list + detail. URL `/dashboard/clients/{id}`. Jobs as work-card grid.
1024: stacked pages. 390: iOS-like cards.

## Cross-platform test
Create on web → iPhone list. Edit address on iPhone → web detail. Delete as admin only.
