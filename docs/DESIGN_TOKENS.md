# Design tokens — sidebar and Home

Visual design only. This is not part of the rulebook (`docs/RULEBOOK.md`): no business rule, data, route or permission depends on it. iOS can match it later screen by screen.

Source of truth on web: `app/brand-shell.css` (CSS variables, light and dark) and the `brand`, `danger`, `sidebar-muted`, `signout`, `page-bg`, `card-bg`, `card-border` colours in `tailwind.config.js`, which point at those variables. Components use the variables or the classes in `brand-shell.css`, never a hex value.

## Tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `brand-900` | `#0E2A6B` | same | Hero gradient start |
| `brand-800` | `#17398A` | same | Sidebar background (both themes), active nav text, top-bar avatar |
| `brand-600` | `#1F56C9` | `#7DA5F5` | Icons and links on Home |
| `brand-500` | `#2F6FE0` | same | Hero gradient end |
| `brand-50` | `#E6EEFC` | `#172C4D` | Icon tile background, day chips |
| `brand-solid` | `#1F56C9` | `#2F6FE0` | Fill behind white text (New button). In light it is `brand-600`; dark keeps white text at AA |
| `brand-chip-ink` | `#17398A` | `#A9C4FF` | Text on a `brand-50` day chip |
| `sidebar-muted` | `#C3D1F2` | same | Sidebar secondary text and labels, hero date |
| `danger-600` | `#DC2626` | `#F87171` | Warnings icon |
| `danger-50` | `#FEE2E2` | `#3D1717` | Warnings icon tile |
| `danger-solid` | `#DC2626` | same | Notification badge fill (white text) |
| `signout` | `#C62828` | same | Sign out text and icon (on a white button in both themes) |
| `signout-hover` | `#FEE2E2` | same | Sign out button hover |
| `page-bg` | `#F1F4F9` | `#0B1220` | App content background |
| `card-bg` | `#FFFFFF` | `#131C2E` | Cards and tiles |
| `card-border` | `#E3E8F0` | `#24314B` | Card and tile borders |
| `control-border` | `#DDE3EC` | `#2E3D5C` | Search, refresh, bell, menu buttons |
| `text` | `#0F1B33` | `#EAF0F8` | Primary text |
| `text-muted` | `#5F6E84` | `#B0BCCF` | Secondary text, breadcrumb |

`text-muted` is `#5F6E84`, not the design's `#64748B`: `#64748B` is 4.32:1 on `page-bg`, below WCAG AA; `#5F6E84` is 4.70:1 there and 5.19:1 on white.

Sidebar overlays (same in both themes): item fill `rgba(255,255,255,.08)`, item border `.16`, item hover `.14`, dividers `.14`, logo ring `.22`.

Font: Inter (the app body font). Radii: cards 16px, nav items and buttons 10–12px, icon tiles 12px, hero 22px.

## Sidebar

- 268px wide on desktop, full height, solid `brand-800`, padding 22px 16px 18px. The mobile drawer (below 1024px) keeps its behaviour and uses the same styling.
- Logo block: the app logo (`public/branding/app-logo.png`, `AppLogoMark`) at 44×44 with a 1px `rgba(255,255,255,.22)` ring; "Project Planner" 17px bold white; organisation name 12.5px `sidebar-muted`; 1px divider below.
- Every item is a button-like link: 40px high, radius 10px, 6px apart, item fill and border above, white 18px icon, white 14.5px medium label, chevron at 55% opacity. Hover uses the hover fill.
- Active item (whichever page is open, `aria-current="page"`): solid white, `brand-800` text and icon, bold. Home is 44px / 15px.
- Section labels (NAVIGATE, TOOLS, TEAM, APP & ACCOUNT): 11.5px, weight 700, letter-spacing 0.1em, uppercase, `sidebar-muted`. "Customise" is a white underlined link.
- Keyboard focus: 2px white outline.
- Footer pinned to the bottom under a divider: user card (item fill, radius 12px, avatar, white name, organisation in `sidebar-muted`); Sign out is a full-width 40px white button with `signout` text and icon; version line "v1.0.0 · Project Planner · Data health" centred, 11.5px, `sidebar-muted`.

## Top bar

Breadcrumb in `text-muted` with the current page bold in `text`. Search, refresh, bell and the mobile menu button are `card-bg` with a 1px `control-border` border, radius 12px, 44px. New is `brand-solid` with white text, radius 12px. The unread badge is `danger-solid`. The avatar is a `brand-800` circle with white initials (or the photo).

## Home

- Content padding 22px 32px on wide screens; 18px between sections.
- Hero: radius 22px, padding 28px 30px, `linear-gradient(120deg, brand-900 0%, brand-800 45%, brand-500 100%)` with a 44px grid at `rgba(255,255,255,.06)`. Date 13px semibold `sidebar-muted`; "Hi, name" 38px bold white; subtitle 15px. Stat boxes: fill `.10`, border `.28`, radius 14px. Book labour is solid white with `brand-800` text; other hero buttons are fill `.12`, border `.30`.
- Warnings and Tasks: white cards, `card-border`, radius 16px, side by side when they sit under the hero. Warnings icon `danger-600` on `danger-50`; Tasks icon `brand-600` on `brand-50`.
- Up next and Maintenance: the same white card treatment. Day chips are `brand-50` with `brand-chip-ink` bold text.

## One accent colour

Blue is the only icon colour on Home and in the sidebar. **Every quick-action icon is `brand-600` on a 44px `brand-50` tile, radius 12px**, whatever its section; the old per-section colours (purple, green, orange, pink…) are not used on Home. Tiles are `card-bg` with a `card-border` border, radius 16px, 110px high, label 14px semibold `text`. Red is reserved for warnings, the notification badge and Sign out.

This rule is scoped to the sidebar and Home. Other screens keep the `docs/agent-rules/ui-touch-up.md` rules.
