/** Rulebook 1.33.0 §25: the overtime report PDF in the invoice family — builds, paginates, draws declined and out-of-date reports. */
import assert from 'node:assert/strict'
import test from 'node:test'
import { PDFDocument } from 'pdf-lib'
import { parseOvertimeReportDocument } from '@/lib/canonical'
import { buildOvertimeReportPdf } from '@/lib/overtime/overtimeReportPdf'

const line = (i: number) => ({ bookingId: `B${i}`, dayKey: '2026-11-04', jobNumber: 'J-1042', jobName: 'Riverside Flats – Block “A”', start: '06:30', end: '14:00', clockHours: 1, multiplier: 1.5, breakHours: 0, overtimeHours: 1.5, text: '1h × 1.5 = 1.5h' })

test('overtime report PDF: one page for a short report, more pages for a long one, declined and out of date drawn', async () => {
  const short = parseOvertimeReportDocument('R1', { userId: 'sam', userName: 'Sam Żółć', companyName: 'Acme', rangeStart: '2026-10-26', rangeEnd: '2026-11-25', lines: [line(1)], generatedBy: 'sam', generatedAt: Date.UTC(2026, 10, 6, 14, 5) })
  assert.equal((await PDFDocument.load(await buildOvertimeReportPdf(short, { timeZone: 'Europe/London' }))).getPageCount(), 1)
  const long = { ...short, lines: Array.from({ length: 40 }, (_, i) => ({ ...line(i), ...(i === 0 ? { declined: true, declinedByName: 'Lee' } : {}) })), outOfDate: true }
  assert.ok((await PDFDocument.load(await buildOvertimeReportPdf(long))).getPageCount() >= 2)
  const empty = { ...short, lines: [] }
  assert.equal((await PDFDocument.load(await buildOvertimeReportPdf(empty))).getPageCount(), 1)
})
