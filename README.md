# Project Planner Web App

Full-featured desktop web version of the Project Planner iOS app.

## Features

- ✅ Authentication (Login, Password Reset, Setup)
- ✅ Dashboard with overview and navigation
- ✅ Projects Management (Create, Edit, View, Delete)
- ✅ Small Works Management
- ✅ Operatives Management
- ✅ Managers Management
- ✅ Scheduling/Calendar with conflict detection
- ✅ Clients Management
- ✅ Materials Management
- ✅ Tasks Management
- ✅ Warnings System
- ✅ Notifications
- ✅ User Management (Admin)
- ✅ Settings
- ✅ Permission-based access control

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Backend:** Firebase (Auth, Firestore)
- **State Management:** Zustand
- **Forms:** React Hook Form
- **Calendar:** React Big Calendar

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Firebase project set up
- Git installed

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   - Copy `.env.local.example` to `.env.local`
   - Fill in your Firebase configuration values

3. **Run development server:**
   ```bash
   npm run dev
   ```

4. **Open browser:**
   - Navigate to `http://localhost:3000`

## Deployment

See `DEPLOYMENT_GUIDE.md` for step-by-step deployment instructions.

## Data clean-up (owner only)

`scripts/data-cleanup.mjs` tidies old records that early app versions left behind. It is safe to look with: **it only
reads unless you add `--apply`.** Every change it makes is small (one field at a time), backed up first, and can be
undone.

### Before you start (once)

1. Open a terminal in this folder (`project-planner-web`).
2. Install the Firebase tools the script uses: `cd functions && npm ci && cd ..`
3. Sign in to Google with the owner account: `gcloud auth application-default login`
   (a browser window opens; pick the account that owns the Firebase project).
4. Find your Firebase project id: Firebase console → ⚙ Project settings → "Project ID". Below it is written
   `YOUR_PROJECT_ID` — type your own id instead.

### Step 1 — look (dry run, writes nothing)

```bash
node scripts/data-cleanup.mjs --project YOUR_PROJECT_ID
```

It prints, for every company, what each check would change: how many documents and a few example paths. Lines that
start with `update` or `delete` would change; lines that start with `review` are for you to look at and are never
changed by the script. Nothing is written. Run it as often as you like.

Useful options:

- `--org COMPANY_ID` — one company only (the id is in the Firebase console under `organizations`).
- `--only CHECK` — one check only (names below; `--list` prints them).
- `--samples 20` — show more example paths per check (default 5).

### Step 2 — fix, one check at a time (recommended order)

Run each check on its own: first the dry run, read it, then the same command with `--apply`.

```bash
node scripts/data-cleanup.mjs --project YOUR_PROJECT_ID --only booking-status-spelling
node scripts/data-cleanup.mjs --project YOUR_PROJECT_ID --only booking-status-spelling --apply
```

| Order | Check | What it changes | Why |
| --- | --- | --- | --- |
| 1 | `booking-status-spelling` | A booking whose `status` is in an old spelling (`confirmed`, `canceled`, `pending` …) gets the spelling both apps write (`Confirmed`, `Cancelled`, `Tentative` …). Only `status`. Same fix as Data health → "Fix all", for every company at once. | Older iPhone builds cannot read the old spelling and hide the booking. |
| 2 | `currency-literal-key` | Deletes a stray top-level field literally named `settings.currencyCode` that older iPhone builds wrote, only when the company's other currency fields already say the same currency. | Tidy-up allowed by the rulebook (§4.2). The currency shown never changes. |
| 3 | `office-address-map` | Deletes the old nested `officeAddress` map, only when the normal address fields already hold the same address. Companies where the old map is still the only copy are listed: open Settings → Company details and press Save there instead. | Every Company details save already removes it (§4.1). |
| 4 | `payroll-history-seed` | For a company with saved working hours and no working-hours history yet, writes the history from the saved fields (the same thing the apps do on the next working-hours save) and counts the change. Pay is never recalculated. | Protects earlier working hours from being overwritten by an older iPhone build (§4.3). |
| 5 | `placeholder-docs` | Deletes the old `INITIAL-PLACEHOLDER` setup rows in projects, small works and operatives. No app shows them. Placeholder rows in bookings, clients and managers are only listed (remove a booking one from Data health). | Junk rows from early setup; they show up in exports. |
| 6 | `orphan-invites` | Nothing — report only. Lists invites whose email claim is gone but which still name a person. | For you to tidy in Manage Users if you want. |

Every `--apply` run:

- writes a backup of every document it changes or deletes **before** writing, in
  `cleanup-backups/<date-time>/<company>/` (keep this folder; it holds real company data, so never share or commit it);
- changes only the named fields and stamps `updatedBy: cleanup-script`, `updatedFrom: web` and the time;
- refuses a batch (up to 400 writes) if anyone changed one of its documents after the script read it — nothing in that batch is written and the script says "run the script again";
- changes nothing on a second run (run the dry run again afterwards: those checks should say "nothing to do").

### Undo (restore from the backup)

```bash
node scripts/data-cleanup.mjs --project YOUR_PROJECT_ID --restore cleanup-backups/<date-time>           # look first
node scripts/data-cleanup.mjs --project YOUR_PROJECT_ID --restore cleanup-backups/<date-time> --apply   # put back
```

This puts every backed-up document back exactly as it was before that run (a deleted placeholder comes back too). It
replaces the whole document, so any change made to that document after the clean-up is lost — restore soon, or restore
a single file: `--restore cleanup-backups/<date-time>/<company>/001-booking-status-spelling.json`.

## Project Structure

```
web-app/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Authentication routes
│   ├── (dashboard)/       # Protected dashboard routes
│   └── layout.tsx         # Root layout
├── components/             # React components
│   ├── ui/                # Basic UI components
│   ├── forms/             # Form components
│   └── calendar/          # Calendar components
├── lib/                    # Business logic
│   ├── firebase/          # Firebase configuration
│   └── stores/            # Zustand stores
├── types/                  # TypeScript types
└── hooks/                  # Custom React hooks
```

## License

Proprietary - All rights reserved




