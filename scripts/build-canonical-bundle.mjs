/**
 * Bundle lib/canonical for the iOS app.
 * The generated file is the executable copy iOS evaluates. Do not edit it by hand.
 */
import { build } from 'esbuild'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(webRoot, 'lib/canonical/dist')
const outFile = path.join(outDir, 'canonical-business.js')
const iosOut = path.resolve(webRoot, '../project-planner-ios/Project Planner/Canonical/canonical-business.js')

mkdirSync(outDir, { recursive: true })

await build({
  absWorkingDir: webRoot,
  entryPoints: ['lib/canonical/bundleEntry.ts'],
  bundle: true,
  format: 'iife',
  globalName: 'ProjectPlannerCanonical',
  platform: 'neutral',
  target: 'es2020',
  outfile: outFile,
  legalComments: 'none',
})

const source = readFileSync(outFile)
const hash = createHash('sha256').update(source).digest('hex')
writeFileSync(path.join(outDir, 'canonical-business.sha256'), `${hash}\n`)
mkdirSync(path.dirname(iosOut), { recursive: true })
writeFileSync(iosOut, source)
writeFileSync(`${iosOut}.sha256`, `${hash}\n`)
console.log(`canonical bundle ${hash}`)
