# 00 — iOS inventory

> Spec: `docs/ios-parity/IOS_PARITY_REBUILD.md` Phase 1 · Blueprint starting point: whole file, especially §1, §6, §9.
>
> **Swift tree status:** IOS_ROOT is **not on this Cloud Agent VM**. No `.xcodeproj`, `GoogleService-Info.plist`, or `.swift` files could be listed. This catalogue is reconstructed from `IOS_APP_BLUEPRINT.md` (built 16 Sep 2026 from the real iOS source: **210 Swift files**, ~115,000 lines). Line numbers and purposes come from Blueprint §9 and section file lists. **0 Swift files were opened on disk.** Every behavioural claim remains ❓ UNVERIFIED until the Xcode project is added to the workspace.

## Phase 0 access check

| Check | Result |
|---|---|
| List `IOS_ROOT` | **Failed.** Config placeholder is still `<<IOS_PROJECT_PATH>>`. Existing web note (`docs/IOS_FIRESTORE_PARITY.md`) points at `/Users/farnienel/Desktop/Project Planner/Project Planner/`. |
| `.xcodeproj` | Not found anywhere on this VM (`find` over `/workspace`, `/home`, `/opt`, `/tmp`). |
| `GoogleService-Info.plist` | Not found. Firebase project id taken from Blueprint §1 + web `.firebaserc`: `project-planner-f986c`. |
| `@main` app file | Blueprint: `Project_PlannerApp.swift`. Not on disk. |
| `.swift` count (excluding Pods / DerivedData / SourcePackages) | Blueprint claims **210**. Disk count **0**. |
| Cloud environment repos | Only `github.com/farnienel1/project-planner-web`. No iOS repo. |

**If you are Farnie:** add the iOS folder to this workspace (*File → Add Folder to Workspace…*), save the workspace, and make sure the Desktop folder is fully downloaded if it lives in iCloud. Then a follow-up chat can replace this reconstructed catalogue with a 100% on-disk catalogue.

## Web stack (`WEB_ROOT` = this repo)

Identified from `package.json`, `package-lock.json`, `app/`, `next.config.js`, `tailwind.config.js`.

| Item | Value |
|---|---|
| Package manager | npm (`package-lock.json`) |
| Framework | Next.js **16.2.7** (range `^16.1.1`), **App Router** (`app/`, no `pages/`) |
| React | 18.3.1 |
| Language | TypeScript 5.9.3 (`strict`) |
| Styling | Tailwind CSS 3.4.19 + PostCSS |
| Firebase JS SDK | 10.14.1 (`firebase/app`, `auth`, `firestore`, `storage` — **no Functions, no Analytics, no App Check, no Messaging**) |
| State | Zustand 4.5.7 |
| Forms | react-hook-form 7.70.0 |
| Dates | date-fns 3.6.0 |
| Calendar UI | react-big-calendar 1.19.4 |
| PDF | pdfjs-dist 4.10.38 (viewer); site-audit helpers in `lib/` |
| Payments (web-only) | stripe 22.2.2, `@stripe/stripe-js` 9.8.0 |
| UI primitives | Headless UI 1.7.19; custom Tailwind components under `components/` |
| Icon library declared | `@heroicons/react` 2.2.0 — **no imports found**. Actual icons are inline SVG path strings. Lucide is **not** installed. |
| Tests | **None.** No `*.test.*` / `*.spec.*`, no `test` script. |
| Lint | `"lint": "next lint"`; `eslint-config-next` is **14.0.4** while Next is 16.x |
| Zod | **Not installed.** Rebuild §5 says propose it at Stop Gate 1. |
| Firebase project file | `.firebaserc` → `project-planner-f986c`. `firebase.json` deploys `firestore.rules` only. **No `storage.rules`, no `firestore.indexes.json`, no `functions/`.** |
| Hosted URL (blueprint) | `https://project-planner-f986c.web.app` |

## iOS project metadata (from blueprint only)

| Item | Blueprint value | Evidence | Disk? |
|---|---|---|---|
| App folder | `Project Planner/` inside IOS_ROOT, containing `ContentView.swift`, `FirebaseBackend.swift`, `Core/`, `Models/`, `Navigation/`, `Views/` | Blueprint intro | ❌ |
| Bundle ID | `farnie.Project-Planner` | `GoogleService-Info.plist` (Blueprint §1) | ❌ |
| Firebase project | `project-planner-f986c` | same | ❌ |
| Storage bucket | `project-planner-f986c.firebasestorage.app` | same | ❌ |
| Firestore DB | `(default)` | `firestore.rules` (iOS + this web repo) | web rules only |
| UI | SwiftUI, custom shell, no system `TabView` | `ContentView.swift` | ❌ |
| Auth | Email/password only. No Apple/Google. No App Check. | `Project_PlannerApp.swift`, Blueprint §1 | ❌ |
| Locale | Device locale/TZ (UK); Monday-first weeks; `£`; `en_GB` for payroll emails | `Core/MondayFirstCalendarSupport.swift` | ❌ |
| Custom fonts | **None bundled.** System font. | Blueprint §4.3 | ❌ |
| Device capabilities | Camera, photos, location, push (FCM), MapKit, PDF, share sheet, haptics / Face ID / widgets **not applicable on web** | Blueprint §3.3 translation table + §6 | ❌ |
| Swift packages | Firebase iOS SDK (Auth, Firestore, Storage, Messaging), MapKit. Exact versions need `Package.resolved`. | Blueprint §1, §5.6 | ❌ |
| Deployment target | ❓ UNVERIFIED (needs `project.pbxproj`) | — | ❌ |

**iOS-only mechanisms not to port** (Blueprint §7): `SmartCacheService`, `PersistenceService`, `DataPersistenceManager`, `Offline*` stores/outbox, `LocalNotificationService`, `PlaygroundDemoSeeder`. These files may exist in the 210-file tree even when not listed below.

---

## Swift catalogue

Paths are relative to the iOS **app source folder**. Line counts in parentheses are from Blueprint §9 where given; otherwise `~` from a cited location or unknown.

### App entry, auth, branding

| Path | Lines | Purpose |
|---|---|---|
| `Project_PlannerApp.swift` | ? | `@main` App: Firebase configure, inject 12 stores |
| `ProjectPlannerRootView.swift` | 331 | Auth gate, splash, org bootstrap wiring (`PlannerStoreWiring`) |
| `ContentView.swift` | 970 | Custom shell, bottom bar tabs, booking toast |
| `AppBranding.swift` | 37 | Splash (`AppLaunchSplashView`), hosted web URL |
| `AuthenticationView.swift` | 469 | Login screen (matches web login by design) |
| `PasswordResetView.swift` | 132 | Reset Password sheet |
| `FirebaseBackend.swift` | ~8500+ (cites ~L8434) | Hand-written Firestore/Storage/Auth dictionary layer |
| `Core/FirebaseBackend+OrganizationMembership.swift` | ? | Switch organisation, members map |
| `ResendEmailService.swift` | ? | POST `sendProjectPlannerEmail` (us-central1) |

### Models

| Path | Lines | Purpose |
|---|---|---|
| `Models/AppModels.swift` | ? (perms ~L147, labels ~L958, payroll ~L1041) | User, permissions, org settings, theme, job types, trade types |
| `Models/ProjectTask.swift` | ? | Task model |
| `Models/NotificationModel.swift` | ? | Inbox notification + types |
| `Models/AnnualLeavePolicy.swift` | ? | Leave-year, consumption, carry-over |
| `Models/UserRoleTransitionPolicy.swift` | ? | Role-change consistency |
| `Models/WarningModels.swift` | ? | Warning kinds / priorities |
| `Models/OrgWarningDetectionSettings.swift` | ? | Org `warningDetection` map |
| `Models/OperativeBookingInterval.swift` | ? | Operative booking time interval |
| `Models/ManagerScheduleInterval.swift` | ? | Manager site-booking interval |

### Navigation

| Path | Lines | Purpose |
|---|---|---|
| `Navigation/MainMenuCatalog.swift` | ? | Single catalogue for Main Menu + More |
| `Navigation/NotificationDeepLink.swift` | ? | Notification `type` → destination |

### Core stores and engines

| Path | Lines | Purpose |
|---|---|---|
| `Core/UserStore.swift` | ? (~L445–900 perms) | Current user, permissions helpers, save user |
| `Core/ProjectStore.swift` | ? | Projects, small works, job types, clients |
| `Core/ProjectTaskStore.swift` | ? | Tasks; 500-task cap |
| `Core/OperativeStore.swift` | ? | Roster operatives |
| `Core/BookingStore.swift` | ? | Operative bookings (live) |
| `Core/ManagerScheduleStore.swift` | ? | Manager site bookings (live) |
| `Core/HolidayStore.swift` | ? | Annual leave bookings |
| `Core/SubcontractorStore.swift` | ? | Firms + contacts |
| `Core/MaterialCatalogStore.swift` | ? | Organisation catalogue |
| `Core/ProjectTaskStore.swift` | ? | (listed) |
| `Core/AppSettingsStore.swift` | ? | Theme + accent (device-only) |
| `Core/NotificationService.swift` | ? | Create/list notifications |
| `Core/LocalNotificationService.swift` | ? | Device local reminders (do not port) |
| `Core/WorkAccess.swift` | ? | `visibleWorks`, live users on a job |
| `Core/QualificationsAccessPolicy.swift` | ? | Hub vs My Qualifications |
| `Core/LineManagerSupport.swift` | ? | Line-manager assignment |
| `Core/ProjectManagerPickerSupport.swift` | ? | Manager chips on jobs |
| `Core/OrganizationMembershipSupport.swift` | ? | Trial / lock / first-trial-only |
| `Core/OrganizationCurrencyCatalog.swift` | ? | Currency list |
| `Core/CountryCapitalDirectory.swift` | ? | Default map centre |
| `Core/MondayFirstCalendarSupport.swift` | ? | Weeks start Monday |
| `Core/GeocodingCacheService.swift` | ? | Apple geocoder cache |
| `Core/BankHolidayService.swift` | ? | Nager.Date fetch |
| `Core/BankHolidayRegionDirectory.swift` | ? | UK region filter |
| `Core/AnnualLeaveCalendarRules.swift` | ? | Bookable days |
| `Core/PayrollHoursEngine.swift` | ? | Single payroll hours calculator |
| `Core/PayrollTimePolicyCatalog.swift` | ? | Which policy applies on a day |
| `Core/PayrollRateResolver.swift` | ? | Effective rate / PAYE £0 |
| `Core/PayrollPolicyBookingRecalibrator.swift` | ? | Recalc bookings after hours change |
| `Core/TimesheetPayrollPolicy.swift` | ? | Pay periods + timesheet access |
| `Core/TimesheetPayrollCollector.swift` | ? | Payroll lines for a person/period |
| `Core/InvoicingPeriodResolver.swift` | ? | Current invoicing period |
| `Core/WeeklyReportExportBuilder.swift` | ? | Weekly report xlsx + PDF content |
| `Core/WarningsComputation.swift` | ? | Clash / unbooked / cut-off detection |
| `Core/WarningsService.swift` | ? | Warning scan orchestration |
| `Core/WarningsRefreshHelper.swift` | ? | Manual refresh, cache for Home |
| `Core/WarningResolutionStore.swift` | ? | Device-local dismissals (UserDefaults) |
| `Core/ScheduleBookingConflictSupport.swift` | ? | Overlap / clash |
| `Core/ScheduleDateSelectionPolicy.swift` | ? | Which dates can be selected |
| `Core/ScheduleHoursTimelineBar.swift` | ? | Hours timeline UI helper |
| `Core/MaterialCatalogCSV.swift` | ? | Catalogue CSV import/export |
| `Core/MaterialCatalogDuplicateDetection.swift` | ? | Duplicate material alert |
| `Core/MaterialRequestEmailBuilder.swift` | ? | Quote/order HTML email |
| `Core/MaterialOfflineService.swift` | ? | iOS-only offline materials |
| `Core/OfflineMaterialLocalStore.swift` | ? | iOS-only |
| `Core/SiteAuditOfflineStore.swift` | ? | iOS-only |

### Views — screens (Blueprint §9)

| Path | Lines | Purpose (structs / titles) |
|---|---|---|
| `Views/AddUserView.swift` | 1282 | Add-user wizard |
| `Views/AdminManagerMaterialsView.swift` | 217 | Staff materials |
| `Views/AnnualLeaveUsageHeroView.swift` | 95 | Allowance hero |
| `Views/AppearanceSettingsView.swift` | 51 | Appearance |
| `Views/AssignQualificationsPickerView.swift` | 83 | Add qualifications picker |
| `Views/BookLabourFlowView.swift` | 1910 | Book labour + custom hours |
| `Views/BookingConfirmationView.swift` | 56 | Confirm booking |
| `Views/BookingHoursEditSheet.swift` | 928 | Operative custom hours + timeline bar |
| `Views/ChangePasswordView.swift` | 136 | Change password |
| `Views/ClientsView.swift` | 279 | Clients list + Client Details |
| `Views/CompanyDetailsEditView.swift` | 323 | Company details |
| `Views/CreateClientView.swift` | 116 | New Client |
| `Views/CreateManagerView.swift` | 169 | New Manager (roster) |
| `Views/CreateOperativeView.swift` | 177 | New Operative (roster) |
| `Views/CreateProjectView.swift` | 896 | New project |
| `Views/CreateSmallWorksView.swift` | 892 | New small works |
| `Views/DLScreens.swift` | 1507 | Deadlines screens/sheets |
| `Views/DailyOverviewView.swift` | 1876 | Daily overview + Date Overview |
| `Views/EditClientView.swift` | 147 | Edit Client |
| `Views/EditMaterialView.swift` | 188 | Edit Material |
| `Views/EditProjectView.swift` | 750 | Edit project / Set address |
| `Views/EditWholesalerView.swift` | 196 | Edit Wholesaler |
| `Views/GeneralAppSettingsView.swift` | 167 | General + My Schedule options |
| `Views/HSHealthSafetyDocuments.swift` | 650 | RAMS / other / signed talk detail |
| `Views/HelpView.swift` | 669 | Help & FAQs |
| `Views/HolidayReportView.swift` | 179 | Holiday Report |
| `Views/HolidayView.swift` | 1535 | Annual leave + Update booking |
| `Views/HomeOverviewCustomization.swift` | 204 | Dashboard metrics sheet |
| `Views/HomeView.swift` | 2214 | Home, My Qualifications, My Profile, Add quick action |
| `Views/InvoicingView.swift` | 5384 | Timesheets hub and all timesheet/invoice sheets |
| `Views/JobTypesManagementView.swift` | 169 | Job Types Management |
| `Views/LineManagersMultiSelectSheet.swift` | 117 | Line managers picker |
| `Views/MainMenuMoreSheet.swift` | 271 | More |
| `Views/ManageUsersView.swift` | 3763 | Manage Users + EditUserView |
| `Views/ManagersView.swift` | 345 | Managers + Filter Managers |
| `Views/MapPinPickerView.swift` | 149 | Set pin on map |
| `Views/MaterialsAddWithCatalogueSheet.swift` | 673 | Add material from catalogue |
| `Views/MaterialsCatalogueFlow.swift` | 1201 | Catalogue root/editor/detail/CSV |
| `Views/MaterialsProjectListUI.swift` | 721 | Quote & order history sheet |
| `Views/MaterialsSendListSheet.swift` | 725 | Send list / Review materials |
| `Views/MaterialsView.swift` | 870 | Materials + operative materials + Add Materials |
| `Views/MyScheduleView.swift` | 2657 | My Schedule, self-booking, Book sheet |
| `Views/NotificationsView.swift` | 229 | Notifications inbox |
| `Views/OfflineStatusBanner.swift` | 172 | Offline banner + Changes to sync |
| `Views/OperativeAnnualLeaveViews.swift` | 1355 | Team leave hub/directory/calendar |
| `Views/OperativeProfileView.swift` | 408 | Operative Profile |
| `Views/OperativeQualificationsEditorView.swift` | 669 | Assign/edit quals on a person |
| `Views/OperativesView.swift` | 1277 | Manage Operatives + add/edit/filter/finish setup |
| `Views/OrgSitesMapView.swift` | 453 | Site Map |
| `Views/OrganisationAnnualLeaveDefaultsView.swift` | 123 | Org annual leave defaults |
| `Views/OrganisationCurrencyView.swift` | 100 | Currency |
| `Views/OrganisationInvoicingSettingsView.swift` | 404 | Payment Runs and Timesheets |
| `Views/OrganisationMaterialCutOffSettingsView.swift` | 240 | Material cut-off |
| `Views/OrganisationSettingsHubView.swift` | 533 | Organisation hub |
| `Views/OrganisationWarningsSettingsView.swift` | 732 | Warnings settings + Excluded users |
| `Views/OrganisationWorkingHoursView.swift` | 1298 | Working hours & overtime |
| `Views/PolicyAcceptanceView.swift` | 102 | Privacy-policy gate |
| `Views/PrivacyPolicyView.swift` | 246 | Privacy Policy |
| `Views/ProjectActiveOperativesView.swift` | 369 | Active users + booking history |
| `Views/ProjectDeadlinesView.swift` | 290 | Deadlines wrapper |
| `Views/ProjectDetailView.swift` | 6348 | Job hub + visibility + tasks + completion |
| `Views/ProjectHealthSafetyView.swift` | 3524 | H&S hub, toolbox, RAMS, other |
| `Views/ProjectsView.swift` | 632 | Projects list + Add Project |
| `Views/QualificationsManagementView.swift` | 445 | Organisation qualifications |
| `Views/QuickMenuSheet.swift` | 426 | Main Menu |
| `Views/ScheduleOperativeView.swift` | 1665 | Schedule booking |
| `Views/ScheduleSubcontractorView.swift` | 596 | Schedule Sub Contractor |
| `Views/SelectOperativesView.swift` | 363 | Select people |
| `Views/SendToWholesalerView.swift` | 289 | Send to Wholesaler |
| `Views/SettingsHubSupportViews.swift` | 431 | My profile + My notifications |
| `Views/SettingsView.swift` | 945 | Settings hub (includes developer tools — do not port) |
| `Views/SiteAudit/SiteAuditRevampViews.swift` | 795 | Create-flow steps |
| `Views/SiteAuditView.swift` | 1993 | Site Audit hub/browser/create/detail |
| `Views/SmallWorksView.swift` | 537 | Small works list |
| `Views/SubcontractorBookingEditSheet.swift` | 132 | Edit subcontractor booking |
| `Views/SubcontractorsView.swift` | 1068 | Sub contractors directory/editor |
| `Views/SwitchOrganisationView.swift` | 215 | Switch organisation |
| `Views/TasksDetailView.swift` | 1009 | Tasks (from Home) |
| `Views/TimesheetManagerReviewSupport.swift` | 532 | Manager hours/amount edit sheets |
| `Views/WarningsDetailView.swift` | 855 | Warnings + dismiss confirm |
| `Views/WeeklyReportView.swift` | 1577 | Weekly report |
| `Views/WholesalersRevampViews.swift` | 1297 | Wholesalers list/detail/history/editor |
| `Views/WholesalersView.swift` | 222 | Contact add/edit wrapper |

### Views — supporting (cited, not in §9 screen table)

These are **in scope**. They are components, tokens, or flows used by the screens above.

| Path | Purpose |
|---|---|
| `Views/CreateWorkVisibilitySection.swift` | Hidden managers/operatives on create |
| `Views/HomeQuickActionRegistry.swift` | Quick-action tile ids, tints, defaults |
| `Views/HomeUpNextSupport.swift` | Up Next rows from own bookings |
| `Views/AnnualLeaveCalendarDayDecorations.swift` | Calendar day marks |
| `Views/AnnualLeaveEntitlementEditor.swift` | Days/year, months, carry-over |
| `Views/HolidayChrome.swift` | Annual-leave palette |
| `Views/ManageOperativesSearch.swift` | Operatives search |
| `Views/ManageUserProfileChrome.swift` | Profile chrome + palette |
| `Views/MaterialsOrderingTheme.swift` | Materials palette |
| `Views/ProjectSmallWorksRevampTokens.swift` | Core canvas/card/chip tokens + list chrome |
| `Views/ProjectSchedulingV2Support.swift` | Job scheduling week UI |
| `Views/ScheduleCalendarExport.swift` | Google/Outlook/Apple + `.ics` |
| `Views/ScheduleOperativeConflictViews.swift` | Clash review panels |
| `Views/ScheduleOverlapWarningViews.swift` | Overlap warning |
| `Views/BookingClashWarningCard.swift` | Clash card |
| `Views/StaffTradeTypeFormSection.swift` | Trade picker |
| `Views/SettingsHubChrome.swift` | Settings cards / save button |
| `Views/WeeklyReportLaunch.swift` | Weekly report open shell |
| `Views/WarningsRevampViews.swift` | Hero, chips, badges |
| `Views/HSTheme.swift` | H&S palette |
| `Views/HSComponents.swift` | 19 H&S components (Blueprint §4.5) |
| `Views/DLComponents.swift` | Deadlines components |
| `Views/DLModels.swift` | Deadline map / history |
| `Views/SiteAudit/SiteAuditDesignSystem.swift` | Site-audit tokens |
| `Views/SiteAudit/SiteAuditPDFBuilder.swift` | Site-audit PDF layout |
| `Views/SiteAudit/SiteAuditMediaProcessor.swift` | Photo resize 1280px / JPEG 0.72 |
| `Resources/TOOLBOX-TALK-LIBRARY.md` | H&S talk library content (not Swift) |

### Likely present but not cited in the blueprint (still in the 210)

The blueprint intro counts **210** Swift files. Unique paths reconstructed above are **fewer than 210** (this catalogue has **~155 named files**). The remainder is almost certainly: extra `FirebaseBackend+*.swift` extensions, extra `Core/Offline*`, cache/persistence, playground seeder, tests, and small view helpers. **Do not treat this list as the 210 until the disk tree is counted.**

---

## Features / screens outside the rebuild §9 *build-order* table — still in scope

Rebuild Phase 3 §9 lists 24 sections. These iOS surfaces exist in the blueprint and **are in scope unless Farnie says otherwise**:

| Surface | Where it lives | Why it is easy to miss |
|---|---|---|
| Login, splash, password reset, privacy-policy gate | §6.0 | Phase 2, not a numbered section |
| Home (metrics, quick actions, Up Next, maintenance card, task-limit banner) | §3.4, §6.18 | Phase 2 |
| Main Menu / More / Edit main menu bar | §2.1–2.2 | Shell |
| Role preview banner | §1.4 | Shell |
| Notifications inbox + deep links | §6.25, §2.4 | Section 24 |
| Job tile: View (visibility) | §6.24 | Folded into section 16 |
| Job tile: Deadlines | §6.24 | Folded into section 16; **no web route today** |
| Job tile: Active users | §6.24 | Folded into section 16; **no web route today** |
| Job tile: H&S / Location / Materials / Site Audit | §6.24 | Folded into section 16 |
| Finish Operative Setup | `OperativesView.swift` L1088 | Inside Operatives |
| Holiday Report | `HolidayReportView.swift` | From Manage Users |
| Developer tools in Settings | `SettingsView.swift` ~L430–680 | **Do not port** unless asked |
| Offline sync queue sheet | `OfflineStatusBanner.swift` L117 | Ask before porting outbox |
| Map pin picker | `MapPinPickerView.swift` | Shared by create/edit project |

## Coverage

| Metric | Count |
|---|---|
| Swift files claimed by blueprint | 210 |
| Swift files opened on disk this session | **0** |
| Unique Swift paths named in the blueprint and listed above | ~155 |
| §9 screen-index view files catalogued | 87 / 87 named in §9 |
| Coverage of **disk** Swift files | **0 of 210 (0%)** |

**Coverage: 0 of 210 Swift files catalogued from disk.**

Reconstructed named-file coverage of the blueprint’s own citations: **100% of cited paths are listed.** A true “X of Y Swift files catalogued” of **210 of 210** is blocked on IOS_ROOT.

## Blueprint corrections

None that can be proven without the Swift tree. Open gaps in the *inventory itself*:

1. Exact `Package.resolved` versions, deployment target, and entitlements.
2. The unnamed ~55 Swift files that make up the 210.
3. Whether `HSComponents.swift` / `DLComponents.swift` live under `Views/` or `Views/HS/` etc.

## Next

After Farnie adds IOS_ROOT, re-run Phase 0 step 1: list every `.swift` file with `wc -l`, fill the missing ~55, and replace ❓ UNVERIFIED line numbers.
