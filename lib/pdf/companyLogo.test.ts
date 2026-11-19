import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadCompanyLogo } from './companyLogo'

const URL_OK = 'https://firebasestorage.googleapis.com/v0/b/x/o/organizations%2Fo%2Fbranding%2Fcompany_logo%2Flogo.png?alt=media'

function png(width: number, height: number): Uint8Array {
  const b = new Uint8Array(33)
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52])
  new DataView(b.buffer).setUint32(16, width)
  new DataView(b.buffer).setUint32(20, height)
  return b
}

function jpeg(width: number, height: number): Uint8Array {
  // SOI, then SOF0: FF C0, length 17, precision 8, height, width.
  const b = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0, 0, 0, 0, 0x03, 1, 2, 3, 4, 5, 6, 7, 8])
  new DataView(b.buffer).setUint16(7, height)
  new DataView(b.buffer).setUint16(9, width)
  return b
}

const respond = (bytes: Uint8Array, ok = true) =>
  (async () => ({ ok, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) })) as unknown as typeof fetch

test('company logo: PNG and JPEG with their pixel size, wide and tall alike', async () => {
  assert.deepEqual(await loadCompanyLogo(URL_OK, { fetch: respond(png(2400, 200)) }).then((l) => l && [l.format, l.width, l.height]), ['png', 2400, 200])
  assert.deepEqual(await loadCompanyLogo(URL_OK, { fetch: respond(jpeg(200, 2400)) }).then((l) => l && [l.format, l.width, l.height]), ['jpg', 200, 2400])
})

test('company logo: every failure gives null (the report shows the initials badge)', async () => {
  // Not https (safeExternalUrl), missing, a 404, a network error, a PDF logo, unreadable bytes.
  assert.equal(await loadCompanyLogo('http://example.com/logo.png', { fetch: respond(png(10, 10)) }), null)
  assert.equal(await loadCompanyLogo('javascript:alert(1)', { fetch: respond(png(10, 10)) }), null)
  assert.equal(await loadCompanyLogo(null), null)
  assert.equal(await loadCompanyLogo(URL_OK, { fetch: respond(png(10, 10), false) }), null)
  const failing = (async () => {
    throw new Error('offline')
  }) as unknown as typeof fetch
  assert.equal(await loadCompanyLogo(URL_OK, { fetch: failing }), null)
  assert.equal(await loadCompanyLogo(URL_OK, { fetch: respond(new TextEncoder().encode('%PDF-1.7 logo')) }), null)
  assert.equal(await loadCompanyLogo(URL_OK, { fetch: respond(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])) }), null)
})

test('company logo: a fetch that hangs is aborted and gives null', async () => {
  const hanging = ((_url: string, init?: { signal?: AbortSignal }) =>
    new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))))) as unknown as typeof fetch
  assert.equal(await loadCompanyLogo(URL_OK, { fetch: hanging, timeoutMs: 20 }), null)
})

test('company logo: WebP and HEIC are redrawn as PNG; a logo the browser cannot read gives null', async () => {
  const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x4c])
  const seen: string[] = []
  const redraw = async (_bytes: Uint8Array, type: string) => {
    seen.push(type)
    return { bytes: png(40, 20), format: 'png' as const, width: 40, height: 20 }
  }
  assert.deepEqual(await loadCompanyLogo(URL_OK, { fetch: respond(webp), redraw }).then((l) => l && [l.format, l.width]), ['png', 40])
  assert.deepEqual(seen, ['image/webp'])
  assert.equal(await loadCompanyLogo(URL_OK, { fetch: respond(webp), redraw: async () => null }), null)
})
