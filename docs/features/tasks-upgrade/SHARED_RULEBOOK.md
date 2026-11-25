# Shared rulebooks: keeping iOS and web 100% the same

This applies to **every shared platform feature**, starting with:

- `tasks` — this pack (`rules/tasks.rules.json`)
- `org-compliance` — the Insurance & accreditations pack (`rules/org-compliance.rules.json`)
- `theme` — colour tokens for light and dark mode (`rules/theme.tokens.json`), shared by every feature. Unlike feature rulebooks, these are **built into** each app at build time rather than fetched, because colours are needed before anything loads. See `THEME.md`.

Same mechanism for both, so there's one way of doing it across Project Planner.

---

## 1. The idea in one paragraph

A **rulebook** is a JSON file that holds everything about a feature that should be identical on iOS and web: names of statuses and priorities, field order, limits, which upload sources each platform gets, how dates are worded, sorting, and every message. It lives once in git. The backend stores the live copy and enforces it. Both apps read it and render from it. A **fixtures** file holds worked examples ("today is 24 Nov, due 15 Sep → '70 days overdue'"), and both apps' unit tests must give exactly those answers. If the rulebook and fixtures are shared and both platforms pass the fixtures, they can't quietly drift apart.

**Existing rulebooks first.** Before adding anything, Claude Code checks for rulebooks or shared config that already exist (`platformRulebooks/*` in Firestore, `rules/*.json`, Remote Config, constants files). If one exists for tasks, or the mechanism already exists from another feature (e.g. Insurance & accreditations), it extends and versions what's there. It never creates a second, parallel mechanism or overwrites a live rulebook.

## 2. What goes in a rulebook, and what doesn't

| In the rulebook | Not in the rulebook |
|---|---|
| Status, priority and type keys, labels, tones (tone names map to colour tokens in `theme.tokens.json`) | Colour values themselves (they live in `theme.tokens.json`), fonts, spacing |
| Allowed status changes and which actions open a form | Screen layout and navigation |
| Field order, required, lengths, limits | Platform code and components |
| Upload types, sizes, counts, image resize, sources per platform | API keys, bucket names, secrets |
| Date wording, overdue / due-soon rules, time zone rule | Anything that changes per user |
| Tabs, scopes, sorting, grouping | |
| All user-facing text | |
| Proposed permissions (confirmed against the code) | |

## 3. How it travels (Firebase)

The recording shows attachments on `firebasestorage.googleapis.com`, so the plan below assumes Firestore + Firebase Storage + Cloud Functions. Claude Code confirms this in Phase 1.

```
rules/<key>.rules.json          ← the only place anyone edits (git, reviewed)
rules/<key>.rules.schema.json   ← CI validates the file
rules/<key>.fixtures.json       ← CI runs both platforms' tests against it
        │
        │  deploy script (CI): only writes if rulebookVersion is higher
        ▼
Firestore: platformRulebooks/<key>   { version, body, updatedAt }
        │                    │
        │                    └── Security rules and Cloud Functions read it to validate writes
        ▼
iOS app and web app:
  - read platformRulebooks/<key> on launch / page open (one small document)
  - cache it; use the cached copy offline
  - fall back to the copy bundled at build time if there's no cache
  - render labels, options, order, limits and messages from it
```

**Rules for the setup**

1. **One place to edit.** Never hand-edit the Firestore copy or a bundled copy. A build script copies the file into each app; CI fails if a bundled copy differs from `rules/`.
2. **Readable by any signed-in user, writable by nobody** except the deploy service account.
3. **Server checks are the real checks.** Firestore security rules validate the simple things on every write (allowed status and priority keys, required fields, field lengths, server-only fields untouched, organisation matches the user). Anything more complex (status transitions, checklist must be complete before Completed, attachment counts) goes through a Cloud Function per action (`startTask`, `completeTask`, `reopenTask`, ...) or rules that check `request.resource` against `resource`. Claude Code proposes which, based on how the app writes today.
4. **Legacy values are mapped on read and migrated once.** Both apps read old values through the rulebook's `legacy*Map`. A one-off migration script (dry run first, counts shown, then run with approval) rewrites stored values so the maps can eventually be removed.
5. **Version on every write.** Clients write `rulebookVersion` on documents they change, which makes "which app wrote this?" easy to answer.

## 4. Change rules

| Change | App release needed? |
|---|---|
| Rename a label, change wording | No |
| Change a limit (max files, size, days) | No |
| Add a priority, status, type, tab, or upload source **using an existing kind** | No, but **status additions also need the server transition rules updated** |
| Reorder form fields or tabs | No |
| Add a new field **kind**, a new action, a new screen behaviour | Yes, both platforms. Ship app support first, then the rulebook change |
| Remove a key that stored data uses | Never. Mark it `retired` and map it |

Every change: bump `rulebookVersion`, update fixtures if behaviour changed, PR reviewed, CI green on both platforms, deploy.

## 5. The cross-platform checklist (use for every shared feature)

- [ ] One rulebook file in `rules/`, schema-valid, versioned.
- [ ] Deployed to `platformRulebooks/<key>`; both apps read it; offline fallback works.
- [ ] No label, option list, limit or message for the feature is hard-coded in either app (search both codebases for the strings).
- [ ] Both apps map legacy values through the rulebook.
- [ ] One shared fixtures file; **iOS unit tests and web unit tests both load it and pass**.
- [ ] Same data document shape read and written by both apps.
- [ ] Same storage paths and file metadata from both apps; a file uploaded on one opens on the other.
- [ ] Server rules / functions enforce the rulebook on writes from both apps.
- [ ] Same counts on the same screen on both platforms for the same user, checked side by side.
- [ ] Change a label in the rulebook, deploy, see it on both without a release.
- [ ] Platform-only differences are listed in the rulebook (e.g. `attachments.sources.web` has no camera) and nowhere else.
- [ ] Both platforms generate their colours from `rules/theme.tokens.json`; no hex values in feature screens; light and dark both checked (THEME.md section 6).

---

## 6. Rulebook parity prompt (run any time)

Paste this into Claude Code whenever you want to check iOS and web still match, after any change to a shared feature, or before a release.

```
Audit cross-platform parity for Project Planner's shared rulebooks. Read only: don't change code unless I approve.

1. List every file in rules/ (*.rules.json, *.schema.json, *.fixtures.json). Validate each rulebook against its schema. Check fixtures reference the current rulebookVersion.
2. Check the live copy: compare platformRulebooks/<key> in Firestore (or wherever the backend keeps it) with the file in git. Report version and any difference.
3. For each rulebook, search the iOS and web codebases for hard-coded values that should come from it: status and priority labels and keys, field labels, upload limits and types, attachment source lists, date wording, tab names, button text, error messages. List each hit with file and line.
4. Run both platforms' fixture tests. Report pass/fail per fixture case per platform.
5. Compare the data each platform writes: field names, value formats, storage paths, file metadata. Flag anything one platform writes that the other doesn't read, or reads differently.
6. Check server enforcement: which rulebook rules are enforced in Firestore security rules / Cloud Functions, and which only in the apps.
7. Check platform-only differences are declared in the rulebook (e.g. camera only on iOS) and not decided in app code.
8. Theme: confirm both platforms' generated colour files match rules/theme.tokens.json, the contrast check passes in both modes, and list any hex colours in feature screen code.
Report as a table: area, iOS, web, server, status (match / mismatch / missing), and a suggested fix for each mismatch. Then stop.
```

---

## 7. Note for the Insurance & accreditations pack

That pack's `reference/schema.reference.sql` assumed Postgres. On Firebase, use this same setup instead:

- `platformRulebooks/org-compliance` in Firestore for the live rulebook.
- Firestore collections for documents, share links and events, with security rules restricting them to org-settings admins of the organisation.
- A private Storage path per organisation.
- Cloud Functions for the server operations, the public share-link page and the daily purge.

Its MASTER prompt already tells Claude Code to adapt to the real stack; point it at this file too.
