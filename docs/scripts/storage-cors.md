# Storage CORS (so web PDFs can read photos)

**Why:** the web app reads photo bytes in the browser to build PDFs (site audit report, company logo, PAYE claim
evidence pages, compliance zips). Firebase Storage lets a browser read a file's bytes only when the bucket has a CORS
setting for the app's address. Without it every photo in a web site audit PDF is a grey box (owner report 26 Nov).
Since the fix in `w-site-audit-photos` the app falls back to reading the photo through `/api/storage/file`, so PDFs
work either way; setting CORS makes it faster (no extra server hop) and is the usual Firebase set-up.

This changes **only who may read files from the browser** — never who may read them (the Storage rules decide that,
and every download link still needs its secret token). Nothing is deleted or moved.

## Steps (owner, once, about 2 minutes)

1. Open https://console.cloud.google.com/ and pick project **project-planner-f986c** (top bar).
2. Click the **Cloud Shell** icon (`>_`, top right). A terminal opens at the bottom of the page.
3. Make the settings file. Paste this and press Enter:

   ```
   cat > cors.json <<'JSON'
   [{"origin":["https://projectplanner.us","https://www.projectplanner.us","https://app.projectplanner.us","http://localhost:3000"],"method":["GET","HEAD"],"responseHeader":["Content-Type","Content-Length"],"maxAgeSeconds":3600}]
   JSON
   ```

   (Add any other address the web app runs on, such as a Netlify preview address, to the `origin` list.)
4. See what is set today (it may say "has no CORS configuration" — that is the bug). Paste and press Enter:

   ```
   gsutil cors get gs://project-planner-f986c.firebasestorage.app
   ```

5. Set it. Paste and press Enter:

   ```
   gsutil cors set cors.json gs://project-planner-f986c.firebasestorage.app
   ```

   You should see `Setting CORS on gs://project-planner-f986c.firebasestorage.app/...`.
6. Check it. Run step 4 again; it should now print the list above.
7. Test: on the web app open a site audit with photos, press **PDF**, and check the photos are drawn.

Undo: `echo '[]' > empty.json && gsutil cors set empty.json gs://project-planner-f986c.firebasestorage.app`.
