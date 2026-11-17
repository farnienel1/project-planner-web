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
| `notExported_counterSignAgain` | Not exported: the line manager counter-signs again. |
| `exported_revisionDue` | Exported: shows "Revision due". |
| `emptySnapshotRepairedOnOpen` | The signed copy holds no labour line. It is rebuilt when a reviewer opens it (1.43.0); this rule does not apply to it. |
| `signedBefore147_noRecord` | Signed before 1.47.0, so it has no record of the signed bookings. This rule does not apply to it. |

The counts are an upper bound: PAYE days are not excluded, and they rarely appear in a signed record.
