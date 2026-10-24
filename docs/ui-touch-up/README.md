# UI touch-up for the web app

> ## This is a UI-only upgrade
> **No functions, no features, no behaviour changes.**
>
> This touch-up only changes **how the existing web app looks**. These stay exactly as they are:
>
> - Every screen, button, menu item, field, setting and page. Nothing is added or removed.
> - Business logic, `lib/canonical`, stores, Firestore reads and writes, rules, API routes, permissions, auth, routing and navigation order.
> - All wording.
> - **Layout**: grid columns, element order, sizes and spacing.
> - The colour palette, the fonts (Inter and Plus Jakarta Sans) and the overall look. This is a polish of the current design, not a new one.
>
> If a change needs more than CSS or a `className` edit, it's out of scope.

---

## What changes

The app looked AI-generated mainly because of pastel icon tiles (a soft coloured square behind a coloured icon, in a different colour on every tile), glowing coloured gradients, and soft shadows that make every card look like it floats. The touch-up removes those and keeps everything else.

| Area | Before | After |
|---|---|---|
| Quick-action, page-header and section icons | Pastel tile in a different colour each (lilac, pink, mint, peach…) | Neutral tile with a hairline edge and a brand-blue icon. On hover the tile fills blue. |
| Sidebar icons | Pastel tile per item | Plain icon: grey when idle, blue when active. Active row is a quiet grey highlight. |
| Status icons (warnings, tasks, errors) | Pastel tile | Neutral tile; the icon keeps its meaning colour (amber, red…) |
| Hero banners | Blue, purple (Daily overview), red (Warnings), light blue (Timesheets), each with a glow and a dashed circle | One consistent navy panel with the existing faint grid. The section colour is kept as a small square beside the label. |
| Hero stat boxes | Frosted glass with blur | Flat translucent boxes |
| Cards | Soft floating shadow, 18px corners | Hairline edge with a very light shadow, 14px corners. Hover lifts 1px, not 3px. |
| Primary buttons | Gradient with a blue glow | Solid brand blue with a subtle edge |
| Selected chips and tabs | Coloured glow underneath | No glow |
| Pills and tags | Candy pastel fill | Same colour, quieter tint with a hairline edge |
| Banners and notices | Pastel slab | White card with a coloured left edge |
| Project card headers | Pastel gradient | Plain light grey band |
| Calendar bookings | Pastel fill | Very light tint with a 3px colour edge |
| Headings and big numbers | Extra-bold (800) | Bold (700), with numbers lined up (tabular figures) |
| Leftover violet/purple/indigo/pink/sky Tailwind colours | Scattered on setup, scheduling and site audit screens | Swapped to the app's own blue and neutrals |

Screenshots from the real app with the touch-up applied (Home before and after, Warnings, Daily overview, Projects, and Home in dark mode) are kept locally in `screenshots/` and are not committed, because they show live organisation data and this repository is public.

## Light and dark mode

Both modes are covered, and theme switching works exactly as it does today:

- `lib/ui/theme.ts`, the boot script, the `pp-theme` storage key and the Account menu toggle **don't change**.
- `touch-up.css` sets the shadow and tint values three times, once for each way the app picks a theme:
  1. `:root`: light.
  2. `@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) }`: system dark.
  3. `:root[data-theme='dark'], .dark`: dark chosen in the app.
- In **dark mode**, cards use a hairline edge only (shadows don't show on dark backgrounds), and tints are a little stronger (14% instead of 9%) so they stay visible.
- The navy hero and the blue icons are the same in both modes. In dark mode this replaces the light-blue glowing Timesheets hero.
- All colours come from the existing tokens (`--card`, `--line`, `--blue`, `--h`, …), so anything that already worked in dark mode still does.

## Files

| File | What it is |
|---|---|
| `README.md` | This explanation |
| `touch-up.css` | One CSS block to append to the end of `app/globals.css` |
| `COMPONENT_EDITS.md` | The small `className` edits for the few places the CSS can't reach, plus the leftover-pastel file list |
| `screenshots/` | The real app with the touch-up applied (local only, git-ignored) |
| `../agent-rules/ui-touch-up.md` | The agent rule that keeps edits UI-only |

## Note on the iOS parity rule

`docs/agent-rules/ios-parity-upgrades.md` (behaviour parity) **doesn't apply** to this touch-up. This is visual polish only.
