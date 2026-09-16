# Q2 — Org setup and invite password URLs

iOS stays **read-only** in this repo. Do these edits in Xcode on your Mac. This page is the click-by-click for the login button that currently opens the wrong site.

## What is broken

iOS login **Set up your organisation on the web** opens:

`https://project-planner-f986c.web.app/setup`

That Firebase Hosting URL is a **stale marketing page** (last updated 7 May 2026). The real pay-and-setup wizard is:

`https://www.projectplanner.us/setup` → `https://projectplanner.us/setup`

Invite emails from iOS still use Firebase Hosting `/setup-password.html?token=`. Keep that **path**. Change only the **host** to the public site.

## A. Fastest fix for phones already installed (no App Store wait)

Firebase Console cannot add path redirects by clicking around. You need a Hosting deploy that **adds redirects and keeps the existing files**. If you do not have the current Hosting `public/` folder, **do not** `firebase deploy --only hosting` from this web repo (`firebase.json` here is rules-only and would wipe the static site).

Until you have that folder, use **B** (Xcode) and, for already-installed apps, wait for users to update **or** recover the Hosting files first.

If you do have the Hosting source (the May 2026 marketing site):

1. Add to **that** project’s `firebase.json` (do not replace `public`):

```json
{
  "hosting": {
    "public": "public",
    "redirects": [
      {
        "source": "/setup",
        "destination": "https://www.projectplanner.us/setup",
        "type": 301
      },
      {
        "source": "/setup-password.html",
        "destination": "https://www.projectplanner.us/setup-password.html",
        "type": 301
      }
    ]
  }
}
```

2. Deploy Hosting from **that** project only.
3. Confirm in a browser:
   - `https://project-planner-f986c.web.app/setup` lands on the wizard
   - `https://project-planner-f986c.web.app/setup-password.html?token=test` lands on the Next password page

Do **A** only **after** this web PR is live on Netlify (`/setup-password.html` currently 404s on `www.projectplanner.us`).

## B. Xcode (required so new builds never hit Firebase Hosting)

You already picked the **Modified recently — 19/06/2026** copy of the project (that matches the zip). Open **that** `Project Planner.xcodeproj`.

### 1. Login button — `AppBranding.swift`

Find:

```swift
static let webAppBaseURL = "https://project-planner-f986c.web.app"
```

Change to:

```swift
static let webAppBaseURL = "https://www.projectplanner.us"
```

Leave `organisationSetupURL = "\(webAppBaseURL)/setup"` as it is. The button will then open `https://www.projectplanner.us/setup`.

### 2. Invite / password emails — `ResendEmailService.swift`

Find:

```swift
private let setupPasswordBaseURL = "https://project-planner-f986c.web.app"
```

Change to:

```swift
private let setupPasswordBaseURL = "https://www.projectplanner.us"
```

Do **not** change the path. Links must stay `/setup-password.html?token=…`.

### 3. Fallback invite body — `FirebaseBackend.swift` (~line 5096)

Find:

```text
https://project-planner-f986c.web.app/setup-password.html?token=\(invitationId)
```

Change the host only:

```text
https://www.projectplanner.us/setup-password.html?token=\(invitationId)
```

### 4. Ship

Build, run on a device, tap **Set up your organisation on the web**, confirm Safari opens the Stripe/org wizard (not the old marketing page). Then release that build.

Verification emails already use `https://projectplanner.us/verify?…`. That path is **not** an App Router page on the web app today. Leave it for a later pass unless you want a `/verify` page added.

## C. Netlify (web invite emails)

Site env: `NEXT_PUBLIC_APP_URL` = `https://www.projectplanner.us`  
(or `https://projectplanner.us` to skip the www→apex hop).

Web invites then emit `https://www.projectplanner.us/setup-password.html?token=…`, which this repo rewrites to `/setup-password`.

## Why two hosts existed

| Host | What it is |
|---|---|
| `project-planner-f986c.web.app` | Old Firebase Hosting static site |
| `www.projectplanner.us` / `projectplanner.us` | Current Next.js app on Netlify (pay, setup, dashboard) |

iOS still pointed at the old host. Org setup was never meant to happen in the iOS app.
