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
