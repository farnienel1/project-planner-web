# UI contrast audit (dev only)

`contrast-audit.mjs` opens the public website, `/register-interest`, the setup flow (every wizard step and sub-step, the logo crop dialog, check-email, success, verify-email, email preview) and the signed-in app's public pages in Chromium. It checks every text colour against WCAG 2.1 AA, measuring each element against its real background:
- the always-dark pages are opened with the system theme light and dark, at 1280px and 390px;
- the app pages are opened with the app's own theme light and dark.

It also checks:
- placeholders: 4.5:1;
- the focus indicator of the first three fields on each page: 3:1;
- that no page scrolls sideways;
- that the app pages follow the app's own theme rather than the forced dark;
- form fields without a 3:1 boundary, reported as a warning.

It exits 1 when a check fails on an always-dark surface, or when an app page does not follow the app's own theme. Findings on the app pages are listed in their own section and fail the run only with `--strict-app`. It is not part of CI.

## Run it

1. Start the dev server:
   ```
   npm run dev
   ```
   The setup wizard needs a Firebase config to render. Any syntactically valid one works, for example a fake `NEXT_PUBLIC_FIREBASE_API_KEY` (longer than 10 characters) and `NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-audit`. The audit never signs in, writes, or calls Stripe; wizard steps are opened through the wizard's own session draft (`pp.setupWizard.v1`).
2. Make Playwright and Chromium available (not a project dependency):
   ```
   npm i -D --no-save playwright && npx playwright install chromium
   ```
3. Run the audit:
   ```
   node scripts/ui-audit/contrast-audit.mjs --base http://localhost:3000 --out ui-audit-out --screenshots
   ```
   Options:
   - `--widths 1280,390`: the viewport widths to test.
   - `--only /register-interest,/setup`: test only paths starting with these.
   - `--screenshots`: save full-page images too.
   - `--strict-app`: also fail on the app pages' findings.

## Output

`ui-audit-out/contrast-audit.json` has every page's figures. The console lists:
- each failing text, with its colours, ratio and where it appears;
- disabled-control text, listed separately because WCAG exempts it;
- placeholders, focus indicators, field boundaries, overflow, and the app-theme check.
