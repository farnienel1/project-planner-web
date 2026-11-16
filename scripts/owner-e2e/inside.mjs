// Runs inside `firebase emulators:exec` (FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST are set by it).
import { spawn, spawnSync } from 'node:child_process'
import { E2E_PORT, e2eEnv } from './env.mjs'

const env = { ...process.env, ...e2eEnv() }
if (!env.FIRESTORE_EMULATOR_HOST || !env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error('owner e2e: run this through scripts/owner-e2e/run.mjs (the emulators are not running).')
  process.exit(2)
}

const seed = spawnSync('npx', ['tsx', 'scripts/owner-console-seed/seed.mjs'], { stdio: 'inherit', env })
if (seed.status !== 0) process.exit(seed.status ?? 1)

const server = spawn('npx', ['next', 'start', '-p', String(E2E_PORT)], { stdio: ['ignore', 'inherit', 'inherit'], env, detached: true })
const stop = () => {
  try {
    process.kill(-server.pid, 'SIGTERM')
  } catch {
    /* already stopped */
  }
}
process.on('exit', stop)

const deadline = Date.now() + 120_000
let ready = false
while (Date.now() < deadline) {
  try {
    const response = await fetch(`http://localhost:${E2E_PORT}/developer-login`)
    if (response.status < 500) {
      ready = true
      break
    }
  } catch {
    /* not up yet */
  }
  await new Promise((resolve) => setTimeout(resolve, 1000))
}
if (!ready) {
  console.error('owner e2e: the app did not start within 2 minutes.')
  stop()
  process.exit(1)
}

const args = ['playwright', 'test', '--config', 'playwright.config.ts', ...process.argv.slice(2)]
const tests = spawnSync('npx', args, { stdio: 'inherit', env })
stop()
process.exit(tests.status ?? 1)
