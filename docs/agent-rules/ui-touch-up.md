# UI touch-up — visual polish only

Spec: `docs/ui-touch-up/` (README, touch-up.css, COMPONENT_EDITS.md, screenshots).

1. Allowed: appending `touch-up.css` to the end of `app/globals.css`, and the `className` edits listed in `COMPONENT_EDITS.md`.
2. Never change handlers, props, state, effects, data calls, routes, permissions, auth, nav order, wording, or anything in `lib/canonical`, `lib/stores`, `app/api`, `firestore.rules`, `middleware.ts`, `lib/ui/theme.ts`.
3. Keep the existing palette, fonts and layout. No new hard-coded hex colours in components — use the existing `var(--…)` tokens.
4. Every edit must look right in light mode, system dark and `[data-theme='dark']`.
5. No pastel icon tiles: icons sit on a neutral tile (`--card`/`--soft` + hairline) in `--blue`, or keep their status colour (`--h`) when they mean something.
6. `docs/agent-rules/ios-parity-upgrades.md` (behaviour parity) does not apply to this touch-up.
7. If something cannot be done with a className edit, skip it and list it.
