# iOS follow-on — rulebook 1.58.0

Generated 2026-11-17 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.57.0 → 1.58.0
Packed hash: ed36051c3eda321e195501d2ce00f3a1b54b4e6c1e993aaf20aed2277abdefa9
Rulebook sha256: 021d024080428fee353e0a264d42ff8a1e0a6bf0a19638d1ebfa11f9e6e414c8
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
  web lib/canonical/cross-platform-contract.json    → iOS ProjectPlannerTests/CrossPlatformContract.json
  web lib/canonical/data-parity-fixture.json        → iOS ProjectPlannerTests/DataParityFixture.json
Contract sha256: 5b2615b5540b55f716d40617dd791dbcda6290348ef18951186f47e2e5b7cd20
Data-parity fixture sha256: c2db4a64c22f36ddda48453c0d26da28fc802df9c8c93c0d876e8097a9eb176f
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: MATERIAL_BRAND_LEGACY_BLANK, MATERIAL_BRAND_MISSING_TEXT, materialBrandStored, materialBrandText
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/cross-platform-contract.json, lib/canonical/index.ts, lib/canonical/materialCatalogueCsv.ts, lib/canonical/materialQuantity.ts, lib/canonical/materialWhatsApp.ts, lib/canonical/operationsDocuments.ts
Done when:
- [ ] Packed hash in iOS equals ed36051c3eda321e195501d2ce00f3a1b54b4e6c1e993aaf20aed2277abdefa9
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 021d024080428fee353e0a264d42ff8a1e0a6bf0a19638d1ebfa11f9e6e414c8)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.58.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.58.0

- **A missing material brand reads "N/A", not "Custom"** (§28, owner decision 17 Nov; supersedes the 15 Nov "keep 'Custom' for now, tidy later"). New `materialBrandStored`, `materialBrandText`, `MATERIAL_BRAND_MISSING_TEXT` ("N/A"), `MATERIAL_BRAND_LEGACY_BLANK` ("Custom"). Display only on read: a stored blank or "Custom" brand (trimmed, any case) shows "N/A"; new saves with no brand store `''`; a save that leaves the brand blank never rewrites a stored "Custom" or adds a brand field (`materialCatalogueItemWriteFields`, `materialLineWriteFields`). Changed: `parseMaterialCatalogueDocument` brand `''` (was "Custom"), `materialCatalogueItemFields` brand `''` (was "Custom"), `parseMaterialLineDocument` / `materialLineFields` treat "Custom" as none, `materialSendRecordCreateFields` never writes "Custom", `materialWhatsAppRows` never prints it. Web: catalogue list, pickers, send history, wholesalers, the quote / order email (web route and the email function). No migration, no rules change.

## iOS work for 1.58.0

A missing material brand reads **"N/A"**, not "Custom" (rulebook §28 1.58.0, owner decision 17 Nov, before launch). Display only on read; nothing stored is rewritten (guardrail 3). Every rule below is a packed function — call it through `CanonicalBusinessEngine`; keep no Swift copy of the "Custom" / "N/A" rule.

1. **Find every Swift place that defaults a brand**: search the iOS repo for `"Custom"` next to `brand` / `manufacturer` (catalogue model decode, `FirebaseBackend.materialCatalogueItemPayload`, the catalogue editor save, material pickers / Add material suggestions, send sheet, send history, `MaterialRequestEmailClient` payload, WhatsApp text, CSV import / export). Replace the default with the rulebook: saved value `materialBrandStored(brand)` (`''` for blank or the legacy word "Custom", trimmed, any case); shown value `materialBrandText(brand)` ("N/A" when none).
2. **Brand slots show `materialBrandText`**: the catalogue list rows, material pickers / suggestions and any detail row labelled Brand / Manufacturer.
3. **Appended text shows nothing when there is no brand** (`materialBrandStored`, never "Custom"): send history lines, any "· brand" suffix, the WhatsApp text (already `materialWhatsAppRows`).
4. **Saves**: a catalogue item or job material line with no brand stores `''` / no brand (never "Custom"). Use the rulebook writers where iOS already does (`materialCatalogueItemFields`, `materialCatalogueItemWriteFields`, `materialLineFields`, `materialLineWriteFields`): a save that leaves the brand blank keeps a stored "Custom" exactly as stored and adds no brand field — so an edit of another field never rewrites it. If an iOS save builds its own payload, it must not send `brand` when the user left it blank and the stored value is blank or "Custom".
5. **Reader change**: `parseMaterialCatalogueDocument(...).brand` is now `''` for a missing or "Custom" brand (was "Custom"); `parseMaterialLineDocument(...).brand` is `null` for "Custom". Any Swift code that compared with "Custom" must use `materialBrandStored(...) == ""` instead. Cross-platform contract: the iOS catalogue sample now expects `brand: ""`.
6. **Brands count** (if iOS shows one): count distinct non-empty `materialBrandStored` values — "no brand" is not a brand.
7. **Tests**: a stored "Custom" and a missing brand both show "N/A"; "Custom Cables Ltd" shows as typed; a new item with no brand saves `""`; editing the name of an item stored with "Custom" sends no `brand` field.
8. `minimumIosBuild`: not needed (display only; an older build's "Custom" reads as "N/A" everywhere).

## New rulebook sections

- 1.58.0 — 2026-11-17

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
