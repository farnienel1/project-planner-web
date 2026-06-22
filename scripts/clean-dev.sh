#!/bin/sh
# Nuclear clean for corrupted Next.js dev cache (e.g. turbopack runtime missing).
set -e
cd "$(dirname "$0")/.."

echo "Stopping dev servers on ports 3000 and 3001..."
lsof -ti:3000 2>/dev/null | xargs kill -9 2>/dev/null || true
lsof -ti:3001 2>/dev/null | xargs kill -9 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true

echo "Removing .next and caches..."
rm -rf .next node_modules/.cache

echo "Done. Start with: npm run dev"
echo "If errors persist, try: npm run dev:webpack"
