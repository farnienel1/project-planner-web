// User profile / Edit user UI harness (docs/design/user-profile-ui/, PR w-ui-user-profile). Not run by CI.
// Builds the real UserProfileSummary / EditUserProfile with fixture stores and a fake Firestore that records writes,
// so the same edits can be saved on two trees and the writes compared field by field.
//   node build.mjs <repoRoot> <outDir>            (once for the old tree, once for the new)
//   node scenarios.mjs <outDir> <result.json>     (same edits, records store calls, writes, navigation, banners)
//   python3 compare.py <before.json> <after.json> (field-by-field; exits 1 on any difference)
//   node textdiff.mjs <beforeOut> <afterOut>      (visible text and every control per variant)
//   node overflow.mjs <outDir> <shotsDir>         (no overflow at 1440/1280/1024/820/390, light and dark; screenshots)
// Env: HARNESS_NODE_MODULES, HARNESS_PLAYWRIGHT, HARNESS_CHROME.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const here = path.dirname(new URL(import.meta.url).pathname)
const root = path.resolve(process.argv[2])
const out = path.resolve(process.argv[3])
const nm = path.resolve(process.env.HARNESS_NODE_MODULES || path.join(root, 'node_modules'))
const { build } = await import(path.join(nm, 'esbuild/lib/main.js'))
fs.mkdirSync(out, { recursive: true })

const exts = ['.tsx', '.ts', '.js', '.mjs', '.jsx', '.json', '.css']
function resolveFile(p) {
  if (fs.existsSync(p) && fs.statSync(p).isFile()) return p
  for (const e of exts) if (fs.existsSync(p + e)) return p + e
  for (const e of exts) if (fs.existsSync(path.join(p, 'index' + e))) return path.join(p, 'index' + e)
  return null
}

const plugin = {
  name: 'harness',
  setup(b) {
    b.onResolve({ filter: /^(firebase|@firebase)(\/|$)/ }, () => ({ path: path.join(here, 'firebase-stub.cjs') }))
    b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: path.join(here, 'stubs/next-navigation.js') }))
    b.onResolve({ filter: /^next\/link$/ }, () => ({ path: path.join(here, 'stubs/next-link.js') }))
    b.onResolve({ filter: /^next\/dynamic$/ }, () => ({ path: path.join(here, 'stubs/next-dynamic.js') }))
    b.onResolve({ filter: /^next\// }, () => ({ path: path.join(here, 'stubs/next-generic.js') }))
    b.onResolve({ filter: /^@\// }, (args) => {
      const p = resolveFile(path.join(root, args.path.slice(2)))
      if (!p) return { errors: [{ text: 'cannot resolve ' + args.path }] }
      return { path: p }
    })
  },
}

await build({
  entryPoints: [path.join(here, 'entry.tsx')],
  bundle: true,
  outdir: out,
  format: 'esm',
  platform: 'browser',
  jsx: 'automatic',
  nodePaths: [nm],
  sourcemap: false,
  logLevel: 'warning',
  plugins: [plugin],
  define: {
    'process.env.NODE_ENV': '"development"',
    'process.env.NEXT_PUBLIC_FIREBASE_API_KEY': '"harness-api-key-0000"',
    'process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID': '"demo"',
  },
  inject: [path.join(here, 'process-shim.js')],
  loader: { '.woff2': 'file', '.png': 'file', '.svg': 'file' },
})

if (!fs.existsSync(path.join(out, 'entry.css'))) fs.writeFileSync(path.join(out, 'entry.css'), '')
// Tailwind + globals + shell tokens, compiled against the same tree.
const tw = path.join(nm, '.bin/tailwindcss')
execFileSync(tw, ['-c', path.join(root, 'tailwind.config.js'), '-i', path.join(root, 'app/globals.css'), '-o', path.join(out, 'tw.css')], { cwd: root, stdio: 'inherit' })
fs.copyFileSync(path.join(root, 'app/brand-shell.css'), path.join(out, 'brand-shell.css'))
fs.writeFileSync(
  path.join(out, 'index.html'),
  `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="tw.css"><link rel="stylesheet" href="brand-shell.css"><link rel="stylesheet" href="entry.css">
<style>body{margin:0;font-family:Inter,system-ui,sans-serif;background:var(--bg)}</style></head>
<body><div id="root"></div><script type="module" src="entry.js"></script></body></html>`
)
console.log('built', out)
