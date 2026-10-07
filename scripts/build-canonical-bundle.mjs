/**
 * Bundle lib/canonical for the iOS app.
 * The generated file is the executable copy iOS evaluates. Do not edit it by hand.
 *
 * `node scripts/build-canonical-bundle.mjs` writes the packed file.
 * `node scripts/build-canonical-bundle.mjs --check` refuses to succeed when a packed file is stale.
 */
import { build } from 'esbuild'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(webRoot, 'lib/canonical/dist')
const outFile = path.join(outDir, 'canonical-business.js')
const hashFile = path.join(outDir, 'canonical-business.sha256')
const iosRepo = path.resolve(webRoot, '../project-planner-ios')
const iosOut = path.join(iosRepo, 'Project Planner/Canonical/canonical-business.js')
const iosHashFile = `${iosOut}.sha256`
const checkOnly = process.argv.includes('--check')
const iosCheckout = existsSync(path.join(iosRepo, '.git'))
const scratch = path.join(tmpdir(), `canonical-business-${process.pid}.js`)

mkdirSync(outDir, { recursive: true })

await build({
  absWorkingDir: webRoot,
  entryPoints: ['lib/canonical/bundleEntry.ts'],
  bundle: true,
  format: 'iife',
  globalName: 'ProjectPlannerCanonical',
  platform: 'neutral',
  target: 'es2020',
  outfile: scratch,
  legalComments: 'none',
})

const source = readFileSync(scratch)
const hash = createHash('sha256').update(source).digest('hex')
const hashText = `${hash}\n`

function sameFile(file, expected) {
  if (!existsSync(file)) return false
  return readFileSync(file).equals(expected)
}

if (checkOnly) {
  rmSync(scratch, { force: true })
  const stale = []
  if (!sameFile(outFile, source) || !sameFile(hashFile, Buffer.from(hashText))) {
    stale.push(outFile)
  }
  if (iosCheckout && (!sameFile(iosOut, source) || !sameFile(iosHashFile, Buffer.from(hashText)))) {
    stale.push(iosOut)
  }
  if (stale.length > 0) {
    console.error('The packed rulebook does not match lib/canonical.')
    for (const file of stale) console.error(`  stale: ${file}`)
    console.error('Run npm run build:canonical and commit the packed file in the web repo and, when the iOS repo is checked out beside it, in the iOS repo.')
    process.exit(1)
  }
  console.log(`canonical bundle matches ${hash}`)
  process.exit(0)
}

writeFileSync(outFile, source)
writeFileSync(hashFile, hashText)
rmSync(scratch, { force: true })

if (iosCheckout) {
  mkdirSync(path.dirname(iosOut), { recursive: true })
  writeFileSync(iosOut, source)
  writeFileSync(iosHashFile, hashText)
  console.log(`canonical bundle ${hash}`)
} else {
  console.log(`canonical bundle ${hash}`)
  console.log('No iOS checkout at ../project-planner-ios, so the iPhone copy was not updated.')
}
