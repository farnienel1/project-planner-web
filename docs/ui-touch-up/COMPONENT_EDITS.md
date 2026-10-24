# Component edits

**UI only.** Every edit below is a `className` string change. Don't change props, handlers, conditions, text or imports. If an edit seems to need anything else, skip it and list it in your report.

`touch-up.css` handles every screen that uses the shared classes (`.ico-chip`, `.hero`, `.tile`, `.banner`, `.btn`, …). These seven places hard-code the pastel icon tile in Tailwind, so the CSS can't reach them.

## 1. Sidebar icons: `components/shell/AppShell.tsx`

Applies to both `NavRow` (around line 94) and `ShortcutRow` (around line 135).

Row (`<Link className={cn(...)}>`), active state:
```diff
- active ? 'bg-[var(--ht)] font-semibold text-[var(--ink)]' : 'font-medium text-[var(--ink2)] hover:bg-[var(--soft)]'
+ active ? 'bg-[var(--soft2)] font-semibold text-[var(--ink)]' : 'font-medium text-[var(--ink2)] hover:bg-[var(--soft)]'
```

Icon `<span>`: drop the tile and keep a plain icon, grey when idle and blue when active:
```diff
- active ? 'bg-[var(--h)] text-white' : 'bg-[var(--ht)] text-[var(--h)]'
+ active ? 'text-[var(--blue)]' : 'text-[var(--ink3)]'
```
Keep the span's size and `place-items-center` classes so nothing moves.

## 2. `components/ui/IconChip.tsx`

Status chips (Home warnings/tasks, etc.) keep their meaning colour on a neutral tile:
```diff
- solid ? 'bg-[var(--h)] text-white' : 'bg-[var(--ht)] text-[var(--h)]',
+ solid ? 'bg-[var(--h)] text-white' : 'bg-[var(--soft)] text-[var(--h)] shadow-[inset_0_0_0_1px_var(--line)]',
```

## 3. `components/ui/surfaces.tsx`: page header icon (around line 22)
```diff
- <div className="grid h-[52px] w-[52px] place-items-center rounded-[16px] bg-[var(--ht)] text-[var(--h)]">
+ <div className="grid h-[52px] w-[52px] place-items-center rounded-[16px] bg-[var(--card)] text-[var(--blue)] shadow-[inset_0_0_0_1px_var(--line)]">
```

## 4. `components/ui/surfaces.tsx`: banner (around line 229)
```diff
- <div data-hue={hue} className="flex items-center gap-3.5 rounded-[14px] bg-[var(--ht)] px-[18px] py-3.5 text-[var(--ink)]">
+ <div data-hue={hue} className="flex items-center gap-3.5 rounded-[14px] bg-[var(--card)] px-[18px] py-3.5 text-[var(--ink)] shadow-[inset_3px_0_0_var(--h),var(--sh)]">
```
Inside it, the `IconChip ... solid` stays as is.

## 5. Leftover non-brand pastels

These files use violet / purple / indigo / pink / sky Tailwind colours, which are the main "AI pastel" look. Swap them to the app's own tokens. **Leave `blue-*` alone.** Blue is the brand colour.

| Today | Swap to |
|---|---|
| `bg-violet-50`, `bg-purple-50`, `bg-indigo-50`, `bg-pink-50`, `bg-sky-50` | `bg-[var(--soft)]` |
| `bg-violet-100`, `bg-indigo-100` | `bg-[var(--soft2)]` |
| `text-violet-*`, `text-purple-*`, `text-indigo-*`, `text-sky-*` | `text-[var(--blue)]` for icons/links, `text-[var(--ink)]` for body text |
| `bg-violet-600/700`, `bg-indigo-600` | `bg-[var(--blue)]` |
| `border-violet-*`, `border-indigo-*`, `border-sky-*`, `ring-sky-*` | `border-[var(--line)]` / `ring-[var(--line)]` |
| `to-purple-*`, `to-indigo-*`, `to-sky-*` in gradients | Remove the gradient and use a solid `bg-[var(--blue)]` or `bg-[var(--card)]` |

Files (match count):
- `components/setup/GuidedOrgSetup.tsx` (8)
- `components/projects/scheduling/ScheduleSubcontractorForm.tsx` (7)
- `components/projects/scheduling/ProjectScheduleWeekOverview.tsx` (6)
- `components/setup/WorkingHoursSetupSection.tsx` (5)
- `components/site-audit/SiteAuditScreen.tsx` (3)
- `components/schedule/ScheduleScreen.tsx` (2)
- `components/setup/SetupExplainer.tsx` (1)
- `components/settings/SettingsScreen.tsx` (1)
- `components/projects/scheduling/ScheduleSelectedDates.tsx` (1)
- `components/projects/features/ProjectSiteAuditSection.tsx` (1)
- `components/onboarding/TeamOnboardingPrompt.tsx` (1)
- `components/job-types/JobTypesScreen.tsx` (1)
- `components/dashboard/DashboardTiles.tsx` (1)

Check with (should print nothing when done):
```bash
grep -rEn "(bg|text|border|ring|from|to|via)-(indigo|purple|violet|pink|sky|cyan|fuchsia)-[0-9]{2,3}" app components
```

## 6. `components/dashboard/DashboardHero.tsx` (used by the dashboard editor preview)

Match it to the other heroes:
```diff
- rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 p-6 text-white shadow-[0_10px_30px_rgba(37,99,235,0.28)]
+ hero rounded-2xl p-6 text-white
```
The `.hero` class supplies the navy background and shadow. Keep the editable ring classes.
