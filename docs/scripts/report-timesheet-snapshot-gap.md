# Dry run: timesheets 1.57.0 will read as changed

**Read-only.** Prints counts only. It never writes anything.

## Why

Rulebook 1.57.0 (#363) reads a signed timesheet as changed when its signed copy is missing a booking the person signed and that booking is still live. Before 1.57.0, web counter-signed without the person's same-email users ids, so this is the usual cause.
- **Not exported:** the sheet goes back to the line manager to counter-sign again.
- **Exported:** the sheet shows "Revision due".

This dry run says how many sheets each organisation has in each group, before the owner decides what to do.

## Steps (Terminal, `~/Developer/project-planner-web`, on the #363 branch)

1. Sign in for Google Cloud once (it opens a browser):
   `gcloud auth application-default login`
2. Run it for every organisation:
   `node scripts/report-timesheet-snapshot-gap.mjs --project project-planner-f986c --all-orgs`
   For one organisation instead: `--org <orgId>` in place of `--all-orgs`.
3. You should see one line per organisation, then a `TOTAL` line, then `Nothing was written.`

## Columns

| Column | Meaning |
|---|---|
| `sheetsChecked` | Signed sheets with a signed copy (latest version of each pay run). |
| `notExported_counterSignAgain` | Not exported, with a gap: the line manager counter-signs again. |
| `exported_revisionDue` | Exported, with a gap: shows "Revision due". Empty exported copies are here too: the 1.43.0 repair never runs on an exported sheet. |
| `ofWhichGapOnly_reportsKeepSigned` | Of the two above, sheets whose only change is the gap. Under J1 (built), the weekly report and Payrun Snapshot keep their signed figures until the revision is signed. |
| `alreadyFlaggedBefore157` | Changed already before 1.57.0: a booking was changed, removed or added after signing. Not this rule's doing. |
| `emptySnapshotRepairedOnOpen` | Not exported, no labour line, and a booking written before approval. The rule's own repair (`timesheetSnapshotNeedsRebuild`) rebuilds it when a reviewer opens it. |
| `signedBefore147_noRecord` | Signed before 1.47.0, so there is no record of the signed bookings. This rule does not apply. |

The counts are an upper bound:
- PAYE days are not excluded; they rarely appear on a signed record.
- Only the person's signed bookings are read as live lines. Another booking in the pay run could make an empty copy repairable, and that copy is counted as flagged here.
