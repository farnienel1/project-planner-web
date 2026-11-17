import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scan, violations } from './check-api-body-spread.mjs'

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), 'api-body-spread-'))
  for (const [path, text] of Object.entries(files)) {
    const full = join(root, path)
    mkdirSync(join(full, '..'), { recursive: true })
    writeFileSync(full, text)
  }
  return root
}

test('a raw request.json() and a spread request body in an API route fail; fields read one by one pass', () => {
  const root = fixture({
    'app/api/a/route.ts': [
      'const raw = await request.json()',
      'await setDoc(ref, { ...body.value, updatedAt })',
      'await setDoc(ref, { ...body })',
      'const fields = { ...parsed.value }',
      'const name = body.value.name',
      '// a comment: ...body and request.json() are fine here',
    ].join('\n'),
    'app/api/a/route.test.ts': 'await request.json()',
    'components/B.tsx': 'const x = { ...body }',
  })
  const hits = scan(root)
  assert.ok(hits.every((hit) => hit.path === 'app/api/a/route.ts'))
  assert.deepEqual(
    hits.map((hit) => [hit.line, hit.pattern]),
    [
      [1, 'raw-request-json'],
      [2, 'body-spread'],
      [3, 'body-spread'],
      [4, 'body-spread'],
    ]
  )
  assert.equal(violations(hits).length, 4)
  assert.equal(violations(hits, [{ path: 'app/api/a/route.ts', pattern: 'raw-request-json', reason: 'x' }]).length, 3)
})

test('review of #391: any request name, readJsonBody, and spreads of any body-derived name fail', () => {
  const root = fixture({
    'app/api/b/route.ts': [
      'export async function POST(incoming: NextRequest) {',
      '  const raw = await incoming.json()',
      '  const legacy = await readJsonBody<{ a?: string }>(incoming)',
      '  const read = await readApiBody(incoming, schema)',
      '  const data = read.value',
      '  const { items, extra: renamed } = data',
      '  await setDoc(ref, { ...data })',
      '  await setDoc(ref, { ...items[0] })',
      '  await setDoc(ref, { ...renamed, x: 1 })',
      '  const flags = { ...(data.flag ? { on: true } : {}) }',
      '  const upstream = await fetch(url)',
      '  const answer = await upstream.json()',
      '  return NextResponse.json({ ok: true, ...safe })',
      '}',
    ].join('\n'),
  })
  assert.deepEqual(
    scan(root).map((hit) => [hit.line, hit.pattern]),
    [
      [2, 'raw-request-json'],
      [3, 'read-json-body'],
      [7, 'body-spread'],
      [8, 'body-spread'],
      [9, 'body-spread'],
    ]
  )
})

test('the repository passes', () => {
  const root = join(import.meta.dirname, '..')
  assert.deepEqual(violations(scan(root)), [])
})
