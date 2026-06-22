#!/usr/bin/env node
/**
 * Run from project root: node scripts/verify-env.mjs
 * Checks that .env.local exists and Firebase vars look valid.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = resolve(root, '.env.local')
const rtfPath = resolve(root, '.env.local.rtf')

function mask(value) {
  if (!value) return '(missing)'
  if (value.length <= 8) return '***'
  return `${value.slice(0, 6)}…${value.slice(-4)}`
}

console.log('Project folder:', root)
console.log('')

if (existsSync(rtfPath)) {
  console.log('❌ Found .env.local.rtf — Next.js ignores this file.')
  console.log('   Run: rm .env.local.rtf')
  console.log('')
}

if (!existsSync(envPath)) {
  console.log('❌ .env.local not found')
  console.log('   Create it in this folder (see QUICK_START.md)')
  process.exit(1)
}

console.log('✅ .env.local exists')

const raw = readFileSync(envPath, 'utf8')
if (raw.includes('{\\rtf')) {
  console.log('❌ .env.local looks like Rich Text (RTF). Recreate as plain text.')
  process.exit(1)
}

const vars = {}
for (const line of raw.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eq = trimmed.indexOf('=')
  if (eq === -1) continue
  const key = trimmed.slice(0, eq).trim()
  const value = trimmed.slice(eq + 1).trim()
  vars[key] = value
}

const required = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
]

const stripeOptional = ['STRIPE_SECRET_KEY', 'STRIPE_PRICE_ID']

let ok = true
for (const key of required) {
  const value = vars[key]
  const valid = Boolean(value && value !== 'undefined' && !value.includes('PASTE_'))
  console.log(`${valid ? '✅' : '❌'} ${key} = ${mask(value)}`)
  if (!valid) ok = false
}

for (const key of stripeOptional) {
  const value = vars[key]
  const valid = Boolean(value && value.trim())
  console.log(`${valid ? '✅' : '⚠️ '} ${key} = ${mask(value)}${valid ? '' : ' (needed for live Stripe prices)'}`)
}

console.log('')
if (!ok) {
  console.log('Fix the ❌ lines above, then:')
  console.log('  1. Stop the dev server (Ctrl+C)')
  console.log('  2. rm -rf .next')
  console.log('  3. npm run dev')
  process.exit(1)
}

console.log('Firebase env looks OK. If auth still fails:')
console.log('  • Stop dev server, run: rm -rf .next && npm run dev')
console.log('  • Confirm Email/Password sign-in is enabled in Firebase Console')
