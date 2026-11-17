import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PDF_OBJECT_URL_RELEASE_MS, canSharePdf, downloadPdf, pdfBlob, sharePdf, type PdfFileEnv } from './downloadPdf.ts'

const BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]) // %PDF-

function fakeEnv(navigator: PdfFileEnv['navigator'] = {}) {
  const log: string[] = []
  const blobs: Blob[] = []
  const links: { href: string; download: string; clicked: boolean; attached: boolean }[] = []
  const timers: { fn: () => void; ms: number }[] = []
  const env: PdfFileEnv = {
    navigator,
    URL: {
      createObjectURL: (blob: Blob) => {
        blobs.push(blob)
        log.push('create')
        return `blob:fake/${blobs.length}`
      },
      revokeObjectURL: (url: string) => log.push(`revoke ${url}`),
    } as unknown as PdfFileEnv['URL'],
    document: {
      body: {
        appendChild: (node: unknown) => {
          ;(node as { attached: boolean }).attached = true
          return node
        },
      },
      createElement: () => {
        const link = {
          href: '',
          download: '',
          clicked: false,
          attached: false,
          click() {
            this.clicked = true
            log.push(`click ${this.download}`)
          },
          remove() {
            this.attached = false
          },
        }
        links.push(link)
        return link
      },
    } as unknown as PdfFileEnv['document'],
    setTimeout: (fn, ms) => timers.push({ fn, ms }),
  }
  return { env, log, blobs, links, timers }
}

test('downloadPdf saves the same bytes under the given name, then releases the object URL', async () => {
  const { env, log, blobs, links, timers } = fakeEnv()
  downloadPdf(BYTES, 'Invoice - Sam.pdf', env)

  assert.equal(links.length, 1)
  assert.equal(links[0].download, 'Invoice - Sam.pdf')
  assert.equal(links[0].href, 'blob:fake/1')
  assert.equal(links[0].clicked, true)
  assert.equal(links[0].attached, false, 'the link is removed after the click')
  assert.equal(blobs[0].type, 'application/pdf')
  assert.deepEqual(new Uint8Array(await blobs[0].arrayBuffer()), BYTES)
  // Not released before the click, released afterwards.
  assert.deepEqual(log, ['create', 'click Invoice - Sam.pdf'])
  assert.equal(timers.length, 1)
  assert.equal(timers[0].ms, PDF_OBJECT_URL_RELEASE_MS)
  timers[0].fn()
  assert.deepEqual(log.at(-1), 'revoke blob:fake/1')
})

test('pdfBlob copies the bytes (a later change to the source does not alter the file)', async () => {
  const source = new Uint8Array(BYTES)
  const blob = pdfBlob(source)
  source[0] = 0
  assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), BYTES)
})

test('canSharePdf: only when navigator.share and navigator.canShare({ files }) both say yes', () => {
  assert.equal(canSharePdf('a.pdf', { navigator: {} }), false)
  assert.equal(canSharePdf('a.pdf', { navigator: { share: async () => {} } }), false, 'no canShare: links-only browsers')
  assert.equal(canSharePdf('a.pdf', { navigator: { share: async () => {}, canShare: () => false } }), false)
  assert.equal(
    canSharePdf('a.pdf', {
      navigator: {
        share: async () => {},
        canShare: () => {
          throw new Error('boom')
        },
      },
    }),
    false
  )
  let seen: ShareData | null = null
  const ok = canSharePdf('a.pdf', {
    navigator: {
      share: async () => {},
      canShare: (data) => {
        seen = data
        return true
      },
    },
  })
  assert.equal(ok, true)
  const files = (seen as ShareData | null)?.files ?? []
  assert.equal(files.length, 1)
  assert.equal(files[0].type, 'application/pdf')
})

test('sharePdf shares the same file name and bytes when the browser can share', async () => {
  let shared: ShareData | null = null
  const { env, links } = fakeEnv({
    canShare: () => true,
    share: async (data) => {
      shared = data
    },
  })
  assert.equal(await sharePdf(BYTES, 'Invoice - Sam.pdf', env), 'shared')
  assert.equal(links.length, 0, 'no download')
  const file = ((shared as ShareData | null)?.files ?? [])[0]
  assert.equal(file.name, 'Invoice - Sam.pdf')
  assert.deepEqual(new Uint8Array(await file.arrayBuffer()), BYTES)
})

test('sharePdf: closing the share sheet does nothing else', async () => {
  const { env, links } = fakeEnv({
    canShare: () => true,
    share: async () => {
      const error = new Error('cancelled')
      error.name = 'AbortError'
      throw error
    },
  })
  assert.equal(await sharePdf(BYTES, 'x.pdf', env), 'cancelled')
  assert.equal(links.length, 0)
})

test('sharePdf falls back to a download when sharing is unavailable or refused', async () => {
  const noShare = fakeEnv({})
  assert.equal(await sharePdf(BYTES, 'x.pdf', noShare.env), 'downloaded')
  assert.equal(noShare.links[0].download, 'x.pdf')

  const cannot = fakeEnv({ share: async () => {}, canShare: () => false })
  assert.equal(await sharePdf(BYTES, 'x.pdf', cannot.env), 'downloaded')

  const refused = fakeEnv({
    canShare: () => true,
    share: async () => {
      const error = new Error('not allowed')
      error.name = 'NotAllowedError'
      throw error
    },
  })
  assert.equal(await sharePdf(BYTES, 'x.pdf', refused.env), 'downloaded')
  assert.equal(refused.links[0].clicked, true)
})
