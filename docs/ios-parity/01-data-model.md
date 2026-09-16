# 01 — Data model

> Spec: rebuild Phase 1 `01-data-model.md` · Blueprint starting point: §5 (plus §1.3–1.6, §4 linkage).
>
> **Verification:** Swift not on disk. Field tables below are transcribed from Blueprint §5 with web-repo evidence (`firestore.rules`, `lib/firebase/*`, `types/index.ts`, stores). Items that disagree with the current web writers are flagged. ❓ UNVERIFIED means “needs the Swift save/load function”.

## 1. Firebase services in use

| Service | iOS (blueprint) | Web (this repo) | Match? |
|---|---|---|---|
| Auth | Email/password only | Email/password (`signInWithEmailAndPassword`, `createUserWithEmailAndPassword`, reset, reauth) | ✅ providers. ⚠️ Web also `sendEmailVerification` during `/setup`. |
| Firestore | `(default)` DB, hand-written dictionaries | `getFirestore(app)` default DB, hand-written payloads | ✅ DB. ⚠️ converters are incomplete / sometimes wrong (see models). |
| Storage | `project-planner-f986c.firebasestorage.app` | `getStorage(app)` using `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | ⚠️ `.env.example` shows `project-planner-f986c.appspot.com` |
| Cloud Messaging | FCM tokens on `users.pushTokens` | Not used | ⚠️ web push optional (Gate 1) |
| Cloud Functions | HTTP `sendProjectPlannerEmail` us-central1 | **Not called.** Invites go through Next API + Resend (`lib/email/resendClient.ts`) | ❌ |
| App Check | Not used | Not used | ✅ |
| Analytics | Not used | Not used | ✅ |
| Apple / Google sign-in | Not used | Not used | ✅ |

## 2. Linkage checklist (rebuild §4)

- [ ] **PROJECT_ID** — Blueprint `GoogleService-Info.plist` = `project-planner-f986c`. Web `.firebaserc` default is the same. Runtime value is `NEXT_PUBLIC_FIREBASE_PROJECT_ID` (not committed). **Cannot confirm the Cloud Agent `.env.local` from this turn.** If the web app is not registered in that project, Farnie must add a Web app in Firebase console.
- [x] **Firestore database ID** — `(default)` on both (blueprint + `getFirestore()` with no named DB).
- [ ] **Storage bucket** — iOS `project-planner-f986c.firebasestorage.app` vs example `…appspot.com`. Same project, different hostname style; confirm which the rules/bucket actually use.
- [x] **Functions region** — iOS: `us-central1`. Web currently does not call Functions.
- [x] **Auth providers** — email/password only on both.
- [ ] **Authorized domains** — must include hosted origin(s) (`project-planner-f986c.web.app`, any Netlify domain, localhost). Console check needed.
- [x] **User ↔ org ↔ role** — `users/{uid}` with `organizationId` + flat permission flags + `role`. Web `authStore` loads this doc. Placeholder merge: iOS `mergePlaceholderUserDocOntoAuthUidIfNeeded` (`FirebaseBackend.swift` ~L3319). Web invite completion is `lib/invites/completeInviteSetup.ts` — ❓ must be compared in Phase 2.
- [x] **Org scoping** — everything except `users`, `invitations`, `platformConfig` lives under `organizations/{orgId}/…`. Web `orgId` from `users.organizationId`.
- [x] **Permission matrix** — see §8 below. Web `lib/navigation/menuPermissions.ts` is a **partial, divergent** port.
- [x] **Add User** — iOS does **not** create an Auth user (`createUserInvitation` ~L4672). Writes invitation + placeholder `users/{UUID}` + `userEmails` + email. Web `inviteStore` / `inviteUserCore` follows that idea. **Never `createUserWithEmailAndPassword` on the admin’s main auth instance.** Web `/setup` **does** create Auth users for brand-new orgs (web-only). Invitees use `/setup-password` (App Router). iOS emails `/setup-password.html?token=` — **route mismatch**.
- [x] **App Check** — off.
- [ ] **Rules location** — `firestore.rules` is in **this** repo. `storage.rules` is in **neither** tree (Blueprint §8.10).
- [ ] **Indexes** — no `firestore.indexes.json` in this repo. iOS timesheet history avoids a composite index by querying `settings` `where userId == uid` and sorting in memory.
- [x] **Live vs one-off** — iOS live: org doc, `bookings`, `managerSiteBookings`, per-project `materials`, `notifications`. **Web: zero `onSnapshot` usages.** All stores `getDocs` once.

## 3. Collection tree

```
invitations/{UPPERCASE-UUID}          # public read (setup page)
users/{authUid | placeholder-UUID}    # merge writes
  orgMemberships/{orgId}              # WEB-ONLY
platformConfig/{docId}                # WEB-ONLY (rules allow; iOS unused)
organizations/{orgId}                 # merge
  userEmails/{emailLower}             # { userId }
  projects/{UPPERCASE-UUID}           # overwrite
    healthSafety/{id}                 # rules allow; iOS does NOT store H&S here
  smallWorks/{UPPERCASE-UUID}         # overwrite; same shape as projects
    healthSafety/{id}
  clients/{id}
  operatives/{id}                     # roster; no denormalised id field
  managers/{id}
  qualifications/{id}                 # org templates; batch
  skills/{id}                         # DEPRECATED
  bookings/{id}                       # merge; LIVE
  managerSiteBookings/{id}            # merge; LIVE
  subcontractorBookings/{id}          # overwrite
  holidayBookings/{id}                # merge; rules currently any auth user
  tasks/{id}                          # overwrite; no top-level id field
  materials/{id}                      # overwrite; LIVE per project
  materialCatalogue/{id}              # overwrite
  materialSendRecords/{id}
  wholesalers/{id}
  subcontractors/{id}
  siteAudits/{id}                     # overwrite
  notifications/{id}                  # overwrite; LIVE inbox; no id field
  operativeDayRateHistory/{id}        # ❓ path cited in blueprint; confirm rules catch-all read
  operativeProfiles/{uid}
  acceptedBookingClashes/{id}         # WEB-ONLY
  dashboardLayouts/{uid}              # WEB-ONLY
  settings/{docId}                    # mixed merge/overwrite
    jobTypes                          # overwrite { jobTypes: string[] }
    tradeTypeInventory                # merge { trades: string[] }
    deadlineAssignments               # merge
    deadlines_{projects|smallWorks}_{PROJECTID}
    healthSafety_{projects|smallWorks}_{PROJECTID}
    timesheet_{uid}_{weekStartEpochSeconds}
```

**ID strategy:** organisation entities = `UUID().uuidString` **UPPERCASE**. `users` = Auth UID (placeholders = random uppercase UUID). `userEmails` = lowercased email. Timesheet settings id uses London local midnight epoch seconds.

## 4. Enums (exact raw values)

| Enum | Raw values | Notes |
|---|---|---|
| `User.role` | `basic`, `admin`, `manager`, `operative`, `viewer` | Missing → read as `viewer` |
| `employmentType` | `paye`, `self_employed` | **Web currently writes `selfEmployed`** (`userPayload.ts`). This can make iOS miss the type. |
| `StaffTradeType` | `Electrician`, `Plumber`, `AC Engineer`, `Ventilation`, `Gas Engineer`, `Carpenter`, `Roofer`, `Bricklayer`, `Groundworker`, `Finance`, `Contract Manager`, `Project Manager`, `Site Manager`, `Supervisor`, `Installer`, `Commissioning Engineer`, `Programmer`, `Scaffolder`, `Brick & Block`, `Dryliner`, `Painter & Decorator`, `Demolition Operative`, `Steel Fixer`, `Plant Operator`, `Other` | |
| Job `jobType` | `CAT A`, `CAT B`, `Small Works`, `Maintenance` | Small works docs use `Small Works`. Display type is `customJobType`. |
| Legacy `manager` | `N/A`, `Adam`, `Billey`, `Charley`, `Farnie`, `Fin`, `Greg`, `Morgan`, `Ross`, `Custom` | **New/edited jobs write `Custom`.** Web `projectPayload.ts` writes `managerLegacy \|\| 'Project Manager'` — **wrong**. |
| Task `priority` | `Low`, `Normal`, `High`, `Urgent` | |
| Task `status` | `To Do`, `In Progress`, `Completed` | |
| Booking `timeSlot` (operative / sub) | `AM`, `PM`, `FULL DAY`, `Evening`, `Overtime`, `CUSTOM_HOURS` | Space in `FULL DAY` |
| Booking `status` | `Confirmed`, `Tentative`, `Cancelled`, `Completed` | **Web enum is `confirmed` / `pending` / `cancelled`.** iOS parsers that `as?` the raw string will **skip** lowercase docs. |
| Manager site `timeSlot` | `AM`, `PM`, `FULL_DAY`, `CUSTOM_HOURS` | **Underscore** in `FULL_DAY` |
| Manager `locationType` | `project`, `small_work`, `office`, `working_from_home`, `site_survey`, `custom` | |
| Holiday `status` | `pending`, `approved`, `rejected` | |
| Holiday `timeSlot` | `FULL DAY`, `AM`, `PM` | |
| Material `unit` | `Number`, `Box`, `Length`, `Drum`, `Pallet` | |
| Material `lengthUnit` | `M`, `MM` | |
| Material `status` | `draft`, `sentForQuote`, `ordered` | |
| Material `lastSentRequestType` | `Quote`, `Order` | **Web types `quote` \| `order` (lowercase).** |
| Site audit `type` | `General`, `Variations`, `Snags` | |
| Deadline `status` | `notStarted`, `inProgress`, `blocked`, `complete` | |
| Invoicing `paymentRunMode` | `date_ranges`, `recurring_timeframe` | |
| Invoicing `paymentDateMode` | `specific_dates`, `recurring_date` | |
| Weekday (invoicing) | `monday` … `sunday` | |
| Timesheet `managerDecision` | `pending`, `approved`, `declined`, `edited` | |
| Org `members` values | `admin`, `manager`, `member` | |
| Subcontractor contact `position` | `Finance`, `Contract Manager`, `Project Manager`, `Site Manager`, `Supervisor`, `Installer` | |
| Notification `type` | see Blueprint §2.4 | |
| `ThemePreference` | Light (default), Dark, Match system | Device/`localStorage` only |
| `AppColorScheme` | Blue `#0D67ED`, Green, Yellow, Pink | Device only |
| `RoleTestingPreset` | Super Admin, Admin, Manager, Operative | Nav preview only |

## 5. Queries and listeners

| Collection | Filters / order / limit | Live? | Used by |
|---|---|---|---|
| `users/{uid}` | get by auth uid | one-off; reload on foreground | boot, permissions |
| `organizations/{orgId}` | get | **live on iOS** | boot, settings, labels |
| `projects` | org subcollection; filter small-works out in memory; visibility `WorkAccess.visibleWorks` | one-off + refresh | Projects, Home, map |
| `smallWorks` | same | one-off | Small works |
| `clients` | org | one-off | Clients |
| `operatives` | org | one-off | Operatives, matching by email |
| `managers` | org | one-off | Managers, job chips |
| `bookings` | org | **live** | schedule, Home Up Next, timesheets, warnings, map |
| `managerSiteBookings` | org | **live** | My Schedule, daily overview, timesheets |
| `subcontractorBookings` | org | one-off | job scheduling |
| `holidayBookings` | org | deferred load | Annual leave, Home, daily overview |
| `tasks` | org; cap 500 per project | one-off | Tasks, Home metrics |
| `materials` | org, typically by `projectId` + day | **live per project** | Materials tile |
| `materialCatalogue` | org | one-off | Catalogue |
| `materialSendRecords` | org, filter by wholesaler/project | one-off | Wholesaler history |
| `wholesalers` | org | one-off | Wholesalers |
| `subcontractors` | org | one-off | Sub contractors |
| `siteAudits` | org; visibility for operatives | one-off | Site audit |
| `qualifications` | org | one-off | Qualifications hub |
| `notifications` | org; inbox filters `userId` / permission | **live inbox** | Bell, Notifications |
| `settings/jobTypes` | single doc | one-off | Job types, create project |
| `settings/timesheet_*` | `where userId == uid`, sort in memory | merge / one-off | Timesheets |
| `settings/healthSafety_*` | get doc by job | merge | H&S |
| `settings/deadlines_*` | get doc by job | merge | Deadlines |
| `invitations/{id}` | public get by token | one-off | setup-password |

**Web today:** every store uses `getDocs`/`getDoc` (see `lib/stores/*`). No `onSnapshot`.

## 6. Writes: merge vs overwrite

| Write | Style | Notes |
|---|---|---|
| `users/{uid}` | **merge** | `deleteField()` for empty mobile, some booking-like empties; `arrayUnion` push tokens |
| `organizations/{orgId}` | **merge** | settings maps |
| `bookings`, `managerSiteBookings`, `holidayBookings` | **merge** | custom-hours fields deleted when not used |
| `settings` timesheet / H&S / deadlines / trade inventory | **merge** | |
| projects, smallWorks, clients, operatives, managers, tasks, notifications, materials, catalogue, send records, siteAudits, subcontractors, subcontractorBookings, `settings/jobTypes` | **overwrite** (`setData` no merge) | **Do not store web-only fields on these docs** |

Batches: org qualification templates. Transactions: ❓ UNVERIFIED (placeholder merge). Invitation flow is several sequential writes, not necessarily one batch.

## 7. Storage paths

From `FirebaseBackend.swift` ~L2335–2600 (blueprint). `{ts}` = Unix seconds; spaces in file names → `_`.

| What | Path | Format |
|---|---|---|
| Task file | `organizations/{orgId}/tasks/{taskId}/files/{uid}_{ts}_{fileName}` | as uploaded |
| Task image | `organizations/{orgId}/tasks/{taskId}/images/{uid}_{ts}_{name}.jpg` | JPEG 0.8 |
| H&S file | `organizations/{orgId}/healthSafety/{projectId}/{category}/{uid}_{ts}_{fileName}` | as uploaded |
| Site audit photo | `organizations/{orgId}/siteAudits/{auditId}/images/{uid}_{ts}_{name}.jpg` | max side 1280, JPEG 0.72 |
| Profile photo | `organizations/{orgId}/userProfiles/{uid}/profile.jpg` | JPEG 0.82 |
| Company logo | `organizations/{orgId}/branding/company_logo/{uid}_{ts}.jpg` | JPEG 0.75 |
| Qualification certificate | `organizations/{orgId}/operatives/{operativeId}/qualifications/{qualificationId}/certificates/{uid}_{ts}_{name}` | as uploaded |
| Timesheet export PDF | `organizations/{orgId}/timesheetExports/{stamp}_{name}` | PDF |

## 8. Callable / HTTP functions

| Name | Region | Auth | Payload | Response |
|---|---|---|---|---|
| `sendProjectPlannerEmail` | us-central1 | **none** (Blueprint §8.4) | `{ to, subject, html, cc?, replyTo?, fromName?, attachments?: [{ filename, content (b64), type, content_type }] }` | ❓ UNVERIFIED |

**Never put an email API key in the web client.** Web currently uses Resend from Next.js API routes instead of this function.

External HTTP (not Cloud Functions):

| Service | URL |
|---|---|
| Bank holidays | `https://date.nager.at/api/v3/PublicHolidays/{year}/{countryCode}` |
| OSM tiles (iOS overlay) | `https://tile.openstreetmap.org/{z}/{x}/{y}.png` |

## 9. Role / permission matrix

Permission flags live **flat on `users/{uid}`** (not nested). Defaults when missing (Blueprint §1.4):

| Flag | Default |
|---|---|
| `adminAccess` `manager` `operatives` `qualifications` `materials` `projects` `smallWorks` `operativeMode` `annualLeaveSelfBook` `weeklyReports` `subContractors` | false |
| `skills` | false, **always written false** (deprecated) |
| `dailyOverview` `siteAudit` `wholesalersOrderHistory` | **true** |

Helpers (`Core/UserStore.swift` ~L445–900) — port names into `lib/permissions.ts`:

| Function | Rule |
|---|---|
| `hasAdminAccess` | not operativeMode AND (isSuperAdmin OR adminAccess OR role==admin) |
| `isOperativeMode` | not admin AND (operativeMode OR role==operative) |
| `canManageUsers` | not operative AND admin |
| `canViewOperatives` | not operative AND (admin OR (manager AND operatives)) |
| `canViewManagers` / `canEditManagers` | not operative AND admin |
| `canManageMaterialCatalogue` / `canAccessWholesalers` | not operative AND (admin OR manager) |
| `canViewWholesalerOrderHistory` | not operative AND (admin OR (manager AND wholesalersOrderHistory)) |
| `canManageSubcontractors` | not operative AND (admin OR (manager AND subContractors)); **true while profile still loading** |
| `canManageWorkCatalogue(projects\|smallWorks)` | not operative AND (admin OR manager with that flag) |
| `canViewProjects` | **always true**; jobs filtered by `WorkAccess.visibleWorks` |
| `canViewSiteAudit` | operatives: their siteAudit flag; else true |
| `canViewMaterials` | operatives: their materials flag; else true |
| `canViewWeeklyReports` / `canViewDailyOverview` | not operative AND that flag |
| `canAccessQualificationsHub` / `canManageOrganisationQualifications` | `QualificationsAccessPolicy.swift` |
| `isAnnualLeaveFeatureEnabled` | `annualLeaveEnabled` default true |
| `canAccessTimesheetsSurface` | union of my-timesheets / operative-timesheets / PAYE disabled-message (`TimesheetPayrollPolicy.swift`) |
| `canAccessOperativeAnnualLeaveDirectory` | not operative AND (admin OR (manager AND operatives)) |
| `canEditTargetUserPermissions` | never org creator; admins yes; managers+operatives only if target is operative |
| `canDeleteUser` | never creator; super admin anyone except self; admin only non-admin targets |

**Job visibility (`Core/WorkAccess.swift` `visibleWorks`):**

- Operatives: non-cancelled booking OR assigned task OR deadline assignment; never if uid in `hiddenOperativeUserIds`.
- Admins: all jobs.
- Managers: drop `hiddenManagerUserIds`; if they can manage that catalogue, remaining jobs; else assigned manager / manager site booking / own operative booking.

**Web deviations (do not treat as iOS):** `canViewProjects` hides Projects/Small works nav from operatives; `canAccessTimesheets` is true for all operatives; `canManageSubcontractors` ignores the `subContractors` flag; `canManageUsers` nav does not include managers-with-operatives.

---

## 10. Models

Convention: **Optional** = Swift optional / may be absent. **Empty style** = what iOS writes when the user left it blank. TS type is the Phase 2 target.

### Model: AppUser  (`FirebaseBackend.swift` `saveUser` ~L4005, `parseAppUserDocument` ~L3349)

Path: `users/{uid}` · ID: Auth UID (placeholder = uppercase UUID) · Written by: `UserStore` / `saveUser`, invitation, merge-on-login · Read by: boot, Manage Users, permissions

| Swift property | Firestore key | Swift type | Firestore type | TS type | Optional | Default | Notes / evidence |
|---|---|---|---|---|---|---|---|
| email | `email` | String | string | string | no | — | lowercased for invited users |
| organizationId | `organizationId` | String | string | string | no | — | active org |
| role | `role` | enum | string | `'basic'\|'admin'\|'manager'\|'operative'\|'viewer'` | no | `viewer` if missing | |
| firstName | `firstName` | String | string | string | no | | |
| surname | `surname` | String | string | string | no | | |
| mobileNumber | `mobileNumber` | String? | string or delete | string \| undefined | yes | delete when empty | |
| isActive | `isActive` | Bool | bool | boolean | no | | |
| passwordSet | `passwordSet` | Bool | bool | boolean | no | false for placeholders | |
| isSuperAdmin | `isSuperAdmin` | Bool | bool | boolean | no | false | forced false if operativeMode |
| createdAt / updatedAt / lastSeenAt | same | Date | Timestamp | Date | lastSeen optional | | lastSeen throttled |
| adminAccess … wholesalersOrderHistory | **flat keys** | Bool | bool | boolean | no | see §9 | `skills` always false |
| policyAccepted | `policyAccepted` | Bool | bool | boolean | no | | |
| policyAcceptedAt | `policyAcceptedAt` | Date? | Timestamp or delete | Date \| undefined | yes | | |
| employmentType | `employmentType` | enum | string | `'paye'\|'self_employed'` | | | **Web writes `selfEmployed`** |
| employmentTypeTransitionFrom | same | String? | string | string \| undefined | yes | | scheduled switch |
| employmentTypeEffectiveAt | same | Date? | Timestamp | Date \| undefined | yes | | |
| assignedManagerUserId | same | String? | string | string \| undefined | yes | first of list | |
| assignedManagerUserIds | same | [String] | array | string[] | | | |
| hasNoLineManager | same | Bool | bool | boolean | | | |
| dayRate XOR hourlyRate | `dayRate` / `hourlyRate` | Double | number | number | yes | never both | |
| vatNumber / utrNumber | same | String? | string or delete | string \| undefined | yes | | |
| timesheetsEnabled | same | Bool | bool | boolean | | | |
| tradeTypePreset / tradeTypeCustom | same | String? | string | string \| undefined | | StaffTradeType or Other | |
| annualLeaveEnabled | same | Bool | bool | boolean | | **true** | |
| annualLeaveDaysPerYear | same | Double | number | number | | 0.5 steps | |
| annualLeaveYearStartMonth / EndMonth | same | Int | int | number | | 1–12 | **must be Int** |
| annualLeaveCarriesOver | same | Bool | bool | boolean | | | |
| profilePhotoURL | same | String? | string | string \| undefined | yes | | |
| pushTokens | `pushTokens` | [String] | arrayUnion | string[] | | | |
| pushTokenUpdatedAt | same | Date | Timestamp | Date | | | |
| notificationPreferences | `notificationPreferences` | map | map | object | | | keys below |

`notificationPreferences`: `bookingConflicts`, `projectDeadlines`, `operativeAvailability`, `dailyReports`, `materialOrderCutOff` (bool); `materialCutOffHour`, `materialCutOffMinute` (Int); `materialCutOffOnSaturday`, `materialCutOffOnSunday` (bool).

Save rules: if `operativeMode`: role=`operative`, isSuperAdmin false, adminAccess/manager/operatives/qualifications false. If not operative: `materials` written true. When reading an operative: `projects` and `smallWorks` treated true.

Web `buildSaveUserPayload` also nests a `permissions` map **and** spreads flags — extra `permissions` object is unknown to iOS (merge, so it survives, but is web-only). Employment type default `'selfEmployed'` is incompatible.

### Model: Invitation  (`createUserInvitation` ~L4672)

Path: `invitations/{UPPERCASE-UUID}` · public read

| Key | Type | Notes |
|---|---|---|
| email, organizationId, invitedBy, firstName, surname | string | |
| permissions | map of flags | |
| employmentType | string | `paye` / `self_employed` |
| isUsed | bool | |
| createdAt | Timestamp | |
| mobileNumber, assignedManagerUserId(s), hasNoLineManager, dayRate, tradeType*, annualLeave*, timesheetsEnabled, vatNumber, utrNumber | optional | |

### Model: Organization  (`FirebaseBackend.swift` ~L804–1012, ~L3528–3873)

Path: `organizations/{orgId}` · merge

| Group | Keys |
|---|---|
| Identity | `id`, `name`, `creatorUserId`, `adminUserId`, `members` (uid → `admin`\|`manager`\|`member`), `createdAt`, `updatedAt` |
| Office | `officeAddressLine1`, `officeCity`, `officePostcode`, `countryCode` (default `GB`), `defaultLatitude`, `defaultLongitude` |
| Branding | `companyLogoURL`, `documentAbbreviation` (1–3 uppercase) |
| Payroll | `payrollTimePolicy`, `payrollTimePolicyPrior`, `payrollTimePolicyEffectiveFrom` (yyyy-MM-dd), `payrollTimePolicyScheduled` |
| Settings maps | `warningDetection`, `invoicing`, `annualLeaveDefaults` |
| Legacy copies | `bankHolidayRegionId`, `currencyCode` (also inside `settings`) |
| Trial/lock | `isTrial`, `subscriptionStatus`, `billingStatus`, `trialAccessBlocked`, `accessBlocked`, `trialAccessBlockedMessage`, `accessBlockedMessage` |

**`settings`:** `uiLabels.navigationLabels`, `myScheduleOptions` (`showOffice`, `showWorkingFromHome`, `showSiteSurvey`, `customItems[]`, `customItemEnabled{}`), `bankHolidayRegionId`, `currencyCode` (GBP), `allowSelfRegistration`, `requireEmailVerification`, `defaultUserRole`, `workingHours`, `holidayCalendar`.

**`payrollTimePolicy` defaults:** `standardDayStart` `"07:30"`, `standardDayEnd` `"16:00"`, `unpaidBreakMinutes` **Int 30**, `breakPaid` false, `standardPaidHours` 8, `breakWindowStart` `"12:00"`, `breakWindowEnd` `"12:30"`, `weekdayOutsideStandardMultiplier` 1.5, `sundaySameAsSaturday` false, `saturday` / `sunday` maps (`allHoursAtMultiplierMode`, `allHoursMultiplier`, `useCustomStandardDayWindow`, `customStandardStart/End` null when unset, `countsAsHours`, `outsideStandardWindowMultiplier`). Saturday default: custom 07:30–13:00 counts as 8h, ×2 outside. Sunday: all hours ×2.

**`invoicing`:** `paymentRunMode`, `paymentDateMode`, `paymentRunDateRanges` `[{startDay,endDay}]` max 2 default `[{1,2}]`, `paymentDates` int[] max 2 default `[18]`, `noteToUsers`, `recurringPaymentRunSummary`, `recurringRunStartDay/EndDay/PaymentDay` weekday strings.

**`annualLeaveDefaults`:** `daysPerYear` 25, `startMonth` 1, `endMonth` 12, `carriesOver` false.

### Model: Project / SmallWorks  (`saveProject` ~L1435, `saveSmallWorks` ~L1802)

Path: `organizations/{orgId}/projects/{id}` or `…/smallWorks/{id}` · overwrite · ID uppercase UUID **and** denormalised `id` field

| Swift property | Firestore key | Swift type | Firestore type | TS type | Optional | Default | Notes |
|---|---|---|---|---|---|---|---|
| id | `id` | String | string | string | no | doc id | |
| jobNumber | `jobNumber` | String | string | string | no | | UI: Project reference |
| siteName | `siteName` | String | string | string | no | | |
| addressLine1/2, townCity, postcode | same | String | string | string | line2 empty `""` | | |
| siteAddress | `siteAddress` | String | string | string | | joined with `", "` | legacy |
| client | `client` | struct | map `{id,name,email,phone}` | object | | | **embedded copy** |
| startDate, endDate | same | Date | Timestamp | Date | no | local midnight | |
| jobType | `jobType` | enum | string | string | | Small works: `Small Works` | |
| customJobType | `customJobType` | String | string | string | | from settings/jobTypes | |
| manager | `manager` | enum | string | `'Custom'` | | **always `Custom` on new/edit** | |
| managerId | `managerId` | String | string | string | | first roster UUID | |
| managerIds | `managerIds` | [String] | array | string[] | | | |
| isLive | `isLive` | Bool | bool | boolean | | true on create | |
| description | `description` | String | string | string | | `""` | |
| hiddenManagerUserIds / hiddenOperativeUserIds | same | [String] | array | string[] | | | |
| usesMapPinForLocation, latitude, longitude | same | Bool / Double | bool / number | | | | |
| organizationId, createdAt, updatedAt | same | | | | | | |
| notes | — | in model | **not written by iOS** | | | Blueprint §8.6 | Web `projectPayload` **does write `notes`** — wiped on next iOS save anyway, and iOS may not read it |

**Status is not stored.** Derived: not live → Inactive; today < start → Upcoming; today > end → Completed; else Active.

### Model: ProjectTask  (`save` ~L2237, `Models/ProjectTask.swift`)

Path: `…/tasks/{id}` · overwrite · **no top-level `id` field** · empty optionals omitted except `details: ""`

| Key | Type | Notes |
|---|---|---|
| projectId, title, details, createdBy | string | details `""` if empty |
| assignedOperativeId / assignedManagerId | string | legacy single |
| assignedOperativeIds / assignedManagerIds | array | roster UUIDs |
| dueDate | Timestamp | **required on new tasks** |
| priority / status | string enums | |
| attachedFileURL, attachedFileName, attachedImageURLs, attachedSiteAuditId, attachedSiteAuditTitle | | |
| completedBy, completedAt, completionImages, completionFiles, completionNotes | | |
| items `[{id,title,description}]`, completedItemIds | | checklist |
| organizationId, createdAt, updatedAt | | |

Max **500 tasks per project** (`ProjectTaskStore`).

### Model: Client  (overwrite)

`id`, `name`, `contactPerson`, `email`, `phone`, `address` (empties `""`), `organizationId`, `createdAt`, `updatedAt`. Jobs keep their own embedded `client` map — editing a client ❓ may not rewrite jobs (`ProjectStore` in 3A).

### Model: Operative roster  (~L2658, overwrite)

`firstName`, `lastName`, `name` (legacy full), `email`, `phone`, `startDate`, `skills[]` deprecated, `qualifications[{id,name,hasEndDate,endDate?,createdAt,updatedAt}]`, `qualificationExpiryDates` map UUID→Timestamp, `qualificationCertificateURLs` map UUID→URL, `isActive`, `hourlyRate`/`dayRate` **0 when unset**, `currencySymbol` `"£"`, `notes`, `tradeTypePreset`, `tradeTypeCustom`, `organizationId`, `createdAt`, `updatedAt`. **No denormalised `id` field.**

### Model: Manager roster  (overwrite)

`firstName`, `lastName`, `email`, `mobileNumber`, `department`, `isActive`, `notes`, `tradeTypePreset`, `tradeTypeCustom`, `organizationId`, `createdAt`, `updatedAt`.

### Model: Qualification template  (batch)

`name`, `hasEndDate`, `endDate`, `createdAt`, `updatedAt`.

### Model: userEmails

Path `userEmails/{emailLower}` = `{ userId }`. One user per email per org.

### Model: operativeDayRateHistory

`{ userId?, operativeId?, dayRate, effectiveAt, createdAt }`.

### Model: operativeProfiles  (`operativeProfiles/{uid}`)

`{ userId, assignedManagerUserId, dayRate, updatedAt }` — fallback when a manager cannot write the user doc.

### Model: Booking  (`saveBooking` ~L5169, merge, live)

| Key | Type | Notes |
|---|---|---|
| id | string | denormalised |
| operativeId | UUID string | **required** for iOS parser |
| projectId | UUID string | project **or** small works |
| date | Timestamp | local midnight |
| timeSlot | enum | exact raw values |
| workStartTime / workEndTime | `"HH:mm"` | custom hours only; **deleted** otherwise |
| isBreakRemoved | bool | |
| otMultiplierOverride | number or delete | delete when unset |
| bookingGroupId | string | multi-person |
| bookedBy | string | booker full name or email |
| notes | string | `""` |
| status | enum | `Confirmed` etc. |
| createdAt, updatedAt | Timestamp | |

**iOS skip rule (rebuild §5):** missing/wrong-type `operativeId`, `projectId`, `date`, `timeSlot`, `bookedBy`, `status` → record **disappears** on iOS.

### Model: ManagerSiteBooking  (merge, live)

`id`, `userId` (auth uid), `date`, `organizationId`, `timeSlot` (`FULL_DAY` underscore), `locationType`, `locationId`, `customLocationName`, `workStartTime`, `workEndTime`, `isBreakRemoved`, `bookingGroupId`, `createdAt`, `updatedAt`.

### Model: SubcontractorBooking  (overwrite)

`id`, `subcontractorId`, `projectId`, `date`, `timeSlot` (operative values), `workStartTime`, `workEndTime`, `isBreakRemoved`, `bookedBy` (`"Project Planner"`), `status`, `bookedContactIds[]`, `createdAt`, `updatedAt`.

### Model: HolidayBooking  (merge)

`id`, `organizationId`, `userId` and/or `operativeId` (at least one), `startDate`, `endDate`, `status` (`pending`/`approved`/`rejected`), `timeSlot` (`FULL DAY`/`AM`/`PM`), `approvedByUserId`, `approvedAt`, `cancellationRequestedAt`, `cancellationRequestedByUserId`, `createdAt`, `updatedAt`.

### Model: ProjectMaterial  (~L6580, overwrite, live per project)

`id`, `projectId`, `material` (name), `quantity` **Int**, `unit` enum, `addedBy` (name), `addedByUserId`, `addedAt` **required for ownership rules**, `editedBy*`, `date`, `status`, optional catalogue/brand/code/size/length/`lengthUnit`/`category`/`websiteURL`/`notes`/`lastSentAt`/`lastSentRequestType` (`Quote`\|`Order`). `sizeOrLength` written as legacy copy of `length`. Older docs may have numeric `packSize`.

### Model: MaterialCatalogueItem  (overwrite)

`id`, `name`, `brand`, `productCode`, `defaultUnit`, `size`, `length`, `lengthUnit`, `category`, `sizeOrLength` (legacy copy), `createdAt`, `createdByUserId`, `createdByName`.

CSV header (exact): `Catalogue ID,Name,Category,Manufacturer/Brand,Product Code,Default Type (Length Drum Box Pallet or Number),Size,Length,Length Unit (M or MM)`.

### Model: MaterialSendRecord

`id`, `projectId`, `requestType`, `sentAt`, `materialsDate`, `sentBy`, `recipients[{name,email,wholesalerName}]`, `lines[{materialId,name,quantity,unit,brand,productCode,lengthDisplay}]`.

### Model: Wholesaler

`id`, `name`, `address`, `trade`, `accountNumber`, `primaryContactId`, `contacts[{id,name,email,isPrimary,createdAt}]`, `createdAt`, `updatedAt`.

### Model: Subcontractor

`id`, `name`, `subcontractorType`, `website`, `address`, `contacts[{id,name,email,contactNumber,position,tradeType,createdAt}]`, `createdAt`, `updatedAt`. Contacts are names-only “operatives” (no logins).

### Model: SiteAudit  (~L7075, overwrite)

`id`, `organizationId`, `projectId`, `projectJobNumber`, `projectName`, `type`, `title`, `customTitle`, `authorName`, `date`, `createdAt`, `createdByUserId`, `visibleToOperatives` (missing counts as true for operatives), `items[{id,title,location,assignee,comments,annotations,imageURL,imageCapturedAt,createdAt}]`.

### Model: Notification  (overwrite, live)

No `id` field. `organizationId`, `type`, `title`, `message`, `userId` (null = everyone with permission), `relatedId` (UUID or null), `isRead`, `createdAt`, `requiresPermission` (e.g. `"canViewOperatives"` or null), `deepLinkUserId`, `deepLinkWeekStart` (null when unset). **Empty values written as `null`, not omitted.** Saving may keep existing `isRead: true`.

### Model: settings/jobTypes  (overwrite)

`{ jobTypes: string[], organizationId, updatedAt }`.

### Model: settings/tradeTypeInventory  (merge)

`{ trades: string[], updatedAt }`.

### Model: settings/deadlineAssignments  (merge)

`{ projects: { PROJECTID: [uid] }, updatedAt }`.

### Model: settings/deadlines_*  (`deadlineMap` ~L8434, merge)

`{ items: [deadline], updatedAt, projectId }`. Deadline: `status` `notStarted`\|`inProgress`\|`blocked`\|`complete`, `history[]`.

### Model: settings/healthSafety_*  (maps ~L8088–8160, merge)

`{ talks[], issues[], signatures[], ramsDocuments[], otherDocuments[], updatedAt }`. Signatures include base64 PNG.

### Model: settings/timesheet_*  (~L8005, merge; empty dates/amounts `null`, strings `""` — `InvoicingView.swift` ~L541)

Id: `timesheet_{uid}_{Int(startOfDay(weekStart).timeIntervalSince1970)}` London local midnight.

Fields: `userId`, `weekStart`, `updatedAt`, `managerNote`, `operativeSignedAt/ByName`, `operativeSignatureImageBase64`, `managerSignedAt/ByName/ByUserId`, `managerSignatureImageBase64`, `exportedAt`, `expenseEntries[{id,title,details,jobNumber,date,amount,receiptName,managerDecision,managerRevisedAmount}]`, `priceWorkEntries[{id,title,details,jobNumber,agreedManagerName,startDate,endDate,amount,managerDecision,managerRevisedAmount}]`, `payrollLineReviews{ key: {decision, revisedAmount} }`.

### Web-only models (keep; do not put on iOS-overwritten docs)

| Path | Purpose |
|---|---|
| `dashboardLayouts/{uid}` | Custom Home tiles (`/dashboard/edit`) |
| `acceptedBookingClashes/{id}` | Web clash dismissals (iOS uses UserDefaults) |
| `platformConfig/{docId}` | Web dashboard defaults |
| `users/{uid}/orgMemberships/{orgId}` | Multi-org index for Change organisation |

---

## 11. Cross-platform write rules (enforce in Phase 2 converters)

1. Write every field iOS writes, same key casing and type.
2. Int fields must be whole numbers (`unpaidBreakMinutes`, `quantity`, months, `version`).
3. Uppercase UUID strings.
4. Dates as Firestore Timestamps (day fields = Europe/London midnight). Day keys `yyyy-MM-dd`. Times `"HH:mm"`.
5. Exact enum raw values.
6. Empty-value style per entity (`""` vs `deleteField()` vs `null` vs omit vs `0`).
7. Same ID strategy; no extra fields on overwrite documents.
8. Runtime validator **blocks invalid writes**; in development log documents that would fail the Swift parser.

**Zod:** not installed. Propose adding it at Stop Gate 1.

## Blueprint corrections (candidate — need Swift)

1. Web `employmentType` `selfEmployed` vs iOS `self_employed`.
2. Web booking `status` lowercase vs iOS `Confirmed`.
3. Web material `requestType` lowercase vs `Quote`/`Order`.
4. Web new project `manager: 'Project Manager'` vs iOS `'Custom'`.
5. Web writes project `notes`; iOS does not save notes.
6. Web `users` payload includes nested `permissions` map; iOS is flat-only (merge, so extra map is web-only cruft).
7. `projects/{id}/healthSafety` exists in rules; iOS stores H&S under `settings/healthSafety_*`.
8. `operativeDayRateHistory` is described in the blueprint but has no dedicated `firestore.rules` match (falls through to org catch-all **read-only**). Writes may already fail — confirm in Swift and rules before Phase 2.
