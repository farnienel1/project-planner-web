import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertUploadAllowed } from './uploadGuard.ts'

const PDF = new TextEncoder().encode('%PDF-1.7\n1 0 obj\n')
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10])
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
const ZIP = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0])

const path = (rest: string) => `organizations/org1/${rest}`

test('a PDF claimed as octet-stream uploads as application/pdf', async () => {
  const file = new File([PDF], 'RAMS.pdf', { type: 'application/octet-stream' })
  assert.equal(await assertUploadAllowed(path('healthSafety/p1/rams/u1_1.pdf'), file), 'application/pdf')
})

test('a Blob with no name is judged by the object name and the bytes', async () => {
  assert.equal(await assertUploadAllowed(path('siteAudits/a1/images/u1_1.jpg'), new Blob([JPEG])), 'image/jpeg')
})

test('SVG, macro workbooks and disguised files are refused with the rulebook message', async () => {
  await assert.rejects(
    assertUploadAllowed(path('tasks/t1/u1_1.svg'), new File([SVG], 'logo.svg', { type: 'image/svg+xml' })),
    /This type of file cannot be uploaded/
  )
  await assert.rejects(
    assertUploadAllowed(
      path('healthSafety/p1/rams/u1_1.xlsm'),
      new File([ZIP], 'RAMS.xlsm', { type: 'application/vnd.ms-excel.sheet.macroEnabled.12' })
    ),
    /This type of file cannot be uploaded/
  )
  await assert.rejects(
    assertUploadAllowed(path('tasks/t1/u1_1.jpg'), new File([SVG], 'photo.jpg', { type: 'image/jpeg' })),
    /not the type its name says/
  )
  await assert.rejects(assertUploadAllowed('somewhere/else.pdf', new File([PDF], 'a.pdf')), /cannot be uploaded here/)
})

test('oversize files are refused before upload', async () => {
  const big = new File([PDF, new Uint8Array(10 * 1024 * 1024)], 'big.pdf', { type: 'application/pdf' })
  await assert.rejects(assertUploadAllowed(path('tasks/t1/u1_1.pdf'), big), /too large/)
})

test('photoScale and uploadedPhotoName', async () => {
  const { photoScale, uploadedPhotoName } = await import('./stripPhotoLocation.ts')
  assert.equal(photoScale(1000, 800), 1)
  assert.equal(photoScale(5120, 3840), 0.5)
  assert.equal(uploadedPhotoName(new File([], 'IMG_1.HEIC'), new Blob([], { type: 'image/jpeg' })), 'IMG_1.jpg')
  assert.equal(uploadedPhotoName(new File([], 'a.png'), new File([], 'photo.png', { type: 'image/png' })), 'photo.png')
})

const HEIC = new Uint8Array([0, 0, 0, 0x18, ...new TextEncoder().encode('ftypheic'), 0, 0, 0, 0])
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])

test('review L1: a HEIC with a blank file.type is allowed and written as image/heic', async () => {
  const file = new File([HEIC], 'IMG_0001.HEIC', { type: '' })
  assert.equal(await assertUploadAllowed(path('tasks/t1/u1_1.heic'), file), 'image/heic')
  assert.equal(await assertUploadAllowed(path('siteAudits/a1/images/u1_1.heic'), new File([HEIC], 'x.heic')), 'image/heic')
})

test('1.50.0 Storage rules live: certificates accept every allowed photo type', async () => {
  const cert = (name: string) => path(`operatives/o1/qualifications/q1/certificates/u1_1.${name}`)
  assert.equal(await assertUploadAllowed(cert('jpg'), new File([JPEG], 'card.jpg', { type: 'image/jpeg' })), 'image/jpeg')
  assert.equal(await assertUploadAllowed(cert('pdf'), new File([PDF], 'card.pdf', { type: 'application/pdf' })), 'application/pdf')
  assert.equal(await assertUploadAllowed(cert('png'), new File([PNG], 'card.png', { type: 'image/png' })), 'image/png')
  assert.equal(await assertUploadAllowed(cert('heic'), new File([HEIC], 'card.heic', { type: '' })), 'image/heic')
})
