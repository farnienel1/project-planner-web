#!/usr/bin/env node
/**
 * Helper for .github/workflows/firebase-rules-deploy.yml (docs/firebase-rules-deploy.md).
 *
 *   node scripts/firebase-rules-deploy.mjs plan       reads TARGETS, writes only / firestore / storage / indexes to $GITHUB_OUTPUT
 *   node scripts/firebase-rules-deploy.mjs ci-check   fails unless CI (REQUIRED_CI_JOBS, push-to-main runs) passed on GITHUB_SHA
 *   node scripts/firebase-rules-deploy.mjs check-key  checks the key file without ever printing its contents
 *   node scripts/firebase-rules-deploy.mjs verify     reads the live releases and compares them with the files in the checkout
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

/**
 * Reads the service-account key file. Any failure gives one fixed message: a JSON parse error's text can quote the
 * file around the error (the private key), so it never reaches the log.
 */
export function readServiceAccountKey(keyPath, projectId) {
  let key
  try {
    key = JSON.parse(readFileSync(keyPath, 'utf8'))
  } catch {
    throw new Error('The service-account key is not valid JSON (contents not shown).')
  }
  if (!key || key.type !== 'service_account' || typeof key.client_email !== 'string' || typeof key.private_key !== 'string'
    || (projectId && key.project_id !== projectId)) {
    throw new Error(`The service-account key is not a service-account key of ${projectId || 'this project'} (contents not shown).`)
  }
  return key
}

/**
 * The CI jobs a publish needs, each tied to the workflow FILE that runs it on a push to main. Matching by file (not by a
 * check-run name) means a job of the same name in another workflow, or a run from another event (the daily scheduled
 * rulebook run, where rulebook-check is skipped; a manual dispatch), never counts.
 */
export const REQUIRED_CI_JOBS = Object.freeze([
  Object.freeze({ workflowPath: '.github/workflows/web-ci.yml', job: 'build-and-test' }),
  Object.freeze({ workflowPath: '.github/workflows/web-ci.yml', job: 'rules-typecheck' }),
  Object.freeze({ workflowPath: '.github/workflows/rulebook.yml', job: 'rulebook-check' }),
])

const workflowFile = (path) => String(path ?? '').split('@')[0]

/**
 * The latest push-to-main workflow run of each required workflow file for `sha` (GET /actions/runs), from `runs`.
 * Runs from any other event, branch or commit are ignored.
 */
export function latestPushRuns(runs, { sha, required = REQUIRED_CI_JOBS } = {}) {
  const paths = new Set(required.map((r) => r.workflowPath))
  const latest = new Map()
  for (const run of runs ?? []) {
    if (run?.event !== 'push' || run?.head_branch !== 'main' || (sha && run?.head_sha !== sha)) continue
    const path = workflowFile(run.path)
    if (!paths.has(path)) continue
    const at = Date.parse(run.created_at ?? '') || 0
    const seen = latest.get(path)
    if (!seen || at > seen.at || (at === seen.at && Number(run.id) > Number(seen.run.id))) latest.set(path, { at, run })
  }
  return new Map([...latest].map(([path, { run }]) => [path, run]))
}

/**
 * The required jobs that have not succeeded, as "workflow-file: job". `runsByPath` is latestPushRuns; `jobsByRunId`
 * maps a run id to its jobs (GET /actions/runs/{id}/jobs, latest attempt). A missing run, a run not completed, a missing
 * job, or any conclusion other than success blocks.
 */
export function missingCiJobs(runsByPath, jobsByRunId, required = REQUIRED_CI_JOBS) {
  return required
    .filter(({ workflowPath, job }) => {
      const run = runsByPath.get(workflowPath)
      if (!run || run.status !== 'completed') return true
      const jobs = jobsByRunId.get(run.id) ?? []
      const found = jobs.find((j) => j?.name === job)
      return !found || found.status !== 'completed' || found.conclusion !== 'success'
    })
    .map(({ workflowPath, job }) => `${workflowPath.replace('.github/workflows/', '')}: ${job}`)
}

async function githubJson(url, token) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
  })
  if (!response.ok) throw new Error(`Could not read ${url.replace(/\?.*$/, '')} (HTTP ${response.status})`)
  return response.json()
}

async function ciCheck() {
  const { GITHUB_TOKEN: token, GITHUB_REPOSITORY: repo, GITHUB_SHA: sha } = process.env
  if (!token || !repo || !sha) throw new Error('GITHUB_TOKEN, GITHUB_REPOSITORY and GITHUB_SHA are required')
  const api = `https://api.github.com/repos/${repo}/actions`
  const runs = []
  for (let page = 1; page <= 10; page += 1) {
    const body = await githubJson(`${api}/runs?head_sha=${sha}&event=push&branch=main&per_page=100&page=${page}`, token)
    const batch = body.workflow_runs ?? []
    runs.push(...batch)
    if (batch.length < 100) break
  }
  const runsByPath = latestPushRuns(runs, { sha })
  const jobsByRunId = new Map()
  for (const run of runsByPath.values()) {
    const body = await githubJson(`${api}/runs/${run.id}/jobs?filter=latest&per_page=100`, token)
    jobsByRunId.set(run.id, body.jobs ?? [])
  }
  const missing = missingCiJobs(runsByPath, jobsByRunId)
  if (missing.length) {
    throw new Error(`CI has not passed on ${sha} (push to main): ${missing.join(', ')}. Wait for CI on main, or fix it first.`)
  }
  console.log(`CI passed on ${sha} (push to main): ${REQUIRED_CI_JOBS.map((r) => r.job).join(', ')}`)
}

async function accessToken(keyPath, projectId) {
  const key = readServiceAccountKey(keyPath, projectId)
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
  const token = await accessToken(keyPath, projectId)
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
  if (command === 'ci-check') return ciCheck()
  if (command === 'check-key') {
    readServiceAccountKey(process.env.GOOGLE_APPLICATION_CREDENTIALS, process.env.PROJECT_ID)
    console.log('Service-account key file is valid.')
    return
  }
  throw new Error('Usage: firebase-rules-deploy.mjs plan|ci-check|check-key|verify')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv[2]).catch((error) => {
    console.error(`::error::${error.message}`)
    process.exit(1)
  })
}
