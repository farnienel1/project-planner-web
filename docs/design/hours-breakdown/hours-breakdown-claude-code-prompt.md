# Claude Code prompt (1 of 2, WEB APP): simplify the hours breakdown text (UI only)

> This prompt is for the **web app repo only**. The iOS app has its own prompt (2 of 2); don't touch iOS here.

**Repo:** `project-planner-web`. The screen is the "Change this booking" modal (and Book labour, if it shares the same component): the summary under the timeline and the **Hours breakdown** box.

> **READ FIRST: this is a wording and layout change only.**
> - No calculation, rule, saved value, toggle, rate, picker, validation or Save behaviour changes.
> - Every number shown must come from the **existing calculation output** (`lib/canonical`). Add **no** new arithmetic in the UI; `npm run check:calculators` must stay green.
> - If a value the new text needs isn't already provided by the calculation, **stop and tell me**. Don't work it out in the component.

## Files

Put `hours-breakdown-ui-reference.html` (attached) in `docs/design/hours-breakdown/`. Open it in a browser:
- the **"After"** column is what to build;
- the **"Before"** column is today's screen;
- the first row of dashed "PREVIEW ONLY" pills switches between example bookings;
- the second row switches **Light mode / Dark mode**;
- **Don't build either row of pills.**

## The new text

1. **Under the timeline,** replace the three explanation lines (the "06:00–17:30 · 12.25 hours" line, the amber overtime sum, and the long paragraph) with **one line**:
   `{start}–{finish} · **{totalPaid} paid hours**`
2. **Hours breakdown box,** in this order:

   | Row | Label | Detail line(s) | Value | Shown when |
   |---|---|---|---|---|
   | Header | "HOURS BREAKDOWN" | `{Day}, {day type}`, e.g. "Tuesday, full day" | — | always |
   | Normal | "Normal hours" | `{normalStart}–{normalEnd}` + `, less {n} min break` if the break is taken | `{normalPaid}h` | there are normal hours |
   | Overtime (amber card) | "Overtime" | the overtime ranges joined with " and ", then `{overtimeHours}h at ×{rate}` | `{overtimePaid}h` | there is overtime |
   | Total | "Total paid hours" | — | `{totalPaid}h` (large) | always |

3. **Remove** the old "Working hours / Normal working hours / Minus 30 minute break" rows, the amber "= 2.5 × 1.5 = 3.75" sum, and the long explanation paragraph at the bottom. **Remove nothing else.**
4. **Number format:** up to 2 decimals, trailing zeros dropped (8.5h, 3.75h, 12h), the same formatter the app already uses for hours if there is one.
5. **Layout:** match the reference.
   - Label on the left, figure right-aligned, tabular figures.
   - Detail text muted and wrapping.
   - **Nothing overflows** at 1440, 1024 or 390px, in light **and** dark mode.
   - Same colours and tokens as the modal today.

## Light mode AND dark mode (both required)

The web app has light and dark themes. The new breakdown must look right in **both**. Check both modes in the reference.

- Use only the app's **existing theme tokens / CSS variables** for every colour: card, inner panel, borders, text, muted text, and the amber overtime tint, text and border. **No hard-coded hex colours** in the component.
- **Light mode:** white modal, light grey-blue breakdown panel, dark text, and an amber-tinted overtime card with dark amber text.
- **Dark mode:** navy modal and panel, light text, muted grey-blue detail text, and an amber-tinted overtime card with light amber text.
- Text contrast must be at least 4.5:1 in both modes, including the muted detail lines and the amber overtime text.
- Switching theme while the modal is open updates the breakdown straight away, the same way the rest of the modal does today.

## How to work

### Phase 1: Inspect, then stop. No edits.
1. Find the component(s) that render the summary line and the Hours breakdown, and every screen that uses them (Change booking, Book labour, any others).
2. List the calculation fields they already receive. Map each value in the table above to an existing field: normal paid hours, break minutes, overtime ranges, overtime hours, rate, overtime paid hours, total. Flag any value that isn't already provided.
3. List the day types and variants that exist (full day, weekend, bank holiday, half day, day-rate staff, custom booking…) and how each would read with the new rows.

**Stop and wait for my approval.**

### Phase 2: Build
Change only the presentational markup and copy. Keep the props and data flow the same.

### Phase 3: Verify and report
1. **Tests** for each variant in the reference: weekday with overtime, no overtime, break off, Saturday/all overtime, a ×2 rate, plus any extra variant Phase 1 found. Each test checks:
   - which rows show;
   - the exact text;
   - that **Normal paid + Overtime paid = Total paid** using the existing values (it must hold for every variant).
2. **Same result:** save the same booking before and after the change. The Firestore booking documents and the Daily overview, Weekly report and timesheet figures must be identical.
3. Run `npm run lint`, `npm test`, `npm run build` and `npm run check:calculators`. All must pass at least as before, with no tests skipped or weakened.
4. **Report:** screenshots before and after at 1440 and 390px for each variant, **in light mode and in dark mode**, plus a note confirming that no hard-coded colours were added, the files changed, and any **Decision needed**.

Begin with Phase 1.
