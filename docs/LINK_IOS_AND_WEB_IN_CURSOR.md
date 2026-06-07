# Link iOS + web app in Cursor

Use this so both apps appear in the sidebar and you can `@` iOS files in chat (e.g. `MainMenuCatalog.swift`, `FirebaseBackend.swift`).

**Paths on your Mac:**

| App | Folder |
|-----|--------|
| Web | `Desktop/Project Planner/web-app` |
| iOS | `Desktop/Project Planner/Project Planner` |

No changes to the iOS or web **code** are required — only how Cursor opens folders.

---

## Method 1 — Open the workspace file (easiest)

1. In **Finder**, go to: `Desktop → Project Planner`
2. Double-click: **`Project-Planner.code-workspace`**
   - Cursor should open (or VS Code, if that’s your default for `.code-workspace`)
3. In the left sidebar you should see **two roots**:
   - **Web app** → `web-app`
   - **iOS app** → `Project Planner`

If double-click opens VS Code instead of Cursor:

- Open **Cursor**
- **File → Open…**
- Select `Project-Planner.code-workspace` in `Desktop/Project Planner`

---

## Method 2 — Command palette (if File menu has no “Add Folder…”)

Cursor often hides **Add Folder to Workspace** until you already have a `.code-workspace` open. Use the palette instead:

1. Press **`⌘ Shift P`** (Mac) or **`Ctrl Shift P`** (Windows) to open the **Command Palette**
2. Type: **`Add Folder to Workspace`**
3. Pick: **Workspaces: Add Folder to Workspace** (or similar)
4. Select the **inner** iOS folder:  
   `Desktop/Project Planner/Project Planner`  
   (must contain `Views`, `FirebaseBackend.swift`, etc.)
5. Palette again → **`Save Workspace As`**
6. Save as `Project-Planner.code-workspace` in `Desktop/Project Planner`

If the palette shows **no** “Add Folder” command, skip to **Method 1** (open `Project-Planner.code-workspace`) or **Method 3** (open parent folder).

## Method 2b — File menu (only on some Cursor versions)

If your **File** menu lists it:

1. **File → Add Folder to Workspace…**
2. Same folder as above → **Add**
3. **File → Save Workspace As…** → `Project-Planner.code-workspace`

If you only see **Open…**, **Open Folder…**, **Open Recent** — use Method 1 or the Command Palette (Method 2).

---

## Method 3 — Open the parent folder

1. **File → Open Folder…**
2. Select: `Desktop/Project Planner` (the **parent** that contains both `web-app` and `Project Planner`)
3. You’ll see `web-app`, `Project Planner`, `Project Planner.xcodeproj`, etc.

**Note:** Method 1 or 2 is usually clearer (named “Web app” / “iOS app”). Method 3 works but the tree is busier.

---

## Check it worked

1. Left sidebar shows **two** project roots (or one parent with both folders).
2. Expand **iOS app** → you should see `Navigation/MainMenuCatalog.swift`, `FirebaseBackend.swift`, `Views/`, etc.
3. In Cursor chat, type `@` and start typing `MainMenu` — iOS files should appear in the list.

---

## Using it with the AI agent

Once linked, you can say things like:

- “Match the web sidebar to `@MainMenuCatalog.swift`”
- “Use Firestore paths from `@FirebaseBackend.swift` for the clients page”

The agent can also read iOS via full disk paths without linking, but linking makes `@` references reliable and faster for you.

---

## Terminal (optional)

From either app folder:

```bash
cd "/Users/farnienel/Desktop/Project Planner/web-app"
npm run dev
```

iOS is still built in **Xcode** (`Project Planner.xcodeproj` in the parent folder). Cursor is for editing and AI; Xcode for run/simulator.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| No “Add Folder to Workspace” in File menu | Normal in Cursor — use **Method 1** (workspace file) or **⌘⇧P** → `Add Folder to Workspace` |
| Only `web-app` in sidebar | Open `Project-Planner.code-workspace` (Method 1) or Method 3 |
| Added wrong folder | Right-click extra root → **Remove Folder from Workspace**, try again |
| `.code-workspace` opens VS Code | **File → Open** in Cursor and pick the workspace file |
| Chat `@` doesn’t show Swift files | Confirm iOS root is in workspace; try `@Project Planner/Navigation/MainMenuCatalog.swift` |

---

## Do not

- Copy the whole iOS project **into** `web-app/` (git noise, duplicates).
- Edit iOS only to “help the web app” — read paths from iOS; change **web** code to match.

Firestore parity reference: `web-app/docs/IOS_FIRESTORE_PARITY.md`
