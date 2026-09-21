# 05 — Qualifications

iOS source: `QualificationsManagementView.swift`, `OperativeQualificationsEditorView.swift`, `AssignQualificationsPickerView.swift`, `HomeView.swift` OperativeQualificationsReadOnlyView, `QualificationsAccessPolicy.swift`.

## Access
Org templates: not operative, admin or `qualifications` flag.
Hub: not operative, admin or manager or qualifications flag. Operatives use My Qualifications only.

## Organisation tab
Add name-only templates. `hasEndDate` is always false. Duplicate names are case-insensitive.
Delete template does not remove assignments. IDs are uppercase UUIDs (`setDoc`, not `addDoc`).

## My Qualifications
Linked by operative email. Empty / unlinked copy matches iOS. Expiry dates and PDF/JPEG certificates (max 10MB) live on the operative doc maps.

## Desktop
Segmented tabs. List + editor panel. My Qualifications as a card grid.
