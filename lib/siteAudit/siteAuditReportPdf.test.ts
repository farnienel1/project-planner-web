import test from 'node:test'
import assert from 'node:assert/strict'
import { PDFDocument } from 'pdf-lib'
import { SITE_AUDIT_REPORT_FIXTURE_EXPECTED, SITE_AUDIT_REPORT_FIXTURE_INPUTS, siteAuditReportLayout } from '@/lib/canonical'
import { renderSiteAuditReportPdf, type SiteAuditReportDrawLog } from './siteAuditReportPdf'

test('web draws every op of the shared site audit layout, page for page (rulebook 1.68.0 §29)', async () => {
  for (const { name, input } of SITE_AUDIT_REPORT_FIXTURE_INPUTS) {
    const expected = SITE_AUDIT_REPORT_FIXTURE_EXPECTED.find((row) => row.name === name)!
    const log: SiteAuditReportDrawLog = []
    const bytes = await renderSiteAuditReportPdf(siteAuditReportLayout(input), {}, log)
    assert.equal(log.length, expected.opCount, name)
    const drawnText = expected.pages.map((_, index) => log.filter((entry) => entry.page === index + 1 && entry.kind === 'text').map((entry) => entry.text))
    assert.deepEqual(drawnText, expected.pages, name)
    const reread = await PDFDocument.load(bytes)
    assert.equal(reread.getPageCount(), expected.pageCount, name)
  }
})
