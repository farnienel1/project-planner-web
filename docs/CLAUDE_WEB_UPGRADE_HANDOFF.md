# Project Planner Web — Full handoff for Claude (iOS → Web upgrade)

**Repo:** `https://github.com/farnienel1/project-planner-web`  
**Firebase project:** `project-planner-f986c` (shared with iOS TestFlight + web localhost when env matches)  
**Stack:** Next.js 16 App Router · React 18 · TypeScript · Tailwind CSS 3.4 · Zustand · Firebase (Auth + Firestore + Storage)  
**iOS parity docs:** `docs/IOS_FIRESTORE_PARITY.md` · `docs/audit.md` · `docs/LINK_IOS_AND_WEB_IN_CURSOR.md`

---

## Your mission

Port iOS settings / org screens to the web app. **Match iOS behaviour and Firestore shapes** — do not invent new data models or hook names. The web already has working settings, stores, and Firestore helpers; extend them.

When iOS and this doc conflict, **verify against the iOS source** (`FirebaseBackend.swift`, relevant `*View.swift`, `*Store.swift`) and the web files listed below.

---

## 1. Styling system

### Confirmed: Tailwind CSS v3.4

- Config: `tailwind.config.js`
- Entry: `app/globals.css` (`@tailwind base/components/utilities`)
- PostCSS + autoprefixer in `package.json`

### What is NOT set up

- **No shadcn/ui**
- **No iOS semantic Tailwind tokens** (`bg-canvas`, `text-ink`, etc.)
- **No full iOS colour palette** in `theme.extend`

### What IS set up

**Tailwind `primary` scale only** (blue):

```
primary.50 … primary.900  (standard blue tailwind-like scale in tailwind.config.js)
```

**CSS variables in `globals.css`:**

```css
:root {
  --pp-bg: #f4f6f9;
  --pp-ink: #0f172a;
  --pp-muted: #475569;
  --pp-border: #e7ebf0;
}
body { background: var(--pp-bg); color: var(--pp-ink); }
```

### Dominant UI patterns (copy these)

| Pattern | Classes |
|---------|---------|
| Page header card | `rounded-2xl border border-slate-200 bg-slate-50 p-6` |
| Content card | `rounded-2xl border border-slate-200 bg-white p-4 shadow-sm` |
| Primary button | `rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700` |
| Secondary button | `rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50` |
| Section label | `text-[11px] font-bold uppercase tracking-widest text-slate-400` |
| Body text | `text-sm text-slate-900` / muted `text-slate-500` |
| Success banner | `rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800` |
| Error banner | `rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800` |
| Org settings hero | `rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 p-5 text-white shadow-lg` |
| Dashboard hero | `rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 p-6 text-white` |

### iOS-specific colours

Use **arbitrary Tailwind values** short-term, e.g. `bg-[#185FA5]`, OR add once to `tailwind.config.js` + `:root` if you're porting many screens. Don't scatter hex without a plan.

**Do not** introduce a second styling system (styled-components, MUI, shadcn) unless explicitly requested.

---

## 2. Component library

### NOT shadcn/ui

There is no `components/ui/button.tsx`, `Card`, `Dialog`, `Switch`, etc. Only:

- `components/ui/AppTopNotice.tsx`
- `components/ui/ProjectPlannerLogo.tsx`

### Use these existing primitives

#### Forms — `components/forms/FormShell.tsx`

```tsx
import { FormLabel, FormInput, FormSelect, FormTextarea, FormActions, FormBackLink } from '@/components/forms/FormShell'
```

- `FormLabel` — optional `required` prop adds red asterisk
- `FormInput` / `FormSelect` / `FormTextarea` — slate border, blue focus ring
- `FormActions` — Save + Cancel link row

#### Page shell — `components/dashboard/PageShell.tsx`

```tsx
import { PageHeader, LoadingSpinner, EmptyState, ErrorBanner, SearchField } from '@/components/dashboard/PageShell'
```

#### Settings UI — **inline in** `components/settings/SettingsScreen.tsx`

These are defined locally (not exported yet — **extract to `components/settings/primitives/` when porting new panels**):

| Component | Purpose |
|-----------|---------|
| `Toggle` | iOS-style switch (`role="switch"`) |
| `SettingsCard` | White card with `divide-y` rows |
| `SettingsRow` | Icon + label + description + chevron/value |
| `SectionLabel` | Uppercase section heading |
| `PanelHeader` | Back + title for sub-panels |
| `SaveButton` | Full-width save with "✓ Saved" state |
| `SuccessBanner` / `ErrorBanner` | Feedback |
| `FormField` | Label + children + hint |
| `Input` / `Select` / `Textarea` | Rounded-xl settings-styled inputs |

#### User profile sections — `components/users/ProfileSection.tsx`

Used by `EditUserProfile.tsx`.

#### Other libraries

- `@headlessui/react` — dialogs (sparse use)
- `@heroicons/react` — icons (sparse; many screens use inline SVG paths)
- `react-hook-form` — installed but **most forms use controlled `useState`**
- `clsx` — available for conditional classes

### Recommendation

**Hand-roll UI** matching `SettingsScreen.tsx` patterns. Do **not** write `<Card>` / `<Switch>` from shadcn. If building many new settings panels, extract shared primitives first:

```
components/settings/
  SettingsScreen.tsx          # panel router (useState)
  primitives/
    Toggle.tsx
    SettingsCard.tsx
    SettingsRow.tsx
    SectionLabel.tsx
    PanelHeader.tsx
    SaveButton.tsx
    SuccessBanner.tsx
    ErrorBanner.tsx
    FormField.tsx
  panels/
    WorkingHoursPanel.tsx     # example split
    ...
```

---

## 3. File & routing conventions

### Next.js App Router

- Pages: `app/dashboard/**/page.tsx`
- Dashboard layout (sidebar): `app/dashboard/layout.tsx`
- Custom 404 in dashboard shell: `app/dashboard/not-found.tsx`
- Setup flow: `app/setup/**` (guarded by `components/setup/SetupAuthGuard.tsx`)

### Screen vs component pattern

**Route files are thin wrappers.** Heavy UI lives in `components/`:

```tsx
// app/dashboard/settings/page.tsx
import SettingsScreen from '@/components/settings/SettingsScreen'
export default function SettingsPage() { return <SettingsScreen /> }
```

```tsx
// app/dashboard/tasks/page.tsx → components/tasks/TasksScreen.tsx
// app/dashboard/warnings/page.tsx → components/warnings/WarningsScreen.tsx
// app/dashboard/clients/page.tsx — inline (exception)
```

### Settings architecture (important)

`/dashboard/settings` is **one URL** with **internal panel state**, not separate routes per iOS settings screen:

```tsx
type Panel =
  | 'main' | 'profile' | 'password' | 'notifications' | 'organisation'
  | 'working-hours' | 'annual-leave-defaults' | 'schedule-options'
  | 'warnings' | 'payment-runs' | 'roles'
```

Sub-panels use `PanelHeader` + `onBack()` — no URL change.

**When to add a new route:** Only if the web needs a deep link (e.g. `/dashboard/settings/users` already exists for Manage users).

### Deliverable convention

When producing TSX for the user to paste into Cursor:

1. Put feature UI in `components/<feature>/`
2. Wire via thin `app/dashboard/.../page.tsx` OR add a new `Panel` to `SettingsScreen`
3. Use existing stores + `lib/settings/*` — no stubs
4. One PR / feature at a time; show diff per file

---

## 4. Data layer — NO invented hooks

### There is NO `useAppSettings()` or `useOrg()`

Use the real APIs below. **Do not leave `// TODO: wire to store` stubs** — the wiring already exists.

---

### Auth & organisation — `useAuthStore()`

**File:** `lib/stores/authStore.ts`

```tsx
const { user, organization, firebaseUser, loading, signIn, signOut } = useAuthStore()
```

- `user: User | null` — parsed permissions, super admin flag, profile fields
- `organization: Organization | null` — current org (from `user.organizationId`)
- Auto-listens to Firebase Auth; loads `users/{uid}` doc

---

### Org member roster — `useOrgUserStore()`

**File:** `lib/stores/siteAuditStore.ts` (historical name)

```tsx
const { users, loading, loadUsers } = useOrgUserStore()
useEffect(() => { if (organization?.id) loadUsers(organization.id) }, [organization?.id])
```

Use `getManagerUsers(users)` / `getOperativeModeUsers(users)` from `lib/staff/userRosterUtils.ts` — mirrors iOS roster segmentation.

---

### User CRUD — `useUserStore()`

**File:** `lib/stores/userStore.ts`

```tsx
const { getUser, saveUser, setUserActive, deleteUser, sendPasswordReset, applyAccountType, syncLinkedOperative } = useUserStore()
```

Payload building: `lib/firebase/userPayload.ts` (`buildSaveUserPayload`)  
Parsing: `lib/firebase/parseUser.ts` (`parseOrgUser`)

---

### Invites — `useInviteStore()`

**File:** `lib/stores/inviteStore.ts` → `lib/orgSetup/inviteUserCore.ts`

```tsx
const { inviteUser } = useInviteStore()
await inviteUser({ email, organizationId, firstName, surname, permissions, assignedManagerUserId, dayRate, ... })
```

---

### Organisation settings (org-wide) — `lib/settings/organizationSettings.ts`

**Load:**

```tsx
import { loadOrganizationDetails, type OrganizationDetails } from '@/lib/settings/organizationSettings'

const details = await loadOrganizationDetails(organization.id)
// details.payrollTimePolicy, .annualLeaveDefaults, .warningDetection, .invoicing, .myScheduleOptions
```

**Save (each writes to `organizations/{orgId}` doc):**

| iOS concept | Web function | Firestore field |
|-------------|--------------|-----------------|
| Working hours / payroll | `savePayrollPolicy(orgId, policy)` | `payrollTimePolicy` |
| Annual leave defaults | `saveAnnualLeaveDefaults(orgId, defaults)` | `annualLeaveDefaults` |
| Warning detection | `saveWarningDetection(orgId, settings)` | `warningDetection` |
| Payment runs / invoicing | `saveInvoicingSettings(orgId, settings)` | `invoicing` |
| My schedule options | `saveMyScheduleOptions(orgId, options)` | `settings` (embedded) |

**Types & defaults:** `OrgPayrollTimePolicy`, `DEFAULT_PAYROLL_POLICY`, etc. in same file.

**Validation:** `lib/settings/invoicingValidation.ts` for payment run date ranges.

**Subtitle formatters:** `formatPayrollSubtitle`, `formatAnnualLeaveSubtitle`, `formatScheduleOptionsSubtitle`.

---

### User notification preferences — `lib/settings/notificationPreferences.ts`

Stored on **user doc** (not org):

```tsx
import { loadNotificationPreferences, saveNotificationPreferences } from '@/lib/settings/notificationPreferences'

const prefs = await loadNotificationPreferences(user.id)
await saveNotificationPreferences(user.id, { materialOrderCutOff, materialCutOffHour, ... })
```

---

### Profile (name, mobile) — direct Firestore in SettingsScreen

```tsx
import { updateDoc, doc, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'

await updateDoc(doc(db, 'users', user.id), { firstName, surname, mobileNumber, updatedAt: Timestamp.now() })
// Also update useAuthStore.setState({ user: { ... } })
```

---

### Other Zustand stores (feature-specific)

| Store | File | Firestore focus |
|-------|------|-----------------|
| `useProjectStore` | `lib/stores/projectStore.ts` | `projects`, `smallWorks`, `clients` |
| `useOperativeStore` | `lib/stores/operativeStore.ts` | `operatives`, `managers`, `skills`, `qualifications` |
| `useBookingStore` | `lib/stores/bookingStore.ts` | `bookings` |
| `useManagerScheduleStore` | `lib/stores/managerScheduleStore.ts` | `managerSiteBookings` |
| `useTaskStore` | `lib/stores/taskStore.ts` | `tasks` |
| `useHolidayStore` | `lib/stores/holidayStore.ts` | `holidayBookings` |
| `useDashboardStore` | `lib/stores/dashboardStore.ts` | localStorage + `platformConfig` |
| `useMaterialCatalogStore` | `lib/stores/materialCatalogStore.ts` | `materialCatalogue` |
| `useWholesalerStore` | `lib/stores/wholesalerStore.ts` | `wholesalers` |
| `useSubcontractorStore` | `lib/stores/subcontractorStore.ts` | `subcontractors` |

Firebase init: `lib/firebase/config.ts` (`auth`, `db`, `storage`).

---

## 5. Standard settings panel pattern (copy this)

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import {
  loadOrganizationDetails,
  savePayrollPolicy,
  DEFAULT_PAYROLL_POLICY,
  type OrgPayrollTimePolicy,
} from '@/lib/settings/organizationSettings'

function ExamplePanel({ onBack }: { onBack: () => void }) {
  const { organization } = useAuthStore()
  const [policy, setPolicy] = useState<OrgPayrollTimePolicy>(DEFAULT_PAYROLL_POLICY)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!organization?.id) return
    loadOrganizationDetails(organization.id).then((details) => {
      if (details?.payrollTimePolicy) setPolicy(details.payrollTimePolicy)
    })
  }, [organization?.id])

  const save = async () => {
    if (!organization?.id) return
    // validate first → setError('...') and return if invalid
    setSaving(true)
    setError('')
    try {
      await savePayrollPolicy(organization.id, policy)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* PanelHeader, form fields, ErrorBanner, SuccessBanner, SaveButton */}
    </div>
  )
}
```

**Always:** load on mount → validate before save → show `ErrorBanner` / `SuccessBanner` or `SaveButton` saved state.

---

## 6. Firestore paths (iOS parity)

Prefix: `organizations/{organizationId}/`

| Collection / doc | Web route | Notes |
|------------------|-----------|-------|
| `clients` | `/dashboard/clients` | CRUD via `useProjectStore` |
| `projects` | `/dashboard/projects` | |
| `smallWorks` | `/dashboard/small-works` | |
| `operatives` | `/dashboard/operatives` | Roster docs; link to `users` by email |
| `managers` | `/dashboard/managers` | Roster docs; **Managers list UI uses `users` collection** |
| `bookings` | schedule / timesheets | |
| `managerSiteBookings` | `/dashboard/my-schedule` | Manager self-bookings |
| `holidayBookings` | `/dashboard/annual-leave` | |
| `tasks` | `/dashboard/tasks` | Created from Project Hub |
| `skills` | `/dashboard/skills` | |
| `qualifications` | `/dashboard/qualifications` | |
| `settings/jobTypes` | `/dashboard/job-types` | **Document** with `jobTypes: string[]` |
| `wholesalers` | `/dashboard/wholesalers` | |
| `materialCatalogue` | `/dashboard/materials` | |
| `subcontractors` | `/dashboard/sub-contractors` | |

Top-level: `users`, `organizations`, `invitations`, `platformConfig`.

Full table: `docs/IOS_FIRESTORE_PARITY.md`.

---

## 7. Navigation & permissions

**Sidebar:** `lib/navigation/dashboardNavigation.ts` + `lib/navigation/menuPermissions.ts`

```tsx
import { getDashboardNavItems } from '@/lib/navigation/dashboardNavigation'
import { hasAdminAccess, canManageUsers, canAccessTimesheets } from '@/lib/navigation/menuPermissions'
```

`parseUserPermissions()` mirrors iOS user doc permission flags.

**Managers list vs managers roster:**

- **Managers page** (`/dashboard/managers`) → `getManagerUsers(users)` from `users` collection
- **Managers roster** (`organizations/{orgId}/managers`) → used on project forms, may be empty until synced
- **Project create form** merges both; auto-creates roster entry on save if needed (`components/projects/ProjectForm.tsx`)

---

## 8. User / line manager rules (BUG-012 — decided)

**Product rule (matches iOS):**

- Line manager field shown for **managers and operatives** (not admins on invite form)
- **"No line manager"** is always a valid explicit choice (`assignedManagerUserId` empty → field deleted in Firestore)
- Do **not** block save when no manager selected
- Options from `getManagerUsers(users)` (admins + managers, not operative-mode)

**Files:** `components/users/InviteUserForm.tsx`, `components/users/EditUserProfile.tsx`

---

## 9. Types

**File:** `types/index.ts` — comment says "Mirrored from iOS App"

Key interfaces: `User`, `UserPermissions`, `Project`, `Client`, `Operative`, `Manager`, `Booking`, `Organization`.

`User.assignedManagerUserId?: string` — optional line manager user id.

---

## 10. Recent web fixes (audit — `docs/audit.md`)

Completed batches 1–8 + BUG-012. Still **not done:**

- **BUG-011** — replace native `<select multiple>` on project form with searchable multi-select (separate task)

When porting iOS screens, don't regress:

- Template literals for `orgId` in headers (use real `organization?.id`)
- Silent form failures (always validate + show errors)
- Managers dropdown empty on project create (use user roster)

---

## 11. iOS source reference

**iOS app path (read-only):** `/Users/farnienel/Desktop/Project Planner/Project Planner/`

| iOS | Web equivalent |
|-----|----------------|
| `Navigation/MainMenuCatalog.swift` | `lib/navigation/dashboardNavigation.ts` |
| `FirebaseBackend.swift` | `lib/stores/*`, `lib/firebase/*` |
| `AddUserView` | `components/users/InviteUserForm.tsx` |
| `ManageUsersView` | `app/dashboard/settings/users/page.tsx` |
| Settings / org views | `components/settings/SettingsScreen.tsx` |
| `InvoicingView` | `app/dashboard/timesheets/page.tsx` (simplified) |
| `MyScheduleView` | `app/dashboard/my-schedule/page.tsx` |
| `OrgSitesMapView` | `app/dashboard/site-map/page.tsx` |

Use multi-root Cursor workspace — see `docs/LINK_IOS_AND_WEB_IN_CURSOR.md`.

---

## 12. What NOT to do

1. **Don't invent hooks** (`useAppSettings`, `useOrg`, etc.)
2. **Don't add shadcn** without explicit approval
3. **Don't create new Firestore collection names** — match iOS / `IOS_FIRESTORE_PARITY.md`
4. **Don't use `organizations/{orgId}` as literal strings** in UI — interpolate `organization.id`
5. **Don't require line manager** when iOS allows "No line manager"
6. **Don't paste all iOS screens at once** — one panel/feature per PR
7. **Don't skip validation + success/error feedback** on saves
8. **Don't assume `managers` roster = managers list** — list uses `users`

---

## 13. Key file quick reference

```
app/
  dashboard/layout.tsx              # Sidebar shell
  dashboard/settings/page.tsx       # → SettingsScreen
  dashboard/not-found.tsx           # 404 in shell
  setup/page.tsx                    # OrgSetupWizard + SetupAuthGuard
  globals.css                       # Tailwind + --pp-* vars

components/
  forms/FormShell.tsx               # Form primitives
  dashboard/PageShell.tsx           # PageHeader, ErrorBanner, etc.
  settings/SettingsScreen.tsx     # All settings panels (split this when growing)
  users/InviteUserForm.tsx
  users/EditUserProfile.tsx
  projects/ProjectForm.tsx

lib/
  stores/authStore.ts
  stores/siteAuditStore.ts          # useOrgUserStore
  stores/userStore.ts
  stores/inviteStore.ts
  stores/projectStore.ts
  stores/operativeStore.ts
  settings/organizationSettings.ts  # Org settings load/save
  settings/notificationPreferences.ts
  staff/userRosterUtils.ts          # getManagerUsers, roster segments
  navigation/menuPermissions.ts
  navigation/dashboardNavigation.ts
  firebase/userPayload.ts
  firebase/projectPayload.ts
  utils/pluralize.ts

types/index.ts
docs/IOS_FIRESTORE_PARITY.md
docs/audit.md
```

---

## 14. Environment

```bash
npm run dev          # localhost:3000
npm run build        # must pass before PR
```

Firebase env vars: `NEXT_PUBLIC_FIREBASE_*` in `.env.local`  
Firestore rules: `firestore.rules` in repo — must be published to Firebase Console for setup/invites to work.

---

*Last updated after audit fixes + BUG-012 (No line manager). Regenerate when major architecture changes.*
