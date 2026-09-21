# 05 — Qualifications

iOS source: `QualificationsManagementView.swift`, `OperativeQualificationsEditorView.swift`, `AssignQualificationsPickerView.swift`, `HomeView.swift` OperativeQualificationsReadOnlyView, `QualificationsAccessPolicy.swift`.

## Access
Org templates: not operative, admin or `qualifications` flag.
Hub: not operative, admin or manager or qualifications flag. Operatives use My Qualifications only.

## Organisation tab
Add name-only templates. `hasEndDate` is always false. Duplicate names are case-insensitive.
Delete template does not remove assignments. IDs are uppercase UUIDs (`setDoc`, not `addDoc`).

Expiry dates live **on assignments**, not templates. They did not delete the org list.

**Why Organisation Qualifications can look empty:** iOS `loadQualifications` skips any doc missing `hasEndDate` as a Bool (or missing timestamps). iOS `saveQualifications` then **deletes the whole collection** and rewrites whatever it loaded. An empty parse plus any save wipes templates while staff profiles still keep `operatives.qualifications[]`. Web load is lenient and, when the org collection is missing names still assigned on staff, **restores those templates** (writes `hasEndDate: false`) so iOS can read them again. Web never delete-all + rewrite.

## My Qualifications
Linked by operative email. Empty / unlinked copy matches iOS. Expiry dates and PDF/JPEG certificates (max 10MB) live on the operative doc maps.

## Desktop
Segmented tabs. List + editor panel. My Qualifications as a card grid.
