import { inflateSync } from 'node:zlib'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PDFDocument } from 'pdf-lib'
import type { HSToolboxTalk } from '../../types/index.ts'
import { buildToolboxTalkPdf, toolboxTalkPdfFilename } from './toolboxTalkPdf.ts'

function pdfPlainText(bytes: Uint8Array): string {
  const raw = Buffer.from(bytes)
  const chunks: Buffer[] = [raw]
  const stream = Buffer.from('stream\n')
  const end = Buffer.from('\nendstream')
  let offset = 0
  while (offset < raw.length) {
    const start = raw.indexOf(stream, offset)
    if (start < 0) break
    const dataStart = start + stream.length
    const stop = raw.indexOf(end, dataStart)
    if (stop < 0) break
    try {
      chunks.push(inflateSync(raw.subarray(dataStart, stop)))
    } catch {
      // Leave non-flate streams as raw bytes.
    }
    offset = stop + end.length
  }
  const inflated = Buffer.concat(chunks).toString('latin1')
  return inflated.replace(/<([0-9A-Fa-f]+)>/g, (_match, hex: string) => {
    let text = ''
    for (let index = 0; index < hex.length; index += 2) {
      text += String.fromCharCode(parseInt(hex.slice(index, index + 2), 16))
    }
    return text
  })
}

function talk(partial: Partial<HSToolboxTalk> = {}): HSToolboxTalk {
  return {
    id: 'TBT-GEN-001',
    referenceCode: 'TBT-GEN-001',
    title: 'Working at Height',
    category: 'General',
    isGeneral: true,
    trades: [],
    purpose: 'Falls from height are the single biggest cause of fatal injury.',
    keyPoints: ['Use edge protection.', 'Do not overreach.'],
    source: 'library',
    status: 'approved',
    version: 1,
    updatedAt: new Date('2026-01-01'),
    ...partial,
  }
}

test('toolbox talk download is a PDF named like the iOS share sheet', async () => {
  const bytes = await buildToolboxTalkPdf({
    talk: talk(),
    projectLabel: 'Library talk',
    signatures: [
      {
        id: 'sig-1',
        issueId: 'issue-1',
        userId: 'user-1',
        status: 'signed',
        readConfirmed: true,
        signedAt: new Date('2026-09-23T08:35:00Z'),
        signatureImageBase64:
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      },
    ],
    users: [
      {
        id: 'user-1',
        firstName: 'Alex',
        surname: 'Mason',
        email: 'alex@example.com',
        tradeTypePreset: 'Scaffolder',
      } as never,
    ],
  })
  assert.equal(Buffer.from(bytes.subarray(0, 5)).toString(), '%PDF-')
  const raw = pdfPlainText(bytes)
  assert.match(raw, /Working at Height/)
  assert.match(raw, /KEY CONTROL POINTS/)
  assert.match(raw, /ATTENDEE SIGN-OFF/)
  assert.match(raw, /Library talk/)
  assert.match(raw, /Alex Mason/)
  const doc = await PDFDocument.load(bytes)
  assert.equal(doc.getTitle(), 'Working at Height')
  assert.equal(doc.getPageCount(), 1)
  const stamp = new Date('2026-09-23T08:35:00Z').getTime()
  assert.equal(toolboxTalkPdfFilename(talk(), stamp), `ToolboxTalk-Working_at_Height-${Math.floor(stamp / 1000)}.pdf`)
})

test('a long talk paginates instead of clipping the sign-off table', async () => {
  const bytes = await buildToolboxTalkPdf({
    talk: talk({
      keyPoints: Array.from({ length: 40 }, (_, index) => `Control point ${index + 1} stays on the page with the rest of the briefing.`),
    }),
  })
  const doc = await PDFDocument.load(bytes)
  assert.ok(doc.getPageCount() > 1)
})
