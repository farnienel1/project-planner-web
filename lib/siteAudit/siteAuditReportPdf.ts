/**
 * Draws the rulebook's site audit report layout (`siteAuditReportLayout`, rulebook 1.65.0 §29) with pdf-lib. Every
 * op is drawn exactly where the layout puts it, in standard Helvetica, so the web PDF matches the iPhone's. This file
 * decides nothing about the report: no wrapping, sizing or page breaks happen here.
 */
import { PDFDocument, StandardFonts, rgb, type PDFImage, type PDFPage } from 'pdf-lib'
import type { SiteAuditReportLayout, SiteAuditReportOp } from '@/lib/canonical'

export type SiteAuditReportImage = { bytes: Uint8Array; format: 'jpg' | 'png' }

function color(hex: string) {
  const value = hex.replace('#', '')
  return rgb(parseInt(value.slice(0, 2), 16) / 255, parseInt(value.slice(2, 4), 16) / 255, parseInt(value.slice(4, 6), 16) / 255)
}

/** Ops drawn per page, in order (the tests check every op is drawn). */
export type SiteAuditReportDrawLog = { page: number; kind: SiteAuditReportOp['kind']; text?: string }[]

export async function renderSiteAuditReportPdf(
  layout: SiteAuditReportLayout,
  images: Readonly<Record<string, SiteAuditReportImage | undefined>>,
  log?: SiteAuditReportDrawLog
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const embedded = new Map<string, PDFImage | null>()
  const imageFor = async (ref: string): Promise<PDFImage | null> => {
    if (embedded.has(ref)) return embedded.get(ref) ?? null
    const source = images[ref]
    let image: PDFImage | null = null
    if (source) {
      try {
        image = source.format === 'png' ? await pdf.embedPng(source.bytes) : await pdf.embedJpg(source.bytes)
      } catch {
        image = null
      }
    }
    embedded.set(ref, image)
    return image
  }
  const H = layout.page.height
  for (const pageLayout of layout.pages) {
    const page: PDFPage = pdf.addPage([layout.page.width, H])
    for (const op of pageLayout.ops) {
      log?.push({ page: pageLayout.number, kind: op.kind, text: op.kind === 'text' ? op.text : undefined })
      switch (op.kind) {
        case 'rect':
          page.drawRectangle({
            x: op.x,
            y: H - op.y - op.h,
            width: op.w,
            height: op.h,
            color: op.fill ? color(op.fill) : undefined,
            borderColor: op.stroke ? color(op.stroke) : undefined,
            borderWidth: op.stroke ? 1 : 0,
          })
          break
        case 'line':
          page.drawLine({
            start: { x: op.x1, y: H - op.y1 },
            end: { x: op.x2, y: H - op.y2 },
            thickness: op.width,
            color: color(op.color),
            dashArray: op.dash,
          })
          break
        case 'circle':
          page.drawCircle({ x: op.cx, y: H - op.cy, size: op.r, color: color(op.fill) })
          break
        case 'text':
          page.drawText(op.text, { x: op.x, y: H - op.baseline, size: op.size, font: op.bold ? bold : regular, color: color(op.color) })
          break
        case 'image': {
          const image = await imageFor(op.ref)
          if (image) {
            page.drawImage(image, { x: op.x, y: H - op.y - op.h, width: op.w, height: op.h })
          } else {
            // The picture could not be read: a grey box of the same size, so the layout is unchanged.
            page.drawRectangle({ x: op.x, y: H - op.y - op.h, width: op.w, height: op.h, color: color('#EEF0F3') })
          }
          break
        }
      }
    }
  }
  return pdf.save()
}
