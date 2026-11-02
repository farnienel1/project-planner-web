# iOS follow-on — rulebook 1.6.0

Generated 2026-11-02 by `npm run rulebook:handoff` in project-planner-web. Paste this whole file into the iOS agent.
The web repo copy of `docs/RULEBOOK.md` is canonical. iOS mirrors it exactly; never edit the iOS mirror by hand.

```
╔══════════════════════════════════════════════════════════════════╗
║ FOLLOW-ON — paste into the iOS agent                             ║
╚══════════════════════════════════════════════════════════════════╝
Started on: web
Rulebook version: 1.5.0 → 1.6.0
Packed hash: c634b3b968517740cc2d31d8b1ba1865b8936551c215b058054a688cf1e45e40
Rulebook sha256: 09fae38de0665717df64b08e87263556bb1be42e9fc3eceb12dc7b947d6081af
Copy (do not edit by hand) — run scripts/sync-rulebook-from-web.sh in the iOS repo, which copies:
  web lib/canonical/dist/canonical-business.js      → iOS Project Planner/Canonical/canonical-business.js
  web lib/canonical/dist/canonical-business.sha256  → iOS Project Planner/Canonical/canonical-business.js.sha256
  web lib/canonical/dist/canonical-manifest.json    → iOS Project Planner/Canonical/canonical-manifest.json
  web docs/RULEBOOK.md                              → iOS docs/RULEBOOK.md
  web lib/canonical/parity-fixture.json             → iOS ProjectPlannerTests/CanonicalParityFixture.json
Call: CanonicalBusinessEngine — no second calculator in Swift.
Exports added: DEFAULT_ANNUAL_LEAVE, EMPLOYMENT_WRITE_GROUP, LINE_MANAGER_WRITE_GROUP, PAY_WRITE_GROUP, ROSTER_DOCUMENT_KEYS, ROSTER_NAME_WRITE_GROUP, USER_DOCUMENT_KEYS, USER_NAME_WRITE_GROUP, clientWriteFields, defaultTimesheetsEnabled, documentBool, documentInstantMs, documentNumber, documentValueKey, documentWriteFields, managerRowWriteFields, normalizeUserRoleToken, operativeRowWriteFields, parseAnnualLeaveDefaults, parseClientDocument, parseManagerDocument, parseOperativeDocument, parsePayRateHistoryDocument, parsePayRateHistoryDocuments, parseSkillDocument, parseSubcontractorDocument, parseUserDocument, skillsCatalogueWrites, subcontractorWriteFields, userProfileWriteFields
Exports removed: none
Web files that changed the rules: docs/RULEBOOK.md, lib/canonical/bundleEntry.ts, lib/canonical/canonical.test.ts, lib/canonical/index.ts, lib/canonical/peopleDocuments.ts
Done when:
- [ ] Packed hash in iOS equals c634b3b968517740cc2d31d8b1ba1865b8936551c215b058054a688cf1e45e40
- [ ] iOS docs/RULEBOOK.md is byte-identical (sha256 09fae38de0665717df64b08e87263556bb1be42e9fc3eceb12dc7b947d6081af)
- [ ] RulebookParityTests pass (CanonicalBusinessEngine.rulebookVersion() == 1.6.0)
- [ ] Every Swift caller of a changed rule calls CanonicalBusinessEngine
- [ ] Same Firebase fields read and written as web
- [ ] Any disagreement traced to its first divergence — no copied screen number
```

## What changed in 1.6.0

- One reader per people collection (§1): `parseUserDocument` (`users/{uid}`), `parseOperativeDocument`, `parseManagerDocument`, `parsePayRateHistoryDocument` / `parsePayRateHistoryDocuments`, `parseClientDocument`, `parseSubcontractorDocument`, `parseSkillDocument`, with `documentInstantMs`, `documentBool`, `documentNumber`, `normalizeUserRoleToken`, `USER_DOCUMENT_KEYS`, `ROSTER_DOCUMENT_KEYS`. Ids are the document id in stored case: iOS randomised or upper-cased non-UUID `operatives` ids and dropped non-UUID `clients` and `operativeDayRateHistory` rows. `users/{uid}` and `operatives` leave the known-gaps list.
- An hourly `operatives` / `managers` row is hourly on every platform (iOS read `dayRate ?? hourlyRate` and ignored `payBasis`) (§8).
- Missing user leave fields take the organisation `annualLeaveDefaults` (iOS used 25 / 1 / 12) (§4.4, §8). Missing `timesheetsEnabled` is `defaultTimesheetsEnabled`: operatives and self-employed on, PAYE managers and admins off (web read off) (§8).
- An admin with a stray `operativeMode` flag stays an admin on lists; the approval rules keep reading the stored flag (`adminOutsideOperativeMode`) (§8).
- Partial writes for people (§1, §11): `documentWriteFields`, `userProfileWriteFields`, `operativeRowWriteFields`, `managerRowWriteFields`, `clientWriteFields`, `subcontractorWriteFields` → `{ set, remove }`; a field the stored copy lacks is never deleted; line manager ids with `hasNoLineManager`, pay basis with both rates and employment type with its transition are written together. Web Operative / Manager forms no longer overwrite the whole `users/{uid}` document and web roster, client and subcontractor saves are partial updates. The skills catalogue is saved with `skillsCatalogueWrites` (no delete-all and rewrite).
- Still each app's own reader (known gaps): `settings/jobTypes`, `settings/tradeTypeInventory`.

## New rulebook sections

- 1.6.0 — 2026-11-02

## Workflow for the iOS agent

1. Run `scripts/sync-rulebook-from-web.sh` (or copy the files above), then run the iOS tests.
2. Produce a numbered Gap Report (Finding / Evidence / Rule / Severity / Solution / Action) for the changes above and **stop**.
3. Implement only what the user approves, in the iOS repo only.
4. Report any web-side gap back to the web agent instead of diverging on iOS.
