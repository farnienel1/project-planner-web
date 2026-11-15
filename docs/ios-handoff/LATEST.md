# iOS follow-on — rulebook 1.52.0

Generated 2026-11-15 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.52.0 → 1.52.0
Packed hash: 89ed2e73e674eb68197717533ff4dacfc48131b58d68f96821c10ab0b59c1c3e
Rulebook sha256: 1c2187a83437105a7fbdac33dac8e5bedbec0e87114302d77eef8d84a3037020
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
  web lib/canonical/data-parity-fixture.json        → iOS ProjectPlannerTests/DataParityFixture.json
Contract sha256: 4db6dffac2e60a73653776cec1db4bcdd12cbb2a5f43ab57ff08efc8e8186fcb
Data-parity fixture sha256: c2db4a64c22f36ddda48453c0d26da28fc802df9c8c93c0d876e8097a9eb176f
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: WEEKLY_REPORT_NO_TIMESHEET, WEEKLY_REPORT_PAY_COLUMNS, WEEKLY_REPORT_PERSON_NOT_FOUND, WEEKLY_REPORT_RATE_NOT_SET, WEEKLY_REPORT_TIMESHEET_STATE_LABELS, WEEKLY_REPORT_WARNING_OPEN, bookingPaidDays, leaveRecordsWithoutPerson, payrollPolicyHistoryRows, weeklyReportClashDetail, weeklyReportDatesText, weeklyReportDayKey, weeklyReportDayText, weeklyReportLeaveRows, weeklyReportPayRows
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/payrollHours.ts, lib/canonical/payrollPolicyHistoryRows.ts, lib/canonical/weeklyReportPay.ts
Done when:
- [ ] Packed hash in iOS equals 89ed2e73e674eb68197717533ff4dacfc48131b58d68f96821c10ab0b59c1c3e
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 1c2187a83437105a7fbdac33dac8e5bedbec0e87114302d77eef8d84a3037020)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.52.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.52.0

- **Variation line items** (§22, owner decisions 15 Nov; new `lib/canonical/variations.ts`): new `customLines` (name, description, quantity × cost) and `subcontractorLines` (firm from the Subcontractors list or typed, quote number, cost × quantity) arrays — never fields inside labour or material rows; `parseVariationDocument` reads them (`parseVariationCustomLines`, `parseVariationSubcontractorLines`, `variationLineId` kinds `customLines` / `subcontractorLines`, `variationExtraLineId`); `variationWriteFields` writes each list whole when it changed (`VARIATION_CUSTOM_LINES_WRITE_GROUP`, `VARIATION_SUBCONTRACTOR_LINES_WRITE_GROUP`); `variationCustomLineFields`, `variationSubcontractorLineFields`, `variationCustomLineError`, `variationSubcontractorLineError`. Costs in the organisation currency, for admins and managers (`canSeeVariationCosts`).
- **Labour keeps the crew** (`variationLabourCrew`, `variationLabourLineFields`, `variationLabourText`): `operatives` × `hoursEach` stored beside `hours`; older rows read as one operative. **Material quantity is a number** (`variationMaterialQuantity`, `parseVariationMaterialQuantity`, `variationMaterialLineFields`, `variationMaterialQuantityText`, `variationMaterialQuantityError`, `VARIATION_MATERIAL_UNITS`, `VARIATION_QUANTITY_MAX`): `quantityValue` + `unit` beside the old text; "1-" still reads and shows as stored. The reader's labour and material rows gain `operatives` / `hoursEach` and `quantityValue` / `unit` (cross-platform contract samples regenerated).
- **Totals** (`variationTotals`, `variationListTotals`): labour hours, line counts, custom / subcontractor / total cost, evidence count (the reader's rule); every screen and export uses them.
- **Excel replaces the CSV** (`variationExportRows`, `VARIATION_EXPORT_SUMMARY_COLUMNS`, `VARIATION_EXPORT_LINE_COLUMNS`, `variationExportFileName`, `variationDateText`, `variationPreviousNumbers`, `VARIATION_STATUS_LABELS`): every variation including those with no lines, organisation-zone dates, the unit in its own column, a totals row, previous VO numbers. Web writes the .xlsx itself (company logo in a drawing part) with `fflate`; the weekly report Excel is unchanged. The web-only `variationsToCsv` is removed.
- **The VO tracker** (`variationRenumberPlan`, `variationIsPinned`, `variationRenumberConflict`, `VARIATION_RENUMBER_STALE_MESSAGE`, `VARIATION_PINNED_MESSAGE`, `canRenumberVariations`): replaces web's `previewRenumber`; Submitted / Closed (and locked numbers) are pinned and can still be removed; a number ever issued — including a deleted variation's — is never handed out again; computed from the stored documents in a transaction that refuses when the variations changed; the settings copies get the new numbers too; admins and the job's managers. Web: a full-screen tracker with in-place editing (heading, status, description), live numbers while dragging, saved on drop, ↑ ↓ for keyboard users, totals bar, status filter, a local Lock order switch. The "Renumber everything" mode is no longer offered.
- **Evidence** (`variationEvidenceAddWriteFields`, `VARIATION_EVIDENCE_MAX_FILES`): web uploads after the variation is saved (the sheet closes at once), with progress, cancelled on a 60-second stall or after 5 minutes, linked in one transaction (tried twice), the real content type / name / size stored, and uploaded files deleted again when they cannot be linked; a removal is recorded before the file is deleted; partial save failures are shown (the variation document is written first, then its two settings copies).
- **New variations** take `sequence` one past the highest stored position (was the live count + 1); numbers stay `nextVariationNumber`.
- **Dates** on the variation screens are the organisation zone.
- **Web Variations page restyle** (owner, UI only): status tiles that filter, a labour-hours tile and a total-cost tile (staff), filter tabs with counts, rows with VO number, heading, description, status pill, hours, material / custom / subcontractor counts, cost, a paperclip evidence count (no red "None"), raised by and date, "was VO-00x"; Open VO Tracker and Export Excel buttons.
- **Security rules** (§16): `variations/{id}` — `voNumber` / `sequence` changes only by admins or the job's managers, pinned numbers never change; `variationTrackers` — admins and the job's managers; no hard delete of `settings/variations_*` / `variationItem_*`. **Storage** (§24): variation evidence is staff only; the member-wide health & safety match leaves the variation folders out. Static compile cost 234,098 → 235,456; emulator type check 0 issues; no new 1,000-expression refusals.

## iOS work for 1.52.0

**Sync first.** 1.52.0 (owner decisions 15 Nov): **variations** — Custom and Subcontractor line items, totals, an Excel export with the company logo, the VO tracker (pinned Submitted / Closed, never reusing a number), evidence fixes, numeric material quantity, labour crew. Rulebook §22 (rewritten), §16 and §24.
- **Rules change.** The owner publishes `firestore.rules` and `storage.rules` **after** `minimumIosBuild` is raised to the iOS build that ships this hand-off. After that publish: a VO number or `sequence` change on an existing variation is refused unless the writer is an admin or a manager of that job; a Submitted / Closed / locked VO never changes its number (anyone); staff can no longer hard-delete `settings/variations_*` / `variationItem_*`; operatives can no longer upload or read variation evidence in Storage.
- **Not changed:** no index or Functions change; nothing migrated. Older documents read as before (labour = one operative × hours; material text parsed, or kept as stored when it is not a number).
- **Base:** web `origin/main` 1.50.0 + this PR; iOS `origin/main` `1571142` (1.47–1.48). Line numbers are from that iOS commit — check them on your branch.

1. **Sync.** `WEB_REPO=<web worktree> bash scripts/sync-rulebook-from-web.sh`, commit the mirrored files and `ProjectPlannerTests/CrossPlatformContract.json`.
2. **Model** — `Project Planner/Models/VariationModels.swift`:
   - `VariationLabourLine` gains `operatives: Int` and `hoursEach: Double` (from the reader's `operatives` / `hoursEach`; `hours` stays = operatives × hoursEach). `VariationMaterialLine` gains `quantityValue: Double?` and `unit: String` (reader). New `VariationCustomLine { id, name, description, quantity, cost }` and `VariationSubcontractorLine { id, subcontractorId, name, quoteNumber, quantity, cost }`; `Variation` gains `customLines` / `subcontractorLines` (reader `customLines`, `subcontractorLines`).
   - `VariationCodec.firestoreMap`: write labour with `CanonicalBusinessEngine.variationLabourLineFields` **only for a line the user added or changed** (an untouched old line stays `{id, trade, hours}`), materials with `variationMaterialLineFields` likewise (untouched old lines keep `{id, name, quantity}` exactly), and `customLines` / `subcontractorLines` with `variationCustomLineFields` / `variationSubcontractorLineFields`. They are separate arrays — never add fields to labour / material rows other than these.
   - `recomputeCounts()` (~line 145): take the three counters from `CanonicalBusinessEngine.variationTotals` (`labourHours`, `materialsCount`, `evidenceCount`). Today it counts evidence only when `downloadURL` is not empty, while the reader counts a storage path **or** a URL — a mismatch.
3. **Editor** — `Views/Variations/VariationEditorSheet.swift`:
   - Load the crew from the line (`LabourDraft(operatives: line.operatives, hoursEach: line.hoursEach)`, ~214), not `operatives: 1, hoursEach: hours`.
   - Material quantity: a number field + the unit picker (`no`, `m`, `box`, `kg`, `VARIATION_MATERIAL_UNITS`); refuse with `variationMaterialQuantityError` on add / update. A stored text that is not a number ("1-") is shown as stored and only asked for a number when the line is edited.
   - Add **Custom items** (name, description, quantity, cost each in the organisation currency, line total) and **Subcontractors** (pick from the organisation's `subcontractors` or type the name; quote number; cost; quantity; line total) sections, checked with `variationCustomLineError` / `variationSubcontractorLineError`; money with `formatMoney` and `resolveOrganizationCurrency`. Costs only for `canSeeVariationCosts` (admins, managers).
   - **VO number not editable after create**: disable the VO number button (~407–423) when editing an existing variation (and always when Submitted / Closed / locked). New variations keep `nextVariationNumber`; `sequence` stays max + 1 (~1650, already right).
4. **Evidence** — `Core/FirebaseBackend+Variations.swift`:
   - **Delete the `application/octet-stream` retry** (~531–533): one upload with the type from `uploadAllowed`.
   - **Never store `gs://`** (~576): if `downloadURL()` fails, retry it (bounded), else fail the upload and delete the object you just uploaded (you are its uploader inside the 15-minute undo window). Store the storage path in `storagePath` always.
   - **A timeout** on each upload task (cancel the `StorageUploadTask` after 60 s without progress or 5 minutes in all), with progress shown and the real error message.
   - **10 MB cap**: `Core/StorageUploadPolicy.swift` `variationMaxBytes` is still `20 * 1024 * 1024` (~line 40) — use `UPLOAD_ALLOWED_TYPES.variation_evidence.maxBytes` (10 MB, 1.50.0).
   - Link uploaded files with `CanonicalBusinessEngine.variationEvidenceAddWriteFields(stored, entries)` in a transaction on `variations/{id}` (then the `variationItem_{id}` copy and the log), store the real content type, name and size of what was uploaded, and delete the uploaded objects again when the link fails.
   - Removal: keep "record first, then delete the object" (already so).
5. **Totals and list** — `Views/Variations/VariationsListView.swift`: hours, counts, cost (staff) and the evidence count from `variationTotals` / `variationListTotals`; a paperclip with the count instead of a red "None"; "was VO-00x" from `variationPreviousNumbers`; dates with `variationDateText(ms, organizationTimeZone)` (organisation zone, never the device). `VariationDetailView.swift`: show the new line kinds, `variationLabourText`, the material quantity text.
6. **Excel export** — build the rows with `CanonicalBusinessEngine.variationExportRows(variations, { timeZone, currency, includeCost })` (every variation not removed, with or without lines; `summaryRows` + `summaryTotals`, `lineRows`) and the file name `variationExportFileName`. Draw the .xlsx like `Core/WeeklyReportExportBuilder.swift` (hand-built OOXML), with two sheets "Variations" and "Line items", the header block (company, job number and name, generated by / at in the organisation zone) and **the company logo as a drawing part** (`xl/drawings/drawing1.xml` with a `oneCellAnchor` `pic`, `xl/drawings/_rels/drawing1.xml.rels` → `../media/image1.png|jpeg`, `xl/worksheets/_rels/sheet1.xml.rels` → the drawing, `<drawing r:id="rId1"/>` in sheet1, content types for `drawing+xml`, `png`, `jpeg`). Money cells with the currency number format; every text cell an inline string. Web's builder is `lib/variations/variationWorkbook.ts` — copy its parts. Share with the share sheet.
7. **Tracker (read-only)** — `Views/Variations/VariationTrackerReadOnlyView.swift`: show the order and numbers from `variationRenumberPlan({ rows: <every stored variation incl. deleted>, order: <ids by sequence> })`, pinned rows marked (`variationIsPinned`), totals from `variationListTotals`, "was VO-00x". iOS has no drag and **no hard delete** of variations or their settings copies (soft delete only, `isDeleted`).
8. **Tests** (`ProjectPlannerTests/VariationLogicTests.swift`): through the engine — `variationTotals` on a variation with custom and subcontractor lines; `variationMaterialQuantity` for "100m", "1-"; `variationLabourCrew` for `{hours: 8, operatives: 2, hoursEach: 4}` and `{hours: 8}`; `variationRenumberPlan` with a deleted VO-004 and a submitted VO-002; `variationExportRows` row counts. Update `CrossPlatformContractTests` if the iOS variation sample now carries the crew / number fields.

## New rulebook sections

- 1.51.0 — 2026-11-15

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
