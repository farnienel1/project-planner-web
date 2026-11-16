#!/usr/bin/env node
// npm run test:owner-e2e — the owner console end-to-end suite against the emulators (spec §6.3.5).
//   1. builds the app with the emulator switch (skip with OWNER_E2E_SKIP_BUILD=1 to reuse .next);
//   2. starts the Firestore and Auth emulators (firebase emulators:exec) and, inside them, runs inside.mjs:
//      seed → next start → playwright test → stop.
// Needs Java 21 and the firebase CLI (FIREBASE_BIN, else `npx -y firebase-tools@15.34.2`). Never touches production.
import { spawnSync } from 'node:child_process'
import { e2eEnv } from './env.mjs'

const env = { ...process.env, ...e2eEnv() }
const run = (command, args) => {
  const result = spawnSync(command, args, { stdio: 'inherit', env, shell: false })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

if (process.env.OWNER_E2E_SKIP_BUILD !== '1') run('npx', ['next', 'build', '--webpack'])

const firebase = process.env.FIREBASE_BIN ? [process.env.FIREBASE_BIN] : ['npx', '-y', 'firebase-tools@15.34.2']
const [bin, ...pre] = firebase
run(bin, [...pre, 'emulators:exec', '--only', 'firestore,auth', '--project', env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, 'node scripts/owner-e2e/inside.mjs'])
