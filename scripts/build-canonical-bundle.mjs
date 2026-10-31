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
import { createContext, runInContext } from 'node:vm'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(webRoot, 'lib/canonical/dist')
const outFile = path.join(outDir, 'canonical-business.js')
const hashFile = path.join(outDir, 'canonical-business.sha256')
const functionsOut = path.join(webRoot, 'functions/canonical-business.js')
const iosRepo = path.resolve(webRoot, '../project-planner-ios')
const iosOut = path.join(iosRepo, 'Project Planner/Canonical/canonical-business.js')
const iosHashFile = `${iosOut}.sha256`
// Shared parity cases both apps must pass (lib/canonical/canonical.test.ts on web, ProjectPlannerTests on iOS).
const fixtureFile = path.join(webRoot, 'lib/canonical/parity-fixture.json')
const iosFixture = path.join(iosRepo, 'ProjectPlannerTests/CanonicalParityFixture.json')
// The one rulebook. Its version and sha256 are stamped into the packed script, and it is mirrored to iOS.
const rulebookFile = path.join(webRoot, 'docs/RULEBOOK.md')
const manifestFile = path.join(outDir, 'canonical-manifest.json')
const distRulebook = path.join(outDir, 'RULEBOOK.md')
const iosManifest = path.join(iosRepo, 'Project Planner/Canonical/canonical-manifest.json')
const iosRulebook = path.join(iosRepo, 'docs/RULEBOOK.md')
const checkOnly = process.argv.includes('--check')
const iosCheckout = existsSync(path.join(iosRepo, '.git'))
const scratch = path.join(tmpdir(), `canonical-business-${process.pid}.js`)

mkdirSync(outDir, { recursive: true })

if (!existsSync(rulebookFile)) {
  console.error('docs/RULEBOOK.md is missing. The packed script carries its version.')
  process.exit(1)
}
const rulebookText = readFileSync(rulebookFile)
const rulebookVersion = /^Version:\s*(\S+)\s*$/m.exec(rulebookText.toString('utf8'))?.[1]
if (!rulebookVersion) {
  console.error('docs/RULEBOOK.md has no "Version: x.y.z" line.')
  process.exit(1)
}
const rulebookSha256 = createHash('sha256').update(rulebookText).digest('hex')

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
  define: {
    __RULEBOOK_VERSION__: JSON.stringify(rulebookVersion),
    __RULEBOOK_SHA256__: JSON.stringify(rulebookSha256),
  },
})

const source = readFileSync(scratch)
const hash = createHash('sha256').update(source).digest('hex')
const hashText = `${hash}\n`

function exportNames(code) {
  const sandbox = {}
  createContext(sandbox)
  runInContext(`${code}\nthis.__names = Object.keys(ProjectPlannerCanonical).sort()`, sandbox)
  return sandbox.__names
}
const manifestText = `${JSON.stringify(
  { rulebookVersion, rulebookSha256, bundleSha256: hash, exports: exportNames(source.toString('utf8')) },
  null,
  2
)}\n`
const manifestBuffer = Buffer.from(manifestText)

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
  if (!sameFile(functionsOut, source)) {
    stale.push(functionsOut)
  }
  if (!sameFile(manifestFile, manifestBuffer)) stale.push(manifestFile)
  if (!sameFile(distRulebook, rulebookText)) stale.push(distRulebook)
  if (iosCheckout && (!sameFile(iosManifest, manifestBuffer) || !sameFile(iosRulebook, rulebookText))) {
    stale.push(iosRulebook)
  }
  if (iosCheckout && (!sameFile(iosOut, source) || !sameFile(iosHashFile, Buffer.from(hashText)))) {
    stale.push(iosOut)
  }
  if (iosCheckout && !sameFile(iosFixture, readFileSync(fixtureFile))) {
    stale.push(iosFixture)
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
writeFileSync(manifestFile, manifestBuffer)
writeFileSync(distRulebook, rulebookText)
mkdirSync(path.dirname(functionsOut), { recursive: true })
writeFileSync(functionsOut, source)
rmSync(scratch, { force: true })

if (iosCheckout) {
  mkdirSync(path.dirname(iosOut), { recursive: true })
  writeFileSync(iosOut, source)
  writeFileSync(iosHashFile, hashText)
  mkdirSync(path.dirname(iosFixture), { recursive: true })
  writeFileSync(iosFixture, readFileSync(fixtureFile))
  writeFileSync(iosManifest, manifestBuffer)
  mkdirSync(path.dirname(iosRulebook), { recursive: true })
  writeFileSync(iosRulebook, rulebookText)
  console.log(`canonical bundle ${hash} · rulebook ${rulebookVersion}`)
} else {
  console.log(`canonical bundle ${hash}`)
  console.log('No iOS checkout at ../project-planner-ios, so the iPhone copy was not updated.')
}
