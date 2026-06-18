#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env.local"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE"
  echo "Copy .env.example and fill in your values first."
  exit 1
fi

cd "$ROOT"

if ! command -v netlify >/dev/null 2>&1; then
  echo "Using npx netlify-cli..."
  NTL="npx netlify-cli"
else
  NTL="netlify"
fi

echo "Importing environment variables from .env.local into Netlify..."
$NTL env:import "$ENV_FILE"
echo "Done. Trigger a redeploy in Netlify (Deploys → Clear cache and deploy site)."
