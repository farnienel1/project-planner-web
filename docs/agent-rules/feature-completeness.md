# Feature completeness: nothing drops off

Rule 0 says each business rule is written once, in `lib/canonical`. This file makes sure every screen actually uses it and no owner decision gets lost between sessions. It applies to every feature, fix and rule change on web and iOS. Pure visual touch-ups are the only exception (`ui-touch-up.md`).

## Before you call a change done

1. **Find every call site, not just the one you were shown.**
   - Search both repos for everything that computes or shows the same thing: screens, stores, hooks, exports, PDFs, notifications, Cloud Functions, scripts, tests.
   - Search by the *concept* as well as the function name. For unbooked labour, for example, search "unbooked", weekday checks (`weekday < 1`, `getDay`, `isWeekend`), London or device time-zone helpers, hour arithmetic, role filters.
   - List the results in the PR under **Call sites** as a table: path → `rulebook function ✓` or `own calculation ✗ (fixed here / follow-up)`.
   - An `✗` left in place needs a stated reason and a follow-up entry (step 5).
2. **Follow every way in.**
   - If a feature is reachable from more than one place, open each one. That includes a warning's action button, a notification, a Home tile, Daily Overview, a deep link and the iOS equivalent.
   - The destination must show the same people, rows and figures as the place that linked to it. Example of a failure: a warning lists 2 unbooked people and its "Book labour" button shows "Everyone is booked".
   - Say in the PR which ways in you checked.
3. **Check both platforms.**
   - For every rule touched, name the web file and the iOS file that call it.
   - If iOS is not changed in this PR, put the exact iOS work in the hand-off (`docs/ios-handoff/LATEST.md`) and in the PR's 3-factor table.
4. **Account for every owner decision.**
   - Every decision the owner gave for this work is restated in the PR's **Decisions** table with ✓ done / ✗ not done.
   - Where you had to choose because a decision was ambiguous, list the choice for the owner to confirm. Never drop or reinterpret a decision silently.
5. **Never let a finding vanish.**
   - Anything you found but did not fix goes in the PR's **Not done / follow-ups** list.
   - The session lead copies it into the launch checklist or the owner decisions log.
   - "Out of scope" is fine; "not mentioned" is not.
6. **Say what you did not check.** List it: no browser run, no device build, no production data, emulator only. Tag claims [Certain], [Likely] or [Guessing].

## Guard rails in code

- `scripts/check-second-calculators.mjs`, when present, runs in CI. It fails when code outside `lib/canonical` re-derives a rule the rulebook owns: own weekend cut-offs, London-only date helpers in screens, private unbooked or overtime maths.
- Do not silence it. Either call the rulebook function, or add the file to its allow-list with a one-line reason the reviewer can challenge.
- When you remove a second calculator, delete its dead helpers in the same change, so they cannot be called again.

## PR body

- Start every PR from `.github/pull_request_template.md` (GitHub fills it in). Its sections: Summary, 3-factor (Web / iOS / Shared rule rows), Owner decisions (rows from `docs/OWNER_DECISIONS.md`), Call sites, Ways in checked, Screen map rows updated (`docs/SCREEN_MAP.md`), Deploy needed, minimumIosBuild needed, Not done / follow-ups, What I did NOT check, and the checklist below.
- CI enforces it: `.github/workflows/pr-checklist.yml` runs `scripts/check-pr-body.mjs` on every PR open, edit and push. It fails when the 3-factor table (with Web, iOS and Shared rule rows), Owner decisions, Call sites, Deploy needed, Not done or What I did NOT check is missing or left empty. Write "none" or "n/a" rather than deleting a heading.
- Docs-only escape: when every changed file is under `docs/` or `.github/`, or is a `.md` file, only the 3-factor table and What I did NOT check are required.
- Every PR that touches a screen updates its row in `docs/SCREEN_MAP.md` (steps 1–2) and names the rows under **Screen map rows updated**.
- Check a body locally: `PR_BODY="$(cat body.md)" node scripts/check-pr-body.mjs --files <comma-separated paths>`.

## PR body checklist (copy it in)

```
- [ ] Call sites table (both repos), every ✗ fixed or listed as follow-up
- [ ] Every way in opened and matched (list them)
- [ ] Web file + iOS file named per rule; iOS hand-off updated if iOS not in this PR
- [ ] Decisions table: every owner decision ✓/✗, judgement calls listed
- [ ] Not done / follow-ups listed
- [ ] What I did NOT check
```
