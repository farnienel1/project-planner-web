#!/usr/bin/env node
/**
 * Rulebook 1.59.0 (§16, review of #370 L2; docs/RULEBOOK.md "Deploy notes" 1.59.0): one-off backfill of
 * `organizations/{orgId}/materialContacts/{email}` from the stored material send records.
 *
 * From 1.59.0 the first quote or order email the organisation sends to an address carries the red safe-sender box. "First"
 * is read from one `materialContacts` document per address, which the web send route and the email function create after
 * each send. Addresses emailed before 1.59.0 have none, so without this script their next email would carry the box once
 * more. The addresses are the rulebook's own `materialSendRecordRecipientEmails` and the document ids its
 * `materialContactKey`, read from the packed script.
 *
 *   node scripts/backfill-material-contacts.mjs --project <firebaseProjectId> --org <orgId>      # dry run (default)
 *   node scripts/backfill-material-contacts.mjs --project <firebaseProjectId> --all              # dry run, every org
 *   node scripts/backfill-material-contacts.mjs --project <firebaseProjectId> --all --apply      # write
 *
 * - Credentials: Application Default Credentials (`gcloud auth application-default login`) or
 *   GOOGLE_APPLICATION_CREDENTIALS. FIRESTORE_EMULATOR_HOST runs it against the emulator.
 * - `firebase-admin` is resolved from this repo, else from `functions/node_modules` (`cd functions && npm ci`).
 * - Creates only missing documents, each `{ firstSentAt }` (the server time); a document already there is never changed.
 *   Idempotent: a second run reports 0 to create.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

function arg(flag) {
  const index = process.argv.indexOf(flag)
  if (index < 0) return null
  const value = process.argv[index + 1]
  // Review of #370 (N4): a flag with no value, or followed by another flag, is refused (never read as "--all").
  if (!value || value.startsWith('--')) {
    console.error(`${flag} needs a value.`)
    process.exit(2)
  }
  return value
}

const projectId = arg('--project')
const onlyOrg = arg('--org')
const all = process.argv.includes('--all')
const apply = process.argv.includes('--apply')

if (!projectId || (!onlyOrg && !all) || (onlyOrg && all)) {
  console.error('Usage: node scripts/backfill-material-contacts.mjs --project <firebaseProjectId> (--org <id> | --all) [--dry-run | --apply]')
  process.exit(2)
}

function loadAdmin() {
  for (const base of [path.join(root, 'package.json'), path.join(root, 'functions', 'package.json')]) {
    try {
      const require = createRequire(base)
      return { app: require('firebase-admin/app'), firestore: require('firebase-admin/firestore') }
    } catch {
      /* try the next location */
    }
  }
  console.error('firebase-admin is not installed. Run `cd functions && npm ci` (or `npm i --no-save firebase-admin`).')
  process.exit(2)
}

function loadRulebook() {
  const source = readFileSync(path.join(root, 'lib/canonical/dist/canonical-business.js'), 'utf8')
  const context = vm.createContext({})
  vm.runInContext(source, context)
  const rulebook = context.ProjectPlannerCanonical
  if (!rulebook || typeof rulebook.materialContactKey !== 'function' || typeof rulebook.materialSendRecordRecipientEmails !== 'function') {
    console.error('The packed rulebook has no materialContactKey (1.59.0). Run `npm run build:canonical` first.')
    process.exit(2)
  }
  return rulebook
}

const rulebook = loadRulebook()
const { app, firestore } = loadAdmin()
app.initializeApp({ projectId })
const db = firestore.getFirestore()

async function backfillOrg(orgId) {
  const orgRef = db.collection('organizations').doc(orgId)
  const records = await orgRef.collection('materialSendRecords').get()
  const emails = rulebook.materialSendRecordRecipientEmails(records.docs.map((doc) => doc.data() || {}))
  const keys = [...new Set(emails.map((email) => rulebook.materialContactKey(email)).filter(Boolean))]
  const contacts = orgRef.collection(rulebook.MATERIAL_CONTACTS_COLLECTION)
  let created = 0
  for (const key of keys) {
    const ref = contacts.doc(key)
    if ((await ref.get()).exists) continue
    created += 1
    console.log(`  ${apply ? 'create' : 'would create'} materialContacts/${key}`)
    if (apply) {
      await ref.create({ firstSentAt: firestore.FieldValue.serverTimestamp() }).catch((error) => {
        if (!(error && (error.code === 6 || /ALREADY_EXISTS/.test(String(error.message))))) throw error
      })
    }
  }
  console.log(`org ${orgId}: ${records.size} send records, ${keys.length} addresses, ${created} ${apply ? 'created' : 'to create'}`)
  return created
}

const orgIds = onlyOrg ? [onlyOrg] : (await db.collection('organizations').get()).docs.map((doc) => doc.id)
console.log(`${apply ? 'APPLY' : 'DRY RUN'} — project ${projectId}, ${orgIds.length} organisation(s)`)
let total = 0
for (const orgId of orgIds) total += await backfillOrg(orgId)
console.log(`Summary: ${total} ${apply ? 'created' : 'to create'}.${apply ? '' : ' Nothing was written (dry run; pass --apply).'}`)
