#!/usr/bin/env node
/**
 * Helper for .github/workflows/firebase-rules-deploy.yml (docs/firebase-rules-deploy.md).
 *
 *   node scripts/firebase-rules-deploy.mjs plan     reads TARGETS, writes only / firestore / storage / indexes to $GITHUB_OUTPUT
 *   node scripts/firebase-rules-deploy.mjs verify   reads the live releases and compares them with the files in the checkout
 *
 * Every input comes from the environment, never from the command line, so a workflow input is never interpolated into
 * a shell line. `verify` needs no dependency: it signs a service-account JWT with node:crypto and exchanges it at
 * oauth2.googleapis.com for a one-hour access token (the same key firebase-tools deployed with; no extra IAM role).
 * Neither the key nor the token is ever printed.
 */
import { createHash, createSign } from 'node:crypto'
import { appendFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')

/** The only targets the button deploys. Functions, hosting and data are never on this list. */
export const TARGET_PLANS = Object.freeze({
  'firestore-rules': { only: 'firestore:rules', firestore: true, storage: false, indexes: false },
  'storage-rules': { only: 'storage', firestore: false, storage: true, indexes: false },
  indexes: { only: 'firestore:indexes', firestore: false, storage: false, indexes: true },
  'firestore-rules+storage-rules': { only: 'firestore:rules,storage', firestore: true, storage: true, indexes: false },
  'all-rules': { only: 'firestore:rules,firestore:indexes,storage', firestore: true, storage: true, indexes: true },
})

/** The deploy plan for one `targets` input, or throws for anything not on the list (exact match, no trimming). */
export function planTargets(target) {
  if (typeof target !== 'string' || !Object.hasOwn(TARGET_PLANS, target)) {
    throw new Error(`Unknown target. Choose one of: ${Object.keys(TARGET_PLANS).join(', ')}`)
  }
  return TARGET_PLANS[target]
}

export const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex')

/**
 * Compares a live ruleset (GET firebaserules …/rulesets/{id}) with the local file. The live ruleset must hold exactly
 * one file, and its content must equal the local file byte for byte.
 */
export function compareRuleset({ ruleset, localContent, projectId }) {
  const files = ruleset?.source?.files
  if (typeof ruleset?.name !== 'string' || !ruleset.name.startsWith(`projects/${projectId}/rulesets/`)) {
    return { ok: false, reason: 'the live ruleset does not belong to this project' }
  }
  if (!Array.isArray(files) || files.length !== 1 || typeof files[0]?.content !== 'string') {
    return { ok: false, reason: `the live ruleset has ${Array.isArray(files) ? files.length : 0} source files, expected 1` }
  }
  const liveSha = sha256(files[0].content)
  const localSha = sha256(localContent)
  return liveSha === localSha
    ? { ok: true, liveSha, localSha }
    : { ok: false, reason: 'the live rules differ from the file on main', liveSha, localSha }
}

function writeOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) throw new Error('GITHUB_OUTPUT is not set')
  appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`)
}

function summary(line) {
  console.log(line)
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${line}\n`)
}

const base64url = (input) => Buffer.from(input).toString('base64url')

async function accessToken(keyPath) {
  const key = JSON.parse(readFileSync(keyPath, 'utf8'))
  if (key.type !== 'service_account' || !key.client_email || !key.private_key) {
    throw new Error('The key file is not a service-account key')
  }
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = base64url(JSON.stringify({
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/firebase https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 600,
  }))
  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${claims}`)
  const assertion = `${header}.${claims}.${signer.sign(key.private_key).toString('base64url')}`
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok || typeof body.access_token !== 'string') {
    // Only Google's error code, never the response body (it never holds the key, but keep the log minimal).
    throw new Error(`Could not get an access token (HTTP ${response.status} ${body.error ?? ''})`)
  }
  return body.access_token
}

async function getJson(url, token) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`GET ${url} → HTTP ${response.status} ${body?.error?.status ?? ''}`)
  return body
}

async function verifyRelease({ label, releaseId, file, projectId, token }) {
  const api = 'https://firebaserules.googleapis.com/v1'
  const release = await getJson(`${api}/projects/${projectId}/releases/${releaseId}`, token)
  if (typeof release.rulesetName !== 'string' || !release.rulesetName.startsWith(`projects/${projectId}/rulesets/`)) {
    throw new Error(`${label}: the release names no ruleset of ${projectId}`)
  }
  const ruleset = await getJson(`${api}/${release.rulesetName}`, token)
  const result = compareRuleset({ ruleset, localContent: readFileSync(join(ROOT, file), 'utf8'), projectId })
  summary(`| ${label} | \`releases/${releaseId}\` | \`${release.rulesetName.split('/').pop()}\` | ${release.updateTime ?? '?'} | ${result.ok ? '✓ matches' : `✗ ${result.reason}`} \`${(result.localSha ?? '').slice(0, 12)}\` |`)
  return result.ok
}

async function verify() {
  const projectId = process.env.PROJECT_ID
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  const checkFirestore = process.env.VERIFY_FIRESTORE === 'true'
  const checkStorage = process.env.VERIFY_STORAGE === 'true'
  const bucket = process.env.STORAGE_BUCKET
  if (!projectId || !keyPath) throw new Error('PROJECT_ID and GOOGLE_APPLICATION_CREDENTIALS are required')
  if (checkStorage && !bucket) throw new Error('STORAGE_BUCKET is required to verify the storage rules')
  if (!checkFirestore && !checkStorage) {
    summary('No rules file was deployed (indexes only): nothing to compare. firebase-tools reported the index deploy above.')
    return
  }
  const token = await accessToken(keyPath)
  summary('### Live rules after the deploy\n')
  summary('| Rules | Release | Live ruleset | Release updateTime | Compared with the checkout (sha256) |')
  summary('|---|---|---|---|---|')
  let ok = true
  if (checkFirestore) ok = (await verifyRelease({ label: 'Firestore', releaseId: 'cloud.firestore', file: 'firestore.rules', projectId, token })) && ok
  if (checkStorage) ok = (await verifyRelease({ label: 'Storage', releaseId: `firebase.storage/${bucket}`, file: 'storage.rules', projectId, token })) && ok
  if (!ok) throw new Error('The live rules do not match the files on main (see the table above).')
}

async function main(command) {
  if (command === 'plan') {
    const plan = planTargets(process.env.TARGETS)
    for (const [name, value] of Object.entries(plan)) writeOutput(name, String(value))
    console.log(`Deploy plan: --only ${plan.only}`)
    return
  }
  if (command === 'verify') return verify()
  throw new Error('Usage: firebase-rules-deploy.mjs plan|verify')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv[2]).catch((error) => {
    console.error(`::error::${error.message}`)
    process.exit(1)
  })
}
