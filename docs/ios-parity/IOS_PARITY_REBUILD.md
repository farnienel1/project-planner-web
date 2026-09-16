# Project Planner: iOS → Web Parity Rebuild

> These are the master instructions for Cursor Agent. Save this file in the web app at `docs/ios-parity/IOS_PARITY_REBUILD.md`, then follow it exactly, one phase at a time.
>
> **Companion file:** `docs/ios-parity/IOS_APP_BLUEPRINT.md` was built from the real iOS source. It maps the app's structure, flows, Firestore schema, design tokens and permission rules, and sets out the **desktop-first layout rules**. Read both files before starting. In this document, "Blueprint §x" means a section of that file.

## 0. Config (Farnie: edit once)

| Key | Value |
|---|---|
| `IOS_ROOT` | `<<IOS_PROJECT_PATH>>`: the Xcode project folder on the Desktop (e.g. `~/Desktop/Project Planner`). The app source is the `Project Planner/` folder inside it, the one containing `ContentView.swift`, `FirebaseBackend.swift`, `Core/`, `Models/`, `Navigation/` and `Views/`. |
| `WEB_ROOT` | This web app (Next.js · TypeScript · Tailwind · Firebase · Zustand), hosted at `https://project-planner-f986c.web.app` |
| `DOCS` | `docs/ios-parity/` inside `WEB_ROOT` |
| `BLUEPRINT` | `docs/ios-parity/IOS_APP_BLUEPRINT.md` |
| `SCREENSHOTS` | `docs/ios-parity/screenshots/<section>/`: iOS screenshots from Farnie, also attached to chats |

---

## 1. Mission

Rebuild the Project Planner web app so it faithfully mirrors the Project Planner iOS app (SwiftUI):

1. **Same data.** Both apps use the same Firebase project. Anything created, edited or deleted on one platform must appear and behave the same way on the other. Updates must be real-time on the web wherever they are real-time on iOS.
2. **Same functionality.** Every screen, field, option, setting, validation rule, calculation, permission and workflow in iOS exists on the web. Invent nothing and drop nothing.
3. **Same flow.** Keep the same navigation structure, the same order of steps, and the same place for every action.
4. **Same look.** Keep the same colours, type hierarchy, icons (matched by meaning), layout patterns and wording.
5. **Built for computer screens.** This is a web app used mainly on laptops and desktop monitors. The Home page and every other page must be **upsized and laid out for large screens**, following Blueprint §3: sidebar shell, upsizing table, multi-column layouts, modals instead of sheets, and hover and keyboard support. Below 768px wide, the web app should look like the iOS app.

Swift and TypeScript can't share code. Parity therefore comes from **reading the Swift source and translating it deliberately**. Earlier attempts failed because the web app was built from assumptions about what iOS does. This time:

- **Write no feature code until you've extracted a written spec from the Swift source, with evidence for every claim.**
- **Cite the source of every behavioural claim as `File.swift:line`.** A claim you can't cite is an assumption: mark it `❓ UNVERIFIED` and ask.
- **Keep the specs in `DOCS`** so the work survives between chats.

## 2. Ground rules (non-negotiable)

1. **The iOS project is read-only.** Never edit, reformat, build into, `pod install` in, or add files to `IOS_ROOT`.
2. **iOS is the source of truth.** Where existing web code disagrees with iOS, iOS wins. Existing web code is not evidence of how iOS behaves.
3. **Don't invent or drop anything.** Add no extra screens, fields or options, and don't "improve" anything. List improvement ideas under *Suggestions* in your report instead of building them.
4. **Keep Firestore compatible.** Keep the same collection and sub-collection paths, document ID strategy, field names, types, enum raw values, nesting and organisation scoping. Don't rename, migrate, back-fill, or add fields or collections without Farnie's written approval.
5. **Never weaken security.** Don't change `firestore.rules`, `storage.rules` or Cloud Functions without approval. Never loosen a rule to make the web work. Report the blocked operation instead.
6. **Protect real data.** Don't run scripts that write to or delete from Firebase. Test writes only in a test organisation or account that Farnie nominates.
7. **Keep the existing stack and conventions** in `WEB_ROOT`: framework version, router, folder structure, package manager and UI primitives. Ask before adding any dependency.
8. **Read every file fully.** Never describe a Swift file you haven't opened. Read long files in chunks until you reach the end.
9. **Work on one phase or section at a time.** End each one with the Stop Gate report (§11) and wait for Farnie's go-ahead.
10. **Keep `DOCS/PROGRESS.md` current.** Update it before ending any turn in which you changed code or docs. If your context is filling up, stop at a clean point, record exactly where you stopped, and ask Farnie to continue in a new chat.
11. **Make every file traceable.** Start every web file you create or substantially change with a header comment listing its iOS source files and its spec file:

    ```ts
    /**
     * iOS parity source: Views/Projects/ProjectDetailView.swift, ViewModels/ProjectDetailViewModel.swift
     * Spec: docs/ios-parity/sections/12-projects.md
     */
    ```
12. **Ask good questions.** When something is ambiguous, ask a numbered question that gives the evidence and your recommended answer (§11).
13. **Design desktop-first.** Build every page to Blueprint §3 at 1280px and 1440px widths first, then check it at 1024px and at phone width. A page that only looks right at phone width is not done.
14. **Use the blueprint, but trust the code.** Treat the blueprint as the verified starting point. If the Swift code disagrees with it, the code wins: record the correction in `PROGRESS.md` and update the blueprint.

---

## 3. Where to look in the iOS project

### 3.1 Read these first

| What | Where | Why |
|---|---|---|
| Project file | `*.xcodeproj/project.pbxproj` | Targets, bundle ID, deployment target, Swift packages (read only) |
| Packages | `Package.resolved` (under `xcshareddata/swiftpm/` in the `.xcodeproj` or `.xcworkspace`), `Podfile.lock` | Third-party libraries, to find web equivalents |
| Firebase config | `GoogleService-Info.plist` | `PROJECT_ID`, `STORAGE_BUCKET`, `BUNDLE_ID`. Don't copy the iOS `API_KEY`; the web has its own app config |
| App config | `Info.plist`, `*.entitlements` | Camera, photos and location usage strings; custom fonts (`UIAppFonts`); URL schemes; Sign in with Apple; push |
| Entry point | The `@main` `App` struct and any `AppDelegate` | `FirebaseApp.configure()`, App Check, Firestore settings, emulator flags, objects injected at the root |
| Root view | `ContentView`, `RootView`, `MainTabView` or whatever the entry point shows | Auth gate, onboarding, and the top-level navigation (`TabView`, `NavigationSplitView` or sidebar) |
| Models | `struct`/`class` types conforming to `Codable`, their `CodingKeys`, and `enum … : String` types | The Firestore schema |
| Data layer | Services, managers, repositories and view models | Every read, write, query, listener, batch, transaction, upload and function call |
| Screens | `View` structs | Layout, fields, actions, presentation, states and wording |
| Design | `Assets.xcassets` (`*.colorset/Contents.json`, `AccentColor`, image sets, `AppIcon`); `Color` and `Font` extensions; custom `ButtonStyle`s and `ViewModifier`s; shared components | Colour tokens (light and dark), type scale, corner radii, spacing, components |
| Wording | `Localizable.strings`, `Localizable.xcstrings`, `*.stringsdict`; otherwise the string literals in views | The exact text users see |
| Backend | `firestore.rules`, `storage.rules`, `firestore.indexes.json`, `firebase.json`, `functions/`. Search **both** roots | What the web is allowed to do; indexes; callable functions |
| Previews and tests | `#Preview`, `PreviewProvider`, `*Tests` | Supporting evidence only: sample data shapes and expected behaviour |

Skip `Pods/`, `Carthage/`, `.build/`, `build/`, `DerivedData/`, `SourcePackages/` and binary images. Don't assume a folder layout. Work it out from the actual file tree.

### 3.2 Search patterns

Use your codebase search, or `rg`/`grep` in the terminal, scoped to `IOS_ROOT`:

```text
# Firebase
Firestore.firestore|collection\(|collectionGroup\(|document\(|whereField|whereFilter|order\(by|limit\(to
addSnapshotListener|@FirestoreQuery|getDocuments|getDocument|addDocument|setData|updateData|\.delete\(\)
batch\(\)|runTransaction|FieldValue\.|@DocumentID|@ServerTimestamp|Timestamp|GeoPoint|DocumentReference
Firestore\.Encoder|Firestore\.Decoder|keyEncodingStrategy|dateEncodingStrategy|data\(as:
Storage\.storage|putData|putFile|downloadURL|httpsCallable|Functions\.functions
Auth\.auth|signIn|createUser|sendPasswordReset|addStateDidChangeListener|getIDTokenResult|AppCheck
Messaging\.messaging|Analytics|Crashlytics|RemoteConfig

# Models, permissions and logic
struct .*: .*Codable|class .*: .*Codable|enum .*: (String|Int)|CodingKeys
role|permission|isAdmin|isManager|canEdit|canView|orgId|organisationId|organizationId|companyId
Calendar|DateFormatter|\.formatted\(|startOfDay|firstWeekday|TimeZone|NumberFormatter|currency|VAT|round

# Navigation and presentation
TabView|NavigationStack|NavigationSplitView|NavigationLink|navigationDestination|\.sheet\(|fullScreenCover
\.popover|\.alert\(|confirmationDialog|swipeActions|contextMenu|\.toolbar|ToolbarItem|searchable|refreshable
\.disabled\(|\.onSubmit|\.task|\.onAppear|@AppStorage|UserDefaults

# Look
Color\(|UIColor|\.foregroundStyle|\.tint|\.font\(|Font\.custom|cornerRadius|clipShape|\.padding\(
\.listStyle|\.formStyle|Material|glassEffect|shadow|Image\(systemName:|ButtonStyle|ViewModifier

# Device features
MapKit|Map\(|MKMapView|CLLocationManager|PhotosPicker|UIImagePickerController|jpegData|PDFKit
UIGraphicsPDFRenderer|ImageRenderer|ShareLink|UIActivityViewController|MFMailComposeViewController
PKCanvasView|UNUserNotificationCenter|LocalAuthentication|WidgetKit|openURL|tel:|mailto:
```

### 3.3 Swift → web translation tables

**Data and Firebase** (use the modular Firebase JS SDK already installed)

| Swift / iOS | Web |
|---|---|
| Hand-written save/load dictionaries in `FirebaseBackend.swift` (this app's actual Firestore mapping) | `X` TypeScript interface plus a `FirestoreDataConverter<X>` that writes **exactly the keys, types and empty-value style of the Swift save function** and reads like the Swift load function. The models' `Codable`/`CodingKeys` are only used for iOS's on-device cache, so don't treat them as the Firestore schema. |
| `struct X: Codable` + `CodingKeys` (if used with Firestore) | Converter that uses the **CodingKeys names**, not the Swift property names |
| Encoder/decoder strategies (`keyEncodingStrategy`, `dateEncodingStrategy`) | Same behaviour in the converter |
| `@DocumentID var id` | `snapshot.id`. Don't write an `id` field unless iOS also stores one |
| `@ServerTimestamp` | `serverTimestamp()` on the same writes |
| `Date` | Firestore `Timestamp` ↔ JS `Date` in the converter. If iOS stores dates as strings or numbers, do the same |
| `enum S: String` | A TypeScript string-literal union with the **exact** raw values. A case with no explicit raw value encodes as its case name, e.g. `onHold` |
| `Int` / `Double` / `Bool` / optionals | See §5: types and presence must match exactly |
| `GeoPoint`, `DocumentReference`, nested structs, arrays | `GeoPoint`, `DocumentReference`, nested objects and arrays with the same shapes |
| `collection("a").document(id).collection("b")` | `collection(db, "a", id, "b")` |
| `whereField` / `order(by:)` / `limit(to:)` | `where` / `orderBy` / `limit` with the same fields, operators, ordering and limits |
| `addSnapshotListener` / `@FirestoreQuery` | `onSnapshot` inside a store or hook, with cleanup. Use it wherever iOS updates live |
| `getDocuments` / `getDocument` | `getDocs` / `getDoc` |
| `addDocument` / `setData(from:merge:)` / `updateData` / `delete()` | `addDoc` / `setDoc(…, { merge })` / `updateDoc` / `deleteDoc` |
| `FieldValue.serverTimestamp / arrayUnion / arrayRemove / increment / delete` | `serverTimestamp` / `arrayUnion` / `arrayRemove` / `increment` / `deleteField` |
| `batch()` / `runTransaction` | `writeBatch` / `runTransaction` with the same grouping |
| `Firestore.firestore(database:)` | `getFirestore(app, "<same database id>")` |
| `Storage.storage()` (and any custom bucket) · `putData` · `downloadURL` | `getStorage(app, bucket)` · `uploadBytes` (same path and metadata) · `getDownloadURL` |
| `Functions.functions(region:)` · `httpsCallable` | `getFunctions(app, region)` · `httpsCallable` with the same name, payload and region |
| `Auth.auth()` sign-in methods, state listener, token claims | The same providers via `firebase/auth`, `onAuthStateChanged`, `getIdTokenResult()` |
| `UUID().uuidString` used as an ID | Swift produces **UPPERCASE** IDs and `crypto.randomUUID()` produces lowercase. Match iOS |
| App Check (App Attest / DeviceCheck) | If App Check is enforced, the web needs App Check with reCAPTCHA. Tell Farnie what to set up |

**State and architecture**

| Swift | Web |
|---|---|
| `ObservableObject` + `@Published`, or `@Observable` view model | A Zustand store `use<Feature>Store` with the same state and action names |
| `@StateObject` / `@EnvironmentObject` / `@Environment` | A Zustand store, or a React context provider at the matching level |
| `@State` / `@Binding` | `useState` / props |
| `@AppStorage` / `UserDefaults` | `localStorage` via Zustand `persist`, per device as on iOS. If a value looks like it should sync across devices, ask |
| Service or repository function | A function with the same name in `services/<feature>` (or the existing equivalent folder) |
| Loading in `.task` / `.onAppear` | `useEffect` in a client component, with the same loading behaviour |

**Navigation and presentation** (use the Next.js router the repo already uses)

| Swift | Web |
|---|---|
| `TabView` or sidebar | Primary navigation with the same items, order, labels and icons (matched by meaning). Sidebar on desktop, bottom tab bar on small screens |
| `NavigationStack` + `NavigationLink` / `navigationDestination` | A route for each pushed screen (e.g. `/projects/[projectId]`), with back navigation |
| `NavigationSplitView` or an iPad layout | A list + detail split on desktop. If iOS has one, use it as the desktop model |
| `.sheet` / `.fullScreenCover` | A modal (a bottom sheet on small screens) with an iOS-style header: Cancel on the left, title in the centre, Save/Done on the right |
| `.alert` / `.confirmationDialog` | An alert dialog or action menu with **identical** title, message and button text; destructive actions in red |
| `.swipeActions` / `.contextMenu` | A row action menu (⋯) plus a right-click menu with the same actions, order and colours |
| `.searchable` / `.refreshable` | A search field in the page header with identical matching logic / live data or a refresh control |
| `.toolbar` items | Header buttons in the same positions (leading/trailing) with the same labels |
| `ProgressView`, empty views, error alerts | A spinner or skeleton, and the same empty-state and error wording |

**Controls**

| Swift | Web |
|---|---|
| `Form`, `Section`, `List` with `.insetGrouped` | Grouped cards on a grouped background, with the same section headers and footers and the same row order |
| `TextField` / `SecureField` / `TextEditor` | Text input / password input / textarea, with the same placeholder, keyboard type (`inputMode`) and autocapitalisation |
| `Picker` (menu, segmented, wheel or navigation-link style) | A select, segmented control, select, or pushed list respectively |
| `DatePicker` (date, time, or both) | A date, time or datetime input with the same components and ranges |
| `Toggle` / `Stepper` / `Slider` | Switch / number stepper / range input |
| `.disabled(…)` conditions and validation | Identical conditions and messages |

**Device and platform features**

| Swift | Web |
|---|---|
| MapKit (`Map`, annotations) | Prefer Apple **MapKit JS** for an identical look. It needs a MapKit JS token from Farnie's Apple Developer account, so ask. Otherwise use the map library already in `package.json`. Match pins, colours, clustering, the initial region and callouts |
| `CLLocationManager` | `navigator.geolocation` |
| `PhotosPicker`, camera, `jpegData(compressionQuality:)` | `<input type="file" accept="image/*" capture>`. Resize and compress as iOS does, and use the same Storage path and metadata |
| PDFKit, `UIGraphicsPDFRenderer`, `ImageRenderer` | A PDF with the same layout and file name. If no PDF library is installed, propose one |
| `ShareLink`, share sheet, mail composer | Web Share API with a download fallback / `mailto:` or the same Cloud Function |
| `PKCanvasView` signatures | A canvas signature pad, saving the signature in the same format and location |
| Push notifications (FCM) | Only with Farnie's approval (needs a service worker and a VAPID key) |
| `tel:`, `mailto:`, `openURL`, maps links | The same links |
| Haptics, Face ID, widgets, app extensions | Not applicable. List them in the report |

**Look**

| Swift | Web |
|---|---|
| Asset-catalog colours (light and dark) | Tailwind theme tokens with the exact values from `Contents.json`. Convert 0–1 floats, 0–255 integers and hex strings correctly |
| System colours (`.accentColor`, `.secondary`, `Color(.systemGroupedBackground)`, …) | Semantic tokens named after the iOS colour (`ios-grouped-bg`, `ios-label-secondary`, …) with light and dark values, checked against the screenshots |
| `.font(.largeTitle)`, `.headline`, `.caption` and other text styles | A type scale mapped to the iOS text styles, using the system font stack (`-apple-system, BlinkMacSystemFont, system-ui, …`). If iOS bundles a custom font, load the same font with `next/font` |
| `Image(systemName:)` (SF Symbols) | Apple's licence doesn't allow SF Symbols on the web. Map each symbol to the closest icon in the library the web already uses, and keep a mapping table |
| `.ultraThinMaterial`, `.glassEffect` | A translucent background with `backdrop-blur` |
| Corner radii, padding, shadows, `ButtonStyle`s, shared components | Matching tokens, and React components with the same names |
| Dark mode | Support it if iOS does, following the system preference |
| Locale | `en-GB`, `Europe/London` and GBP, unless iOS does otherwise |

---

## 4. Firebase linkage checklist

Confirm each item with evidence in Phase 1. Fix it, or escalate it to Farnie, in Phase 2.

**Known from the iOS source** (Blueprint §1 and §1.6):
- Project `project-planner-f986c`, bucket `project-planner-f986c.firebasestorage.app`, `(default)` Firestore database.
- Auth is email/password only; there's no App Check.
- Email is sent by the HTTP function `sendProjectPlannerEmail` (us-central1).
- iOS depends on the web pages `/setup` and `/setup-password.html?token=`.
- **Add User doesn't create an Auth account.** It writes an invitation, a placeholder user and an email index, then sends the invite email (Blueprint §6.15).

- [ ] `PROJECT_ID` in `GoogleService-Info.plist` equals `projectId` in the web Firebase config. If the web isn't registered in that project, **stop** and tell Farnie to go to *Firebase console → Project settings → General → Your apps → Add app → Web*. The config values go in `.env.local`, never hard-coded and never committed.
- [ ] The Firestore database ID (default or named), Storage bucket and Functions region are the same on both platforms.
- [ ] The Auth providers are the same (email/password, Apple, Google, …). The web domains are listed under *Authentication → Settings → Authorized domains*. Sign in with Apple needs extra setup on the web, so flag it if iOS uses it.
- [ ] A signed-in user is linked to their profile, organisation and role (e.g. a `users/{uid}` document or custom claims) exactly as on iOS.
- [ ] Data is scoped to an organisation in the same way as on iOS (path-based sub-collections or an org ID field), and every web query uses that scoping.
- [ ] Build the permission matrix: which roles can see and do what in every section. Web navigation and screens hide or disable the same things. Security rules remain the real enforcement.
- [ ] **Add User** uses the same invitation mechanism as iOS (Blueprint §6.15). The existing web page `setup-password.html` still creates the Auth account when the invitee accepts. Never call `createUserWithEmailAndPassword` on the web's main auth instance, because it signs the admin out.
- [ ] Check the App Check status and where the Firestore/Storage rules live. List any composite indexes the web queries need, but don't deploy them.
- [ ] For each screen, record whether it uses real-time listeners or one-off fetches.

## 5. Cross-platform data compatibility (why records "disappear" on iOS)

This iOS app reads Firestore with **hand-written dictionary parsers** in `FirebaseBackend.swift`, not `Codable` (Blueprint §5.1). A mismatched document fails in one of two quiet ways:

- **The record is skipped.** If a required field is missing or has the wrong type, the parser returns nil and the record simply disappears from iOS. For example, a booking needs:
  - `operativeId` and `projectId` as UUID strings
  - `date` as a `Timestamp`
  - `timeSlot`, `bookedBy` and `status`, with `timeSlot` and `status` using the exact raw values
- **The value silently changes.** Other fields fall back to defaults when the type is wrong (`as? Timestamp`, `as? Double`, `as? Int` fail). For example, a start date saved as a string shows up as another date, and a rate saved as a string becomes empty.

Every web write must follow these rules:

- **Write every field iOS writes for that entity, with the same type and key casing.** Use the payload tables in Blueprint §5 and check the save/load function for each entity.
- **Write whole numbers to `Int` fields.** A value like `7.5` in an `Int` field breaks iOS. Round exactly where iOS rounds.
- **Use uppercase UUID strings** for IDs, both as document IDs and inside fields. iOS compares many IDs as strings (`uuidString`).
- **Write dates as Firestore `Timestamp`s**, not ISO strings or milliseconds, unless iOS stores them differently. Normalise them the same way iOS does: for example `startOfDay` in `Europe/London`, weeks starting on the same day, and the same inclusive/exclusive ranges.
- **Use exact enum raw values and exact field-name casing.**
- **Handle missing values as the Swift optionals do.** Distinguish a missing key from `null` in the same way, and never write `undefined`.
- **Use the same ID strategy, and don't write fields iOS doesn't know about** without approval.
- **Don't erase fields you don't manage.** Use the same write style as iOS. iOS replaces many documents in full on every save (Blueprint §5.1), so never store web-only fields on those documents.

Enforce these rules in code: one converter per model, plus a runtime validator that **blocks invalid writes** and, in development, logs any document that fails to parse on read. Use Zod if it's already installed; otherwise propose it at Stop Gate 1.

---

## 6. Phase 0: Access check (read-only)

1. Confirm that you can list `IOS_ROOT` and find the `.xcodeproj`, `GoogleService-Info.plist` and the `@main` app file. Count all `.swift` files, excluding the skipped folders. If `IOS_ROOT` still shows the placeholder, look through the workspace folders for the one that contains a `.xcodeproj`, use it, and tell Farnie to update the placeholder.
2. If you can't reach the iOS project, **stop** and give Farnie these steps:
   - Add the iOS folder to this workspace with *File → Add Folder to Workspace…*, then *File → Save Workspace As…*.
   - Allow Cursor to access the Desktop if macOS asks.
   - If the Desktop syncs with iCloud, make sure the folder is fully downloaded.
3. Identify the web stack from `WEB_ROOT`: `package.json`; the lockfile, which tells you the package manager; the Next.js version and whether it uses the App Router or Pages Router; the Firebase SDK version; Zustand; UI primitives; the icon library; and the test and lint scripts.
4. If `WEB_ROOT` is a git repo, create and switch to a branch called `ios-parity-rebuild`, unless you're already on it. Commit (don't push) at the end of each phase and section.
5. Create `DOCS/` and `DOCS/sections/`, then start `DOCS/PROGRESS.md` from the template in §12.

## 7. Phase 1: Global discovery (docs only, no app code)

Produce the files below and cite `File.swift:line` throughout. Phase 1 may take more than one chat. Finish each document before starting the next.

**Start from the blueprint; don't start from scratch.** Each document below builds on a blueprint section:

| Document | Blueprint starting point |
|---|---|
| `01-data-model.md` | §5 |
| `02-navigation-map.md` | §2 and the §9 screen index |
| `03-design-system.md` | §3 and §4 |
| `04-business-logic.md` | §1.4, §1.5 and §7 |

For each one:
1. **Verify** the blueprint by spot-checking the cited Swift code.
2. **Extend** it with anything it doesn't cover: every field, query, enum, rule and screen.
3. **Record corrections.** Wherever you found something to fix, add a "Blueprint corrections" list at the end of the document.

### `00-ios-inventory.md`

- List every Swift file (path, line count, one-line purpose), grouped by feature or section. End with **Coverage: X of Y Swift files catalogued**, which must be 100%.
- List the targets, deployment target, packages (with their web equivalents), device capabilities and custom fonts.
- Flag any iOS screens or features that are **not** in the §9 section list, such as screens reached from Settings or from inside other sections. They are in scope unless Farnie says otherwise.

### `01-data-model.md`

- Firebase services in use, plus the findings from the §4 linkage checklist.
- The full collection tree: paths, sub-collections and organisation scoping.
- Every enum, with its exact raw values.
- Every query and listener: collection, filters, order, limit, live or one-off, and which screen uses it.
- Every write: fields, merge behaviour, and any batch or transaction.
- Every Storage path, and every callable function (name, region, payload, response).
- The role/permission matrix across all sections.
- **Every** model, in this format:

```text
### Model: <Name>  (<File.swift:line>)
Path: <collection path>   ID strategy: <…>   Written by: <files>   Read by: <files>
| Swift property | Firestore key | Swift type | Firestore type | TS type | Optional | Default | Notes / evidence |
```

### `02-navigation-map.md`

- The top-level navigation exactly as iOS presents it: order, labels, icons, badges and which roles see each item.
- A Mermaid diagram of the flow between screens.
- A proposed web route map that reuses existing web routes where sensible.
- A table of **every** screen:

```text
| # | Section | Swift view (file) | Reached from | Presentation (push / sheet / full screen / alert / menu) | Roles | Web route or component |
```

### `03-design-system.md`

- Colour tokens (name, light value, dark value, source file), type scale, spacing, corner radii, shadows and materials.
- Each shared SwiftUI component, modifier and button style, and the React component planned for it.
- An SF Symbol → web icon mapping table covering every symbol used.
- Layout rules for desktop, tablet and mobile widths, based on the iOS layouts (and the iPad layouts, if any).

### `04-business-logic.md`

- Every calculation, with evidence: hours, overtime, breaks, rounding, leave entitlement, accrual and carry-over, bank holidays, audit scoring, totals, VAT and markups.
- Likewise with evidence: every validation rule, status workflow, numbering scheme, date/time normalisation, formatting rule, notification, export and permission check.

### `05-web-gap-analysis.md`

- For each section of the existing web app: what exists, what matches iOS, what deviates, and what's missing.
- Web-only features that aren't in iOS. **Keep them**, and list them for Farnie to decide on.
- Which existing code can be reused and which needs rewriting.

### ⏸ Stop Gate 1

Write the report described in §11. Include:
- the §9 build order, adjusted for the real dependencies
- all open questions
- any dependencies you propose to add
- the decisions from **Blueprint §8** that Farnie needs to make: web-only dashboard, warning-dismissal sync, map and geocoding provider, web push, and the security notes
- the proposed route map (Blueprint §2.3)

## 8. Phase 2: Foundations

Only start this after Farnie approves Phase 1.

1. Verify the Firebase config, and fix it if needed, following §4. Use environment variables only.
2. Create types, converters and validators for **all** models in `01-data-model.md`.
3. Write services that mirror the iOS data layer, using the same function names where sensible.
4. Build the auth flow (Blueprint §6.0 and §1.2):
   - login, password reset, sign-out and the session gate, with the same screens and wording as iOS
   - the placeholder-user merge
   - the privacy-policy gate
   - loading the user's profile, organisation and role
   - route guards
5. Add `lib/permissions.ts` (Blueprint §1.4) and `lib/access/workAccess.ts` (Blueprint §1.5), with unit tests.
6. Add the design tokens (Blueprint §4) to the Tailwind theme, with light and dark values, plus the **desktop upsizing scale** (Blueprint §3.2). Then build the shared primitives from Blueprint §4.5:
   - cards, stat row, search row, filter chips, work card
   - settings cards, permission toggle row, icon chip, status pill
   - page header, modal (with the iOS header and a sticky footer), confirmation dialog, row "⋯" menu
   - segmented control, switch, empty state, loading skeleton, toasts
7. Build the **desktop app shell** (Blueprint §3.1):
   - a sidebar that mirrors the Main Menu catalogue (Blueprint §2.2), including permissions, shared labels, subtitles and badges
   - a top bar with + New, refresh, notifications and the avatar menu
   - the offline and role-preview banners
   - the mobile bottom bar below 768px
   - the route map (Blueprint §2.3)
8. Build **Home** (Blueprint §3.4 and §6.18): the overview hero with admin metric customisation, status tiles, the quick-actions grid with customise, add and remove, Up Next, the Maintenance card and the task-limit banner.
9. Port the pure logic modules that Home and the shell depend on (Blueprint §7: Home metrics and Up Next, the payroll time policy used for sorting), with unit tests. Port the remaining §7 modules at the start of the section that needs them.
10. Add a data health check page, available in development builds only. It reads a sample from each collection and reports any documents that fail validation or parse differently from the Swift parser. It must never write.
11. Make sure type-check, lint and build all pass. Check the shell and Home at 1440, 1280, 1024 and 390px wide.

### ⏸ Stop Gate 2

Write the §11 report, and ask Farnie which test organisation or account to use for write tests.

## 9. Phase 3: Sections, one at a time

The default build order is below. The sections come from the real iOS app. Adjust the order if Phase 1 finds different dependencies.

| # | Section | Blueprint | Main iOS files (read in full in 3A) |
|---|---|---|---|
| 1 | **Manage Users** | §6.16 | `Views/ManageUsersView.swift`, `Views/ManageUserProfileChrome.swift`, `Models/UserRoleTransitionPolicy.swift`, `Core/UserStore.swift` |
| 2 | **Add User** | §6.15 | `Views/AddUserView.swift`, `FirebaseBackend.swift` `createUserInvitation`, `Views/LineManagersMultiSelectSheet.swift` |
| 3 | **Settings**, including the Organisation hub and every sub-page | §6.17 | `Views/SettingsView.swift`, `Views/SettingsHubSupportViews.swift`, `Views/OrganisationSettingsHubView.swift`, `Views/Organisation*View.swift`, `Views/CompanyDetailsEditView.swift`, `Views/GeneralAppSettingsView.swift`, `Views/AppearanceSettingsView.swift`, `Views/ChangePasswordView.swift`, `Views/SwitchOrganisationView.swift` |
| 4 | **Job Types** | §6.11 | `Views/JobTypesManagementView.swift` |
| 5 | **Qualifications** (organisation templates and My Qualifications) | §6.10 | `Views/QualificationsManagementView.swift`, `Views/OperativeQualificationsEditorView.swift`, `Views/AssignQualificationsPickerView.swift` |
| 6 | **Wholesalers** | §6.12 | `Views/WholesalersView.swift`, `Views/WholesalersRevampViews.swift`, `Views/EditWholesalerView.swift` |
| 7 | **Material Catalogue** | §6.13 | `Views/MaterialsCatalogueFlow.swift`, `Core/MaterialCatalogCSV.swift`, `Core/MaterialCatalogDuplicateDetection.swift` |
| 8 | **Sub Contractors** | §6.14 | `Views/SubcontractorsView.swift`, `Views/ScheduleSubcontractorView.swift` |
| 9 | **Clients** | §6.1 | `Views/ClientsView.swift`, `Views/CreateClientView.swift`, `Views/EditClientView.swift` |
| 10 | **Managers** | §6.5 | `Views/ManagersView.swift`, `Views/CreateManagerView.swift` |
| 11 | **Operatives** ("Manage Operatives") | §6.4 | `Views/OperativesView.swift`, `Views/OperativeProfileView.swift`, `Views/CreateOperativeView.swift` |
| 12 | **Projects**: list, create, edit and the detail hub | §6.2 | `Views/ProjectsView.swift`, `Views/ProjectDetailView.swift` (hub and details), `Views/CreateProjectView.swift`, `Views/EditProjectView.swift` |
| 13 | **Small Works** | §6.3 | `Views/SmallWorksView.swift`, `Views/CreateSmallWorksView.swift` |
| 14 | **Scheduling and My Schedule**: booking operatives, sub contractors and managers; clashes | §6.21, §6.24 | `Views/MyScheduleView.swift`, `Views/ScheduleOperativeView.swift`, `Views/BookLabourFlowView.swift`, `Views/BookingHoursEditSheet.swift`, clash views, `Core/PayrollHoursEngine.swift` |
| 15 | **Tasks**, including the job's My Tasks tile | §6.19 | `Views/TasksDetailView.swift`, `Views/ProjectDetailView.swift` ~L2400–6348 |
| 16 | **Job tiles**: View (visibility), Materials, H&S, Deadlines, Location, Active users | §6.24, §6.13 | `Views/Materials*.swift`, `Views/ProjectHealthSafetyView.swift` + `HS*`, `Views/DL*.swift`, `Views/ProjectDeadlinesView.swift`, `Views/ProjectActiveOperativesView.swift` |
| 17 | **Timesheets** (iOS `InvoicingView`) | §6.9 | `Views/InvoicingView.swift`, `Views/TimesheetManagerReviewSupport.swift`, `Core/Timesheet*.swift`, `Core/Payroll*.swift`, `Core/InvoicingPeriodResolver.swift` |
| 18 | **Annual Leave**, including the team directory and approvals | §6.6 | `Views/HolidayView.swift`, `Views/OperativeAnnualLeaveViews.swift`, `Models/AnnualLeavePolicy.swift`, `Core/BankHolidayService.swift` |
| 19 | **Site Audit** | §6.8 | `Views/SiteAuditView.swift`, `Views/SiteAudit/*.swift` |
| 20 | **Site Map** (a geographic map with pins for live jobs) | §6.7 | `Views/OrgSitesMapView.swift`, `Core/GeocodingCacheService.swift` |
| 21 | **Warnings** | §6.20 | `Views/WarningsDetailView.swift`, `Views/WarningsRevampViews.swift`, `Core/Warnings*.swift` |
| 22 | **Daily Overview** | §6.22 | `Views/DailyOverviewView.swift` |
| 23 | **Weekly Report** | §6.23 | `Views/WeeklyReportView.swift`, `Core/WeeklyReportExportBuilder.swift` |
| 24 | **Notifications, Help, Privacy, Profile** | §6.25, §6.26 | `Views/NotificationsView.swift`, `Views/HelpView.swift`, `Views/PrivacyPolicyView.swift`, `Views/HomeView.swift` (`HomeProfileCardSheet`) |

Rows 1–13 and 17–20 are the areas Farnie listed. The rest also exist in the iOS app and are **in scope** unless Farnie says otherwise; confirm at Stop Gate 1. Build only what the Swift code contains.

**Desktop layout.** Every section must follow the "Desktop" notes in its Blueprint §6 entry and the patterns in Blueprint §3.3.

Handle each section in a fresh chat, in three steps. For large sections, 3A and 3B can be separate chats; record which in `PROGRESS.md`.

### 3A: Spec

Read every Swift file for the section in full: views, view models, services, models, and the components they use. Then write `DOCS/sections/NN-<section>.md`, covering the following for **every screen**:

- **Purpose:** entry points, presentation style, and which roles can see it.
- **Layout, top to bottom:** sections, headers and footers, rows, and their order and content.
- **Every field:**
  - label, placeholder and control type
  - keyboard type, default value and format
  - validation rule and message, and whether it's required
  - the Firestore key it maps to
- **Every action:**
  - where it lives (leading or trailing toolbar, row, swipe, context menu or bottom button), with its label and icon
  - when it's enabled or disabled, and any confirmation text
  - what it reads and writes
  - what happens afterwards (dismiss, navigate, toast or alert)
- **Lists:**
  - the data source query, and whether it's live or one-off
  - sorting, grouping, search logic, filters and pagination
  - the row layout
  - the empty, loading and error states
- **Roles:** differences by role or permission.
- **Wording:** the exact text of titles, buttons, alerts, empty states and errors.
- **Desktop layout plan:** for each screen, the layout at ≥1280px and at 1024px, using Blueprint §3.3 (grid, table, master–detail, modal size, column split) and the upsizing in §3.2. Include a small ASCII wireframe for the main screen.
- **Screenshots:** references to the iOS screenshots in `SCREENSHOTS`. If there aren't any, ask Farnie for them.
- **Cross-platform test script for Farnie:**
  - create, edit and delete on the web, then check the iPhone
  - do the same the other way round
  - check live updates with both apps open
  - repeat as an operative-level user

### 3B: Build

Implement exactly what the spec describes, building on the foundations. Use real Firestore data only: no mock data, placeholders or "coming soon" stubs. Use live listeners wherever iOS updates live, and match the wording word for word.

### 3C: Verify

1. Walk through the spec line by line against the web code.
2. If you have a browser tool, run the app and compare each screen with the iOS screenshots in light and dark mode.
3. Check every screen at **1440, 1280, 1024 and 390px** wide:
   - no stretched single columns and no tiny phone-sized text on desktop
   - hover and focus states present
   - modals sized per Blueprint §3.3
4. Run type-check, lint and build.
4. Fill in the parity table, update the spec and `PROGRESS.md`, and commit.

### ⏸ Stop Gate

Write the §11 report for the section.

## 10. Phase 4: Final parity audit

- Check the navigation map again: every iOS screen has a web equivalent or an approved exception.
- Run the data health check across all collections.
- Confirm that Farnie has verified every section on a real device.
- Write `DOCS/06-final-parity-report.md` with a summary, approved exceptions, web-only features and follow-ups.

---

## 11. Report formats

### Stop Gate report

```markdown
## ⏸ STOP GATE: <phase or section>
**Done:** (10 bullets max)
**Files created/changed:** …
**Evidence coverage:** X of Y Swift files read for this scope
**Parity table:** (sections only)
| iOS element (File.swift:line) | Web implementation (file) | Status ✅ / ⚠️ / ❌ | Note |
**Deviations and why:** …
**Blocked / needs Farnie:** (console settings, keys, approvals)
**Questions:** (numbered, format below)
**Suggestions (not built):** …
**Next step:** …
```

### Questions

```text
Q3. Rounding differs: TimesheetViewModel.swift:210 rounds to 0.25 h, WeeklyReportView.swift:88 rounds to 0.5 h.
    Which should the web use? Recommendation: 0.25 h (it's the value that gets stored).
```

## 12. `PROGRESS.md` template

```markdown
# iOS → Web parity: progress
Last updated: <date/time> · Current step: <…> · Stopped at: <exact point, if mid-step>

## Phases
- [ ] 0 Access check
- [ ] 1 Discovery (00 ☐ 01 ☐ 02 ☐ 03 ☐ 04 ☐ 05 ☐)
- [ ] 2 Foundations
- [ ] 3 Sections
- [ ] 4 Final audit

## Sections
| # | Section | Spec | Built | Agent-verified | Farnie-verified on iPhone | Notes |
|---|---|---|---|---|---|---|
| 0 | Shell, Login and Home (Phase 2) | ☐ | ☐ | ☐ | ☐ | |
| 1 | Manage Users | ☐ | ☐ | ☐ | ☐ | |
| 2 | Add User | ☐ | ☐ | ☐ | ☐ | |
| 3 | Settings | ☐ | ☐ | ☐ | ☐ | |
| 4 | Job Types | ☐ | ☐ | ☐ | ☐ | |
| 5 | Qualifications | ☐ | ☐ | ☐ | ☐ | |
| 6 | Wholesalers | ☐ | ☐ | ☐ | ☐ | |
| 7 | Material Catalogue | ☐ | ☐ | ☐ | ☐ | |
| 8 | Sub Contractors | ☐ | ☐ | ☐ | ☐ | |
| 9 | Clients | ☐ | ☐ | ☐ | ☐ | |
| 10 | Managers | ☐ | ☐ | ☐ | ☐ | |
| 11 | Operatives | ☐ | ☐ | ☐ | ☐ | |
| 12 | Projects | ☐ | ☐ | ☐ | ☐ | |
| 13 | Small Works | ☐ | ☐ | ☐ | ☐ | |
| 14 | Scheduling and My Schedule | ☐ | ☐ | ☐ | ☐ | |
| 15 | Tasks | ☐ | ☐ | ☐ | ☐ | |
| 16 | Job tiles (View, Materials, H&S, Deadlines, Location, Active users) | ☐ | ☐ | ☐ | ☐ | |
| 17 | Timesheets | ☐ | ☐ | ☐ | ☐ | |
| 18 | Annual Leave | ☐ | ☐ | ☐ | ☐ | |
| 19 | Site Audit | ☐ | ☐ | ☐ | ☐ | |
| 20 | Site Map | ☐ | ☐ | ☐ | ☐ | |
| 21 | Warnings | ☐ | ☐ | ☐ | ☐ | |
| 22 | Daily Overview | ☐ | ☐ | ☐ | ☐ | |
| 23 | Weekly Report | ☐ | ☐ | ☐ | ☐ | |
| 24 | Notifications, Help, Privacy, Profile | ☐ | ☐ | ☐ | ☐ | |

## Open questions
## Decisions (date · decision · by)
## Approved exceptions
## Web-only features (keep)
## Firebase / console actions for Farnie
```

## 13. Definition of done (per section)

- [ ] Every screen, field, action, state and permission in the section spec exists on the web, or is listed as an approved exception.
- [ ] Reads and writes use the exact paths, keys, types, enum values and org scoping, with converters and validation in place.
- [ ] The web updates live wherever iOS does.
- [ ] The wording matches iOS word for word. The look matches the screenshots in light and dark mode.
- [ ] The desktop layout follows Blueprint §3 and the section's "Desktop" notes, and has been checked at 1440, 1280, 1024 and 390px wide.
- [ ] Type-check, lint and build pass, with no new console errors or warnings.
- [ ] File headers link to the iOS sources. The spec, parity table and `PROGRESS.md` are updated, and the changes are committed.
- [ ] The cross-platform test script is ready for Farnie.

---

### Appendix: prompts Farnie uses to drive this (no action needed from the agent)

- **Start:** `Read @docs/ios-parity/IOS_PARITY_REBUILD.md and @docs/ios-parity/IOS_APP_BLUEPRINT.md in full, then do Phase 0 and Phase 1 only. No app code yet. Finish with Stop Gate 1.`
- **Continue** (in a new chat each time): `Continue the iOS parity rebuild per @docs/ios-parity/IOS_PARITY_REBUILD.md and @docs/ios-parity/IOS_APP_BLUEPRINT.md. Read @docs/ios-parity/PROGRESS.md, do the next unchecked step only, and finish with its stop gate.`
- **A specific section:** `Do Phase 3 for the <name> section per @docs/ios-parity/IOS_PARITY_REBUILD.md, using Blueprint §<n>. Desktop-first. iOS screenshots attached.`
- **A parity bug:** `Parity bug in <section>: on iOS <what happens>; on the web <what happens>. Find the Swift source of truth, fix the web to match, then update the section spec and PROGRESS.md.`
