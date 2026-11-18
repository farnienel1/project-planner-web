# List signed timesheets frozen with no labour lines (read only)

`scripts/rebuild-empty-timesheet-snapshots.mjs` lists every **not exported** signed timesheet whose signed copy the
rulebook treats as broken (`timesheetSnapshotNeedsRebuild`, 1.43.0: counter-signed before the bookings had loaded, so
the copy holds no labour lines — e.g. Farnie, 1–15 Nov, showing only £195 of price work). It never writes.

There is no `--apply`. The signed copy is built by the web app's own builder (the timesheet collector with pay history,
working hours and schedule options); a separate builder in a script would be a second calculator. Since the 17 Nov
follow-up the app rebuilds these sheets **by itself**, keeping every signature, as soon as a line manager or an admin
opens the Timesheets hub or User Timesheets (and the bookings and pay settings have loaded). Until then the person's own
page shows the figures from their bookings with "Being rebuilt from your bookings — your line manager's next visit saves
it.", and Generate Invoice waits.

## Steps (owner)

1. Open Terminal and go to the web folder: `cd ~/Developer/project-planner-web`
2. Sign in for Google Cloud (once): `gcloud auth application-default login`
3. Run the list for every company: `node scripts/rebuild-empty-timesheet-snapshots.mjs --project project-planner-f986c --all-orgs`
   (or one company: `--org <organisationId>`).
4. You see one line per sheet: organisation, document, person, pay run and how many bookings are in it, then
   "Nothing was written." For each company with lines, ask its line manager or an admin to open Timesheets once.
5. Run step 3 again later: the list should be empty.
