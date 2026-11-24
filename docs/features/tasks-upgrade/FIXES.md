# Fixes

Two issues were reported. Going through the web screenshots and the iOS screen recording turned up more, some of which can lose data. Fix these **before** the UI upgrade and ship them as their own change, on both platforms. Any UI added or changed by a fix uses the colour tokens in `rules/theme.tokens.json`, so it already works in light and dark (see THEME.md).

Evidence key: **W** = web screenshot, **V** = iOS recording (timestamps in seconds).

---

## Issue 1 — Web takes ages to save a task with a file, then doesn't save (check iOS too)

**What we saw.** Web New task with one photo attached: button stuck on "Saving…" (W 12.11.49). On iOS, completing a task with a photo did upload ("Uploading…" then done, V 26–30 s), so iOS's completion path works; iOS **create** and **edit** with attachments still need checking.

**Backend clue.** Tapping an attachment on iOS opens a `firebasestorage.googleapis.com` URL in Safari (V 68 s), so files are in **Firebase Storage** and tasks are almost certainly in **Firestore**. Confirm in Phase 1.

### Likely causes, most likely first (verify, don't assume)

1. **The Storage SDK is retrying a failing upload.** Firebase Storage retries failed uploads for up to `maxUploadRetryTime` (10 minutes by default) before giving up. Any underlying failure looks exactly like "Saving… for ages, then nothing".
2. **Storage security rules reject the web upload**, and the error is swallowed so the button never resets. Typical mismatches between iOS and web: a different path, `contentType` missing or different (HEIC, PDF, `application/octet-stream`), a size rule, or a rule expecting metadata iOS sends but web doesn't.
3. **App Check** is enforced on Storage/Firestore but not set up (or failing) in the web app.
4. **Bucket CORS** isn't configured for the web app's domain (`gsutil cors get gs://<bucket>`).
5. **The file is written into the Firestore document** (base64 or data URL), which hits the 1 MiB document limit and fails.
6. **Slow by design:** full-size images uploaded one after another; HEIC decoded on the browser's main thread.
7. **A promise that never settles** in the save flow (waiting on a listener, missing `finally`), so `saving` never goes back to false.

### How to diagnose (Phase 1, read-only)

- Reproduce on web with DevTools open (Network + Console) using a JPG, a HEIC and a PDF. Log timestamps for: validate → prepare → each upload start/progress/end → Firestore write → close.
- Read the Storage and Firestore security rules; test the web upload path in the Rules Playground.
- Check App Check enforcement and whether the web app initialises it.
- Check bucket CORS.
- Diff the **web** and **iOS** upload code paths: storage path, metadata, content type, file size handling, the order of "write task" vs "upload files", and what's stored on the task document.
- Do the same for iOS create-with-attachment and edit-with-attachment.
- Report the actual cause(s) with evidence before changing code.

### Required behaviour after the fix (both platforms, one pipeline)

Every value below comes from `rules/tasks.rules.json` → `attachments`.

1. **Check first:** type, size and count from the rulebook, with the rulebook error messages.
2. **Prepare:** resize images to `image.maxLongEdgePx` (2560) at `jpegQuality` (0.82). HEIC becomes JPEG (iOS natively; web in a Web Worker, lazy-loaded; if the browser can't decode it, show `errors.wrongType`). PDFs are unchanged.
3. **ID first:** create the task ID before uploading so file paths are final: `attachments.storagePath`.
4. **Upload in parallel** (`upload.parallel` = 3) with resumable uploads, `contentType` metadata set, per-file progress, and overall progress on the Save button ("Uploading 1 of 3 · 57%").
5. **Fail fast, never hang:** set the SDK's max upload retry to `upload.sdkMaxUploadRetrySeconds` (60). Add a stall watchdog: no progress for `upload.stallTimeoutSeconds` (45) cancels that file and shows `errors.uploadStalled` with **Retry** and **Remove**.
6. **Write once:** when every file is up, write the task (or the edit) in a single Firestore write/batch with attachment **metadata only** (id, storage path, original name, content type, size, width/height, uploaded by, uploaded at). Never file contents.
7. **Always settle:** every path ends in success or a clear error (`finally` resets state). Map Storage/Firestore/App Check error codes to `copy.errors`.
8. **Cancel cleans up:** Cancel during upload stops uploads and deletes any objects already uploaded. A scheduled function deletes orphaned objects under a task path with no task document after 24 hours.
9. **Same on iOS:** identical paths, metadata and sizes, so a photo taken on iOS shows on web (JPEG, not HEIC) and the reverse.
10. **Targets:** a task without files closes in under 1.5 s. A task with three phone photos on normal office broadband or 4G saves in under 10 s, with progress visible throughout.

---

## Issue 2 — Camera button on web

**What we saw.** Web New task → Attachments shows **Photos / Camera / File / Site audit** (W 12.11.49).

**Fix.** Attachment sources come from the rulebook per platform:

- `ios` / `android`: camera, library, files, site_audit
- `web`: files, site_audit (shown as **Upload files** and **Site audit**)

Remove the Camera button everywhere on web (new task, edit task, complete step / proof of work) and remove any `capture` attribute from web file inputs. On a phone browser, the system file picker already offers "Take photo", so nothing is lost. The rulebook schema rejects `camera` in the web list, so it can't come back by accident.

---

## Other bugs found

| # | What | Evidence | Fix |
|---|---|---|---|
| B3 | Web **Edit task** shows the "Create a new task" banner | W 12.14.29 | Remove the banner from both modes; the popup title says New task / Edit task. |
| B4 | Web **Edit task** shows checklist items unticked for a task whose detail shows 5/5 ticked. Saving may wipe progress | W 12.06.53 vs 12.14.29 | Load and save each item's done state, who ticked it and when. Never reset ticks on save. Test on iOS edit too. |
| B5 | Priority labels disagree: list says **Normal**, popup and form say **Medium**, iOS says **Normal** | W 12.06.46, 12.06.53, V 74 s | One set: Low / Normal / High / Urgent. Map stored `medium` → `normal` (migration, `legacyPriorityMap`). |
| B6 | Status labels disagree: **Done** (iOS stats, project tab) vs **Completed** | W 12.14.18, V 0 s | One label: Completed (`legacyStatusMap`). |
| B7 | iOS Edit lets you set Status = Completed directly, skipping the checklist rule and proof of work | V 80–92 s | Edit only switches To do / In progress. Completing goes through Complete. Completed tasks get Reopen. |
| B8 | iOS opens attachments in Safari at a raw Storage URL | V 66–68 s | In-app viewer (Quick Look for PDFs and images). Web: lightbox in the popup. |
| B9 | Managers land on **Assigned to me** and see "Nothing assigned to you" while tasks exist | V 0 s, W 12.10.53 | Default scope by role (`views.defaultScope`), remember the user's last choice. |
| B10 | Web says every task must have a due date; iOS shows tasks with "No date" | W 12.11.01, V 40 s | Required for new tasks. Existing tasks without one show "No due date", sort last, and the edit form asks for one. |
| B11 | Assigned user deleted shows "Deleted user" with no way forward | W 12.14.18 | Show "Removed user" and flag the task in the Active tab so a manager can reassign. |
| B12 | Two primary blues on web (`#3D4FD8` app-wide, `#1D5AA8` in tasks) | W 12.14.18 | Use the `primary.bg` token everywhere in tasks (`#3D4FD8` in light mode). |
| B13 | Five stat cards that are also filters, and overlap (overdue tasks are also counted in To do) | W 12.06.39 | Replace with tabs with counts (`views.tabs`). See SPEC.md. |

---

## Security note (review, not part of this change)

Firebase download URLs carry a token and work for anyone who has the link, permanently. That's how attachments open in Safari today. Worth reviewing whether task attachments should use short-lived links instead. Don't change it in this piece of work; list it in the final report.
