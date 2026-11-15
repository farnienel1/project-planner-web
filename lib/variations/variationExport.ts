/**
 * Download the variations Excel file (rulebook 1.52.0). Rows are the rulebook's `variationExportRows` over EVERY
 * variation of the job (not the filtered list); the workbook is drawn by `variationWorkbook.ts`, loaded on demand.
 */
import { formatStampInZone } from '@/lib/orgTime/zoneTime'
import { variationExportFileName, variationExportRows, type VariationExportInput } from '@/lib/canonical'
import type { Variation } from '@/lib/variations/variationModel'

/** A web variation as the rulebook export reads it (dates as epoch ms). */
export function variationExportInput(row: Variation): VariationExportInput {
  return { ...row, createdAtMs: row.createdAt?.getTime?.() ?? null }
}

export async function downloadVariationsWorkbook(input: {
  variations: Variation[]
  timeZone: string
  currency: string
  includeCost: boolean
  companyName: string
  jobNumber: string
  jobName: string
  generatedBy: string
  logoUrl?: string | null
}): Promise<void> {
  const { buildVariationWorkbook, loadWorkbookLogo } = await import('@/lib/variations/variationWorkbook')
  const rows = variationExportRows(input.variations.map(variationExportInput), {
    timeZone: input.timeZone,
    currency: input.currency,
    includeCost: input.includeCost,
  })
  const logo = await loadWorkbookLogo(input.logoUrl)
  const bytes = buildVariationWorkbook({
    rows,
    companyName: input.companyName,
    jobNumber: input.jobNumber,
    jobName: input.jobName,
    generatedBy: input.generatedBy,
    generatedAt: formatStampInZone(new Date(), input.timeZone),
    logo,
  })
  const blob = new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = variationExportFileName(input.jobNumber)
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
