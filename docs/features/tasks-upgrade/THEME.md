# Light and dark mode

**Applies to:** every screen on iOS and web. This file is the same in every feature pack. If the theme foundation already exists in the codebase, reuse it; never build it twice.
**Source of truth:** `rules/theme.tokens.json` (colour tokens for both modes) + `rules/theme.tokens.schema.json`.
**Mockups:** every mockup in these packs has an **Appearance** switch (Match device / Light / Dark) at the top.

---

## 1. Decisions

| Decision | Why |
|---|---|
| **Default: match the device.** Settings › Appearance offers **Match device / Light / Dark**. | People already choose dark or light on their phone and computer; the app should follow without being asked. |
| **Stored per device, not per account.** | A phone on site can be dark while the office PC stays light. |
| **Applies instantly, no restart.** On web, no white flash on load: the theme is set before first paint. | |
| **Navy brand elements stay navy in both modes:** web sidebar, iOS header band, project header card, public share page background. | They're the Project Planner look, and white text on navy works in both modes. |
| **Paper stays paper:** photos, certificate previews, PDFs, exported reports and anything printed stay light. | Documents should look the same as when printed or emailed. |
| **Avatar colours and gradient icon tiles don't change.** | They're identity, with white initials/icons that work on both. |
| **Light mode on web = today's look; dark mode on iOS = today's look.** The other mode on each platform is new. | Nobody's current view changes unless they choose it. |

## 2. How colours are used

1. **No colour values in screen code.** Every colour comes from a token (`bg.surface`, `text.secondary`, `tone.red.fg`…). A hex value in a component is a bug, except the fixed items in `fixedColours`.
2. **Status colours go through tones.** Rulebooks say `"tone": "amber"`; the screen uses `tone.amber.fg` on `tone.amber.bg`. That keeps chips readable in both modes.
3. **Contrast is checked, not eyeballed.** `contrastPairs` lists every text/background combination that must reach 4.5:1. CI checks all pairs in both modes. All 46 checks pass with the values below.
4. **Text on navy** always uses `brand.navyFg` / `brand.navyFgMuted`, whatever the mode.
5. **Overlays and shadows** use `overlay.scrim` and `shadow.popup`, so dimming looks right in dark mode.

## 3. How it gets to each platform

Colour tokens are **built into each app** (unlike feature rulebooks, which are fetched at runtime), because colours are needed before anything loads.

```
rules/theme.tokens.json           edited only here, reviewed like code
        │  generator script (run by CI and on build)
        ├── web:  theme.css: CSS custom properties for light, dark,
        │         [data-theme="light"|"dark"] overrides, and prefers-color-scheme
        └── iOS:  colour assets with Any/Dark appearances (SwiftUI/UIKit),
                  or a generated theme object if the app is React Native
CI: schema valid · every token has both modes · contrast pairs pass in both modes
    · generated files match the JSON (no hand edits)
```

- **Web:** set `data-theme` on `<html>` from the saved choice in a tiny inline script in `<head>` (prevents the white flash); "Match device" removes the attribute and lets `prefers-color-scheme` decide. Listen for system changes.
- **iOS:** "Match device" follows the system trait; Light/Dark set the window's interface style override. Colour assets switch automatically. Check the status bar, keyboard appearance, date pickers, share sheet and Quick Look follow the chosen mode.
- **A colour change** in the JSON reaches web on its next deploy and iOS on its next release. That's expected for colours. Feature rulebooks still update without a release.

## 4. Rolling it out without a half-light, half-dark app

Today web is light-only and iOS is dark-only. Until **every** screen on a platform uses tokens, switching that platform's mode would show a mix of light and dark screens. So:

1. **Build the foundation first:**
   - the token file and the generator
   - a theme provider on each platform
   - the Appearance setting, behind a feature flag (`appearanceSettingEnabled`, default off)
2. **Convert the app shell:** web sidebar, top bar, settings layout; iOS tab bar, nav bars, sheets, settings.
3. **Every screen built or changed from now on must use tokens and be checked in both modes.** That includes the Tasks upgrade and Insurance & accreditations.
4. **Convert the remaining screens** using the rollout prompt in section 7. Keep a checklist of screens and their status.
5. **Turn the flag on per platform** once every screen on that platform is converted. Until then, web stays light and iOS stays dark, so users see no change.

## 5. Tokens

Values are light / dark. Contrast-checked pairs are listed in `contrastPairs` in the JSON.

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg.page` | `#F7F8FA` | `#000000` | Page / sheet background behind cards |
| `bg.surface` | `#FFFFFF` | `#141B29` | Cards, popups, panels, table rows |
| `bg.surfaceSubtle` | `#F4F6FA` | `#1A2233` | Row hover, popup footer, drop zones |
| `bg.group` | `#FFFFFF` | `#1C1C1E` | iOS grouped lists and form groups |
| `bg.input` | `#FFFFFF` | `#2C2C2E` | Text inputs, selects, segmented controls (iOS dark uses the system grey) |
| `bg.inputMuted` | `#EEF0F4` | `#1F2635` | Locked/read-only fields, segmented control track |
| `border.default` | `#E3E7EE` | `#283247` | Card and panel borders |
| `border.subtle` | `#EEF1F5` | `#1F2839` | Dividers inside cards and lists |
| `border.strong` | `#C9D0DB` | `#3A4560` | Input borders, dashed drop zones, unticked checkboxes |
| `text.primary` | `#101828` | `#FFFFFF` | Titles, body |
| `text.secondary` | `#475467` | `#B4BCC9` | Descriptions, labels |
| `text.tertiary` | `#5F6B7C` | `#98A2B3` | Meta, helper text, placeholders (min 13 px) |
| `text.link` | `#3D4FD8` | `#7FA2FF` | Links, text buttons |
| `primary.bg` | `#3D4FD8` | `#6B93FF` | Primary buttons |
| `primary.bgHover` | `#3443C2` | `#85A6FF` | Primary hover/pressed |
| `primary.fg` | `#FFFFFF` | `#0B1530` | Text/icons on primary buttons |
| `primary.soft` | `#ECEEFD` | `#1F2E5C` | Selected tab/option background |
| `primary.softFg` | `#3443C2` | `#CFDCFF` | Text on primary.soft |
| `secondary.bg` | `#FFFFFF` | `#222A39` | Secondary buttons |
| `secondary.fg` | `#101828` | `#DCE1EA` | Text on secondary buttons |
| `brand.navy` | `#0A1530` | `#0A1530` | Web sidebar, project header card. Same in both modes |
| `brand.navyHeader` | `#101A2B` | `#101A2B` | iOS navy grid header band. Same in both modes |
| `brand.navyRaised` | `#1B263F` | `#1B263F` | Selected item on navy |
| `brand.navyFg` | `#FFFFFF` | `#FFFFFF` | Text on navy |
| `brand.navyFgMuted` | `#C6CFDF` | `#C6CFDF` | Secondary text on navy |
| `brand.navyGrid` | `rgba(255,255,255,0.035)` | `rgba(255,255,255,0.035)` | Grid lines on navy |
| `tone.red.fg` | `#B42318` | `#FF7A7A` |  |
| `tone.red.bg` | `#FDECEC` | `#3B1518` |  |
| `tone.amber.fg` | `#8A4B05` | `#F5B83D` |  |
| `tone.amber.bg` | `#FFF2D9` | `#3A2A0C` |  |
| `tone.green.fg` | `#0F6B4A` | `#34D27B` |  |
| `tone.green.bg` | `#E1F3EA` | `#11301E` |  |
| `tone.blue.fg` | `#2C50CC` | `#8FB0FF` |  |
| `tone.blue.bg` | `#E8EDFD` | `#18284F` |  |
| `tone.grey.fg` | `#475467` | `#AEB5C1` |  |
| `tone.grey.bg` | `#EEF0F4` | `#222A38` |  |
| `tone.teal.fg` | `#0E6B63` | `#35D5C1` |  |
| `tone.teal.bg` | `#DDF4F1` | `#113634` |  |
| `tone.purple.fg` | `#5B45C8` | `#A690FF` |  |
| `tone.purple.bg` | `#EEEAFE` | `#272150` |  |
| `tone.red.solid` | `#D92D20` | `#E5484D` | Destructive buttons (white text) |
| `tone.red.rail` | `#E06363` | `#E06363` | Overdue left edge |
| `tone.amber.rail` | `#E7A93A` | `#E7A93A` | Due-soon left edge |
| `tone.green.solid` | `#12805C` | `#34D27B` | Ticked checkbox fill |
| `tone.green.solidFg` | `#FFFFFF` | `#06210F` | Tick on green.solid |
| `overlay.scrim` | `rgba(10,18,36,0.48)` | `rgba(0,0,0,0.62)` | Behind popups and sheets |
| `focus.ring` | `#7C8AF0` | `#9DB6FF` | Keyboard focus outline (3 px) |
**Fixed on purpose (same in both modes):** avatar colours, gradient icon tiles, photos and document previews, `brand.*` navy elements, the iOS switch green.

## 6. Checks for every screen (add to each feature's test plan)

- [ ] Screen looks right in Light, Dark and Match device on both platforms (screenshots of each attached to the PR).
- [ ] Switching mode while the screen is open updates it instantly, including popups, sheets, menus and toasts.
- [ ] No hex colours in the screen's code except the fixed items (search the diff).
- [ ] Chips, links, helper text, disabled states and placeholders are readable in both modes (CI contrast check passes).
- [ ] Focus rings visible in both modes (web).
- [ ] Navy elements keep white text in both modes.
- [ ] Photos, certificate previews and PDFs aren't tinted or inverted.
- [ ] Web: no white flash when loading in dark mode.
- [ ] iOS: status bar, keyboard, date picker, share sheet and Quick Look follow the chosen mode.
- [ ] The Appearance choice survives an app restart and is per device.

## 7. Theme rollout prompt (whole app, run separately)

Paste into Claude Code when you're ready to convert the rest of the app:

```
Roll out light and dark mode across Project Planner (iOS and web). Read rules/theme.tokens.json and THEME.md first. Read-only first: no code changes until I approve the plan.

1. Check what already exists: the tokens file, generator, theme providers, Appearance setting, feature flag. Reuse anything already built (e.g. by the Tasks or Insurance & accreditations work).
2. Inventory every screen on each platform. Mark each one: uses tokens / partly / hard-coded colours. Count hex values per file.
3. Plan the conversion in batches (shell first, then most-used screens). Map each hard-coded colour to a token. Flag any colour that has no sensible token, and propose a new token rather than a one-off value.
4. After approval, convert batch by batch on branch feature/theme-rollout. Attach light and dark screenshots of each converted screen to the batch summary.
5. Keep the Appearance setting behind appearanceSettingEnabled (default off) until every screen on that platform passes the checks in THEME.md section 6. Then show me the checklist and ask before turning it on.
6. CI must run on every batch: tokens schema, contrast pairs in both modes, generated files in sync with the JSON, and no new hex values in screen code.
Report per batch: screens converted, remaining count, any new tokens proposed, and screenshots.
```
