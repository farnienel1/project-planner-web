/** Rulebook 1.30.0 §26: the price work / expenses report PDF — summary page, image evidence pages, PDF evidence appended. */
import assert from 'node:assert/strict'
import test from 'node:test'
import { PDFDocument } from 'pdf-lib'
import { parseExpenseDocument, payeClaimReportSnapshot } from '@/lib/canonical'
import { buildPayeClaimReportPdf, buildPersonalSiteAuditPdf, pdfSafe } from '@/lib/payeClaims/payeClaimReportPdf'

// 1×1 PNG.
const DIR = 'organizations/org/payeClaims/sam/sam_'
const PNG = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'))

async function twoPagePdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.addPage()
  pdf.addPage()
  return pdf.save()
}

test('expenses report: summary, one page per image, a PDF attachment appended, other files listed', async () => {
  const attachment = await twoPagePdf()
  const item = parseExpenseDocument('E1', {
    userId: 'sam',
    title: 'Fuel – diesel',
    amount: 40,
    date: '2026-11-04',
    evidence: [
      { path: `${DIR}1.png`, name: 'receipt.png', kind: 'photo', contentType: 'image/png' },
      { path: `${DIR}2.pdf`, name: 'invoice.pdf', kind: 'file', contentType: 'application/pdf' },
      { path: `${DIR}3.docx`, name: 'note.docx', kind: 'file', contentType: 'application/msword' },
      { path: `${DIR}4.png`, name: 'missing.png', kind: 'photo', contentType: 'image/png' },
    ],
  })
  const snapshot = payeClaimReportSnapshot({ kind: 'expense', userId: 'sam', userName: 'Sam', currency: 'EUR', rangeStart: '2026-10-26', rangeEnd: '2026-11-25', items: [item], generatedBy: 'sam' })
  const files: Record<string, Uint8Array> = { [`${DIR}1.png`]: PNG, [`${DIR}2.pdf`]: attachment }
  const { bytes, notDrawn } = await buildPayeClaimReportPdf(snapshot, {
    readFile: async (path) => {
      if (!files[path]) throw new Error('missing')
      return files[path]
    },
  })
  const doc = await PDFDocument.load(bytes)
  // Summary + 4 evidence heading pages + 2 appended pages.
  assert.equal(doc.getPageCount(), 7)
  assert.equal(notDrawn, 2)
})

test('personal site audit copy and safe text', async () => {
  const bytes = await buildPersonalSiteAuditPdf(
    { id: 'A1', ownerUserId: 'sam', jobNumber: 'J-1', jobName: 'Wall', type: 'General', customTitle: '', date: '2026-11-04', authorName: 'Sam', createdAtMs: null, items: [{ id: 'i', title: 'Crack', location: '', comments: '', assignee: '', annotations: '', imagePath: 'p.png', takenAtMs: null }] },
    { readFile: async () => PNG }
  )
  assert.ok((await PDFDocument.load(bytes)).getPageCount() >= 1)
  assert.equal(pdfSafe('A – B × 2 · €5 ’'), "A - B x 2 | EUR 5 '")
})
