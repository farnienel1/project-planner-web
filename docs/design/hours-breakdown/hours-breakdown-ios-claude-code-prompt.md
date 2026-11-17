# Claude Code prompt (2 of 2, iOS APP): simplify "How the hours add up" on Edit booking (UI only)

> This prompt is for the **iOS app repo only**. The web app has its own prompt (1 of 2); don't touch the web repo here.

**Repo:** `project-planner-ios`. The screen is **Edit booking** (and Custom booking or any other screen that shows the same "How the hours add up" card). It covers **only the card at the bottom of the Hours section**.

> **READ FIRST: this is a wording and layout change only.**
> - Leave all of these exactly as they are:
>   - the header band ("This booking at a glance");
>   - the timeline;
>   - the time pickers;
>   - the Unpaid break toggle;
>   - the Overtime rate chips;
>   - "More rates";
>   - the Save button;
>   - every calculation, saved value and the offline behaviour.
> - Every number shown must come from the **existing calculation output** (the canonical bundle / rulebook functions the card already uses). Add **no** new arithmetic in the view.
> - If a value the new text needs isn't already provided, **stop and tell me**. Don't work it out in SwiftUI.

## Files

Put `hours-breakdown-ios-reference.html` (attached) in `docs/design/hours-breakdown/`. Open it in a browser:
- the **"After"** column is what to build;
- the **"Before"** column is today;
- the first row of dashed "PREVIEW ONLY" pills switches between example bookings;
- the second row switches **Light mode / Dark mode**;
- **Don't build either row of pills.**

The web app is getting the same text (`hours-breakdown-claude-code-prompt.md`), so both platforms read the same.

## The new card

| Row | Label | Detail line(s) | Value | Shown when |
|---|---|---|---|---|
| Header | "HOW THE HOURS ADD UP" | `{Day}, {day type}`, e.g. "Wednesday, full day" | — | always |
| Normal | "Normal hours" | `{normalStart}–{normalEnd}` + `, less {n} min break` if the break is on | `{normalPaid}h` | there are normal hours |
| Overtime (amber-tinted row) | "Overtime" | ranges joined with " and ", then `{overtimeHours}h at ×{selected rate}` | `{overtimePaid}h` | there is overtime |
| Total | "Total paid hours" | — | `{totalPaid}h` (large, bold) | always |

**Remove:**
- the long sentence ("Wednesday full day: … hours outside it at 1.5×");
- the "06:00–07:00 = 1h × 1.5 = 1.5h / + … / → 12.25h" lines.

Nothing else is removed.

**Rules:**
- The total must equal the figure on the **Save · {n} hours** button. Both read the same existing value.
- Changing the Overtime rate chip or the break toggle updates the card live, exactly as the current text does today.
- Number format: 2 decimals max, trailing zeros dropped, using the app's existing hours formatter.

**Styling:** keep the current dark card (same background, corner radius and padding).
- Label left, figure right, monospaced digits (`.monospacedDigit()`).
- Muted secondary text for the detail lines.
- The overtime row uses the existing amber/overtime colour at low opacity.
- **Dynamic Type:** detail text wraps and figures never truncate. Check at the largest accessibility size.
- VoiceOver reads each row as one element, e.g. "Overtime, 6 to 7 and 16:00 to 17:30, 2.5 hours at 1.5 times, 3.75 hours".

## Light mode AND dark mode (both required)

The iOS app supports light and dark appearance. The new card must look right in **both**. Check both modes in the reference.

- Use only the app's **existing theme colours** (the same semantic colours / asset-catalog colours the Edit booking sheet uses today) for:
  - the card background, border, primary and secondary text;
  - the amber overtime tint, text and border.
- **No hard-coded `Color(red:…)` or hex values** in the view.
- **Dark mode:** dark card, white text, grey detail text, and an amber-tinted overtime row with bright amber text.
- **Light mode:** white card on the light sheet, near-black text, grey detail text, and an amber-tinted overtime row with **darker amber text** so it stays readable on white.
- Text contrast must be at least 4.5:1 in both modes, especially the amber overtime text in light mode.
- Switching appearance (Control Centre or Settings) while the sheet is open updates the card straight away.

## How to work

### Phase 1: Inspect, then stop. No edits.
1. Find the view that renders "How the hours add up" and every screen that uses it.
2. List the calculation values it already receives. Map each value in the table to an existing field and flag anything missing.
3. List the day types and variants (full day, weekend, bank holiday, half day, day-rate staff, custom booking…) and how each would read.

**Stop and wait for my approval.**

### Phase 2: Build
Change the view's layout and copy only. Same inputs, same bindings.

### Phase 3: Verify and report
1. **Unit or snapshot tests** for each variant (snapshots in **both light and dark appearance**) in the reference: weekday with overtime, no overtime, break off, Saturday/all overtime, a ×2 rate, plus any extra Phase 1 found. Each test checks:
   - which rows show;
   - the exact text;
   - **Normal paid + Overtime paid = Total paid = the Save button figure**.
2. **Same result:** saving the same booking before and after gives identical Firestore documents and identical figures in My schedule and the timesheets.
3. Build and run the existing test suites. All must pass at least as before, with no tests skipped or weakened.
4. **Report:** screenshots before and after for each variant, **in light mode and in dark mode**, at standard and the largest Dynamic Type size, plus a note confirming that no hard-coded colours were added, the files changed, and any **Decision needed**.

Begin with Phase 1.
