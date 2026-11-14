# Project Planner Web: User Profile & Edit User UI Spec

**Scope (web app only):**
- the **User profile** page (`/dashboard/users/{id}?from=users`);
- the **Edit user / Edit operative** page (`/dashboard/users/{id}/edit?from=users`), in all its variants:
  - Operative
  - Manager
  - Administrator
  - Super Admin
  - the loading state
  - the success banner

**Type:** UI only. **Web app only.** This is a visual upgrade, not a feature, function or flow change.

**Visual reference:** `user-profile-ui-reference.html`.
- The dashed **"PREVIEW ONLY"** strip of pill buttons at the top is just a screen switcher for the mock-up. **Do not build it.**
- The data in the reference is from the user's recording and is for look only.

**Direction:** match the Daily overview, Timesheets and Manage users pages (`web-pages-ui-spec.md`):
- a navy grid header band;
- white section cards, each headed by a small gradient icon tile;
- consistent field, toggle and permission rows;
- account actions as tidy list rows, colour-coded by consequence.

This replaces the current plain stacked form, which looks like a document form.

---

## 0. Read this first

> **This job changes how these pages LOOK. It must not change what anything DOES.**
>
> - It is a **UI upgrade to the web app only**, not a function, feature or flow change.
> - Every field, select, toggle, permission, expand chevron, file upload, qualification action, account action, Save, Back and Edit profile must work **exactly** as today. That means the same handler, the same validation, the same data written and the same next screen.
> - If a visual change would require changing behaviour, **don't make it**. Keep the current behaviour and report it as **Decision needed**.

---

## 1. The UI-only rule

### You MAY change
- Layout, grouping, spacing, colours, type, icons, chips, cards and button styling.
- A native `<select>` with a fixed short option list, such as **Employment type: PAYE / Self-Employed**, may be shown as a segmented control. The options, values, `onChange` handler and validation must stay identical. If that isn't trivially safe in this codebase, keep the select and restyle it.
- Field order **within a section** for alignment (e.g. two columns). Sections stay in their current order.
- The headings shown in §3 may gain a small icon tile. Heading text stays as it is.

### You MUST NOT change
- **Which fields and sections appear for each user type and state.** For example: no Employment type for Super Admin; the Annual leave fields only when the allowance is on; the Super Admin lock card; Change Super Admin vs Change user type; Deactivate vs Reactivate.
- **Field names, values, defaults, placeholders, helper text, validation, required rules, or read-only rules** (e.g. Last active is read-only).
- **Pay logic.** Day rate / Hourly rate switching, the "removes the other rate" behaviour, the units (/day, /hr), and the effective-date behaviour of Employment date.
- **Line manager rules** and their messages.
- **Qualifications.** Add qualifications, the Saved button state, expiry dates, file type and size limits, upload, View certificate, Remove certificate, and the status text.
- **Annual leave calculations and text**, including the "Remaining this leave year…" line and the **Annual leave → Team** link.
- **Permissions.**
  - Which permissions show for each role.
  - Which are locked or forced on.
  - Their descriptions and expand behaviour.
  - The Super Admin lock.
- **Account actions:**
  - Send password reset;
  - Ask Project Planner to fix it;
  - Change user type (the inline Operative / Manager / Administrator chooser, "Changes apply when you press Save", Cancel type change);
  - Change Super Admin;
  - Deactivate / Reactivate;
  - Delete.

  Keep the same handlers and any confirmations.
- **The save model.** The "No changes" / unsaved state indicator, the Save control (wherever and whenever it appears today), the success banners (e.g. "User reactivated.") and the offline banner behaviour.
- **Navigation.** Back, Edit profile, the URLs and `?from=users`.
- **Permissions to view or edit** these pages.
- **Other pages**, the global sidebar and top bar, and the **iOS app**.
- **No new click targets or features.**
  - Band figures and chips are display-only.
  - No new sections, summaries, anchors or shortcuts.
  - No new calculations.

---

## 2. Design tokens and components

Use the same tokens and components as `web-pages-ui-spec.md` §2: `PageBand`, `Card`, `Chip`, `IconTile`, `Note`, and the segmented control. Add these presentational components:

| Component | Look |
|---|---|
| `FormSection` | White card, radius 16. Header row: 32px gradient icon tile + section title (15px bold) + optional right-side actions. Body is a 2-column field grid (1 column below 820px). |
| `Field` | Label 12px semibold `ink-2` above the input. Input 42px high, radius 11, `field` background, 1px border, blue focus ring. Helper text 12px `muted` below. Read-only inputs use a darker grey fill. |
| `MoneyInput` | £ prefix and unit suffix (/day or /hr, from the current rate type) inside one input shell. |
| `ToggleRow` | Title (semibold) and description(s) on the left, a 46×28 switch on the right. Locked switches are pale blue and disabled. |
| `PermissionRow` | Chevron (rotates when expanded), 32px icon tile (blue gradient when on, grey when off), name, description when expanded, switch. Locked permissions keep the existing locked state and may add a small green "Locked on" chip. |
| `QualificationCard` | Bordered card: qualification name, expiry date field, dashed upload area ("Choose file", "PDF or JPEG only · max 10MB"), status chip (green "Certificate uploaded" / slate "No certificate uploaded"), and View / Remove certificate links. All of these wrap the **existing** inputs and handlers. |
| `ActionRow` | Full-width list row: 34px tinted icon tile, title, sub-text and chevron. Colours: neutral blue for password reset and support, purple for Change user type / Change Super Admin, amber for Deactivate, red for Delete. |
| `SaveState` pill | Shows the existing state text ("No changes", or whatever it shows today) in a pill on the band. The existing Save control keeps its current placement and behaviour, restyled with the primary button style. |

---

## 3. Page-by-page parity

### 3.1 User profile (view)

| Before | After |
|---|---|
| Back | Back link above the band. Same action. |
| Blue hero: photo/avatar, name, chips (role, Verified, Active), **Edit profile** | Navy band: large avatar/photo, eyebrow "User profile", name, the same chips, and a white **Edit profile** button (same route) |
| Details: Email, Mobile, Last active, Trade, Employment, Line manager, Day rate / Hourly rate | Details card as a 2-column definition list with the same labels and values. The band repeats Employment, Rate, Trade and Line manager as **display-only** figures. |
| Qualifications section | Card with one row per qualification, showing the existing information plus a status chip. Same content and any existing links. |
| Loading skeleton | A skeleton matching the new layout |

### 3.2 Edit user / Edit operative

| Section (before) | After |
|---|---|
| Back · title "Edit operative"/"Edit user" (wording varies by type, as today) · "No changes" | Back link. Band shows the avatar, eyebrow = the same title, name, the same chips, and the save-state pill. |
| Success banner (e.g. "User reactivated.") | Green banner under the band, same text and timing |
| Offline banner | Unchanged (global) |
| Header card: avatar/photo, name, role, Verified, Active | Merged into the band (same data) |
| **User details:** First name, Surname, Email, Mobile number, Last active (read-only), Employment type (PAYE / Self-Employed), Employment date ("Effective immediately") + helper | `FormSection` (blue user tile), 2-column grid. Employment type may be a segmented control (see §1). All the same fields and helper text. |
| **[Role] setup** (Operative setup / Manager setup / Super Admin setup): Line manager(s) select + helper(s); Day rate / Hourly rate switch; £ value /day or /hr; both pay helper paragraphs; Trade type; "Current trade: X" | `FormSection` (purple tile, Super Admin uses blue). Line manager full width with the same helpers. Pay row = the existing switch as a segmented control + `MoneyInput`. The first helper text sits under the input and the "Pay is a day rate or an hourly rate, not both…" text sits in a blue `Note`. Trade type and current trade are kept. |
| **Qualifications:** Add qualifications, Saved, qualification cards (name, Expiry date, file input, limits, View/Remove certificate, status) | `FormSection` (amber badge tile). Add qualifications and Saved sit in the header. Cards are shown in a 2-column grid using `QualificationCard`. |
| **Annual leave in app:** Annual leave allowance toggle + 2 paragraphs | Merged into one `FormSection` "Annual leave" (amber sun tile). The first `ToggleRow` keeps both paragraphs, word for word. **The heading "Annual leave in app" may be kept as the section title instead if preferred; content must not change.** |
| **Annual leave:** Days per year, Company leave year (start → end) + helper, Start date + helper, Carry unused days toggle + helper, "Remaining this leave year: N (N taken, N awaiting approval)." + Adjust leave text and link | Same section. Fields go in the grid, with the carry-over `ToggleRow`. The remaining line sits in a highlighted box with the same number as a large figure on the left. Text and link unchanged. Shown or hidden exactly as today. |
| **Employment & timesheets:** Timesheets enabled toggle + text; VAT number, UTR number (Optional.) | `FormSection` (blue sheet tile): `ToggleRow` + 2-column fields |
| **Account status:** Active toggle "User can sign in and use the app." | `FormSection` (green tile) + `ToggleRow` |
| **Permissions:** expandable rows with descriptions and toggles; locked rows; the Super Admin lock card | `FormSection` (blue shield tile) with `PermissionRow`s, in the same order and states. The Super Admin lock card becomes an amber-tinted card with a key tile, same text. |
| **Account actions:** Send password reset; Wrong login email? + Ask Project Planner to fix it; Change user type (expands inline chooser: Operative / Manager / Administrator with descriptions, "Changes apply when you press Save", Cancel type change); Change Super Admin; Deactivate (or Reactivate) user; Delete user | `FormSection` (slate tile) with `ActionRow`s, colour-coded (§2). The inline chooser opens in place as a soft-purple panel with option cards and radio states; Cancel type change is kept. Same handlers and confirmations. |
| Loading skeleton | A skeleton matching the band and section cards |

### 3.3 Variants to check (all must keep today's content)

| Variant | Must show (as today) |
|---|---|
| Operative | Operative setup; permissions limited to what operatives get today (e.g. Materials, Site audit) |
| Manager | Manager setup; the full permission list with locked items (e.g. Materials, Site audit locked on) |
| Administrator | Whatever the current admin edit shows |
| Super Admin | Super Admin setup (No line manager + its helper); no Employment type; Permissions lock card; Change Super Admin |
| Allowance off / on | Annual leave fields hidden / shown as today |
| Inactive user | Reactivate in place of Deactivate; Active toggle state |
| Unsaved changes | The existing unsaved indicator and Save control, restyled only |

---

## 4. Layout and responsive

- **≥1024px: settings layout.** Each `FormSection` is split in two:
  - a **240px left column** holding the section's icon tile (38px) and title, with any section header buttons (e.g. Add qualifications, Saved) stacked full-width underneath, on a faint gradient with a divider;
  - a **right column** holding the fields, toggles, permission rows or action rows.

  Sections run the full content width. This is layout only: the same sections, in the same order, with nothing new to click.
- **<1024px:** the section title sits above its content.
- **<820px:**
  - Grids become one column.
  - The band stacks.
  - Toggles stay on the right of their text.

### Nothing may overflow (required)
At **1440, 1280, 1024, 820 and 390px** wide:
- **No horizontal page scroll.**
- **No text cut off or ellipsised** (e.g. breadcrumbs, names, emails, figures).
- **No button, chip, input or icon extending past its card or the screen.**
- **No short button label wrapping onto two lines.**

Use these patterns:
- **Breadcrumb:** let it shrink. Below 600px, hide the organisation prefix rather than cutting the page name.
- **Top bar:** below 600px, the New button becomes icon-only (keep its aria-label) and refresh may hide. Every control stays reachable, and its action is unchanged.
- **Wide tables:** below 640px (or below 1100px for tables with more than 6 columns), each row becomes a stacked card. The first cell is the row title, and each other cell is a "LABEL ··· value" line. Labels come from the column headers. Row clicks and buttons are unchanged.
- **Segmented tabs and toggles:** wrap onto two rows on narrow screens instead of running off.
- **Long values** (emails, names, project names): wrap with `word-break: break-word`.
- **Header-band figures:** a 2×2 grid on phones.

Verify with an automated check, as well as by eye. On every page, at each width, assert that `document.documentElement.scrollWidth <= clientWidth`, and that no visible element's right edge is beyond the viewport or its parent card.


---

## 5. Acceptance checklist

- [ ] **Zero behaviour change.** Editing and saving each variant (Operative, Manager, Super Admin) before and after the change writes **identical** data to Firestore. Compare the saved user documents field by field.
- [ ] Every row in §3 is present for every variant in §3.3, with identical text.
- [ ] Pay: switching day ↔ hourly, saving, and the removal of the other rate behave exactly as before.
- [ ] Qualifications: add, set expiry, upload (type and size limits), view and remove all behave as before.
- [ ] Permissions: same rows, order, locked states and descriptions per role. Toggling and saving gives the same result.
- [ ] Account actions: each one triggers the same handler and confirmation. The Change user type chooser works the same, including Cancel type change.
- [ ] No new click targets, sections, features or calculations. The preview switcher was **not** built.
- [ ] The diff touches only presentational files.
- [ ] **No overflow** at 1440, 1280, 1024, 820 and 390px, per §4 "Nothing may overflow", proven by the automated check and screenshots.
- [ ] No new console errors. Focus is visible. Switches and icon buttons are labelled. Contrast is AA.
