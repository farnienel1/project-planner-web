/**
 * The site audit PDF on web (rulebook 1.68.0 §29, owner decision 17 Nov: the same PDF as the iPhone). The rulebook
 * composes the report's input (`siteAuditReportInput`) and lays it out (`siteAuditReportLayout`); this file only loads
 * the pictures, measures them and hands the pages to the pdf-lib renderer, then downloads the file. Before 1.68.0 web
 * printed an HTML page, so the browser chose the page breaks and the result differed from the iPhone's.
 */
import { imageDimensionsFromHeader, siteAuditReportInput, siteAuditReportLayout } from '@/lib/canonical'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'
import { downloadPdf } from '@/lib/pdf/downloadPdf'
import { loadCompanyLogo } from '@/lib/pdf/companyLogo'
import { withTimeout } from '@/lib/client/withTimeout'
import { renderSiteAuditReportPdf, type SiteAuditReportImage } from '@/lib/siteAudit/siteAuditReportPdf'
import { jpegExifOrientation } from '@/lib/siteAudit/jpegOrientation'
import type { Project, SiteAudit } from '@/types'

export interface SiteAuditPdfContext {
  organizationName?: string
  logoUrl?: string
  /** The job: its client and address lines (`siteAuditReportSiteAddress`). */
  job?: { clientName?: string; addressLine1?: string; addressLine2?: string; townCity?: string; postcode?: string } | null
  timeZone?: string
}

/** Photos are drawn at most this many pixels on their long side (the PDF stays small; the layout is unchanged). */
export const SITE_AUDIT_PDF_PHOTO_MAX_PIXELS = 1600

type LoadedPicture = { image: SiteAuditReportImage | null; width: number; height: number }

/**
 * A photo's bytes for the PDF and its size AS SHOWN (EXIF rotation applied, as the iPhone's `UIImage`): decoded and
 * redrawn as a JPEG when it is rotated, too large, or not JPEG / PNG. When the browser cannot decode it (HEIC in
 * Chrome), its size comes from the file header (rotated when the EXIF says so) and the box stays empty — the same box
 * the iPhone draws the photo in, so both apps break pages in the same places (review of #389).
 */
export async function loadPicture(url: string): Promise<LoadedPicture | null> {
  let bytes: Uint8Array
  let blob: Blob
  try {
    const response = await withTimeout(fetch(url), 20_000, 'The photo took too long to load.')
    if (!response.ok) return null
    blob = await response.blob()
    bytes = new Uint8Array(await blob.arrayBuffer())
  } catch {
    return null
  }
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50
  const orientation = isJpeg ? jpegExifOrientation(bytes) : 1
  const header = imageDimensionsFromHeader(bytes)
  const headerShown = header ? (orientation >= 5 ? { width: header.height, height: header.width } : header) : null
  let bitmap: ImageBitmap | null = null
  try {
    bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' })
  } catch {
    bitmap = null
  }
  if (!bitmap) return headerShown ? { image: null, ...headerShown } : null
  const { width, height } = bitmap
  const longSide = Math.max(width, height)
  if ((isJpeg || isPng) && orientation === 1 && longSide <= SITE_AUDIT_PDF_PHOTO_MAX_PIXELS) {
    bitmap.close()
    return { image: { bytes, format: isPng ? 'png' : 'jpg' }, width, height }
  }
  const scale = Math.min(1, SITE_AUDIT_PDF_PHOTO_MAX_PIXELS / longSide)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    return { image: null, width, height }
  }
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
  if (!jpeg) return { image: null, width, height }
  return { image: { bytes: new Uint8Array(await jpeg.arrayBuffer()), format: 'jpg' }, width, height }
}

/** Builds the report with the shared input and layout and downloads it. A photo that cannot be loaded keeps its box. */
export async function downloadSiteAuditPdf(audit: SiteAudit, context: SiteAuditPdfContext = {}): Promise<void> {
  const pictures = new Map<string, LoadedPicture | null>()
  const loads: Promise<void>[] = []
  // The company logo (owner request 17 Nov): the shared loader; any failure, a timeout or a PDF logo gives null and
  // the rulebook draws the initials badge instead (the PDF is never blocked).
  if (context.logoUrl) {
    loads.push(
      loadCompanyLogo(context.logoUrl).then((logo) =>
        void pictures.set('logo', logo ? { image: { bytes: logo.bytes, format: logo.format }, width: logo.width, height: logo.height } : null)
      )
    )
  }
  for (const item of audit.items) {
    if (item.imageURL) loads.push(loadPicture(item.imageURL).then((picture) => void pictures.set(item.id, picture)))
  }
  await Promise.all(loads)
  const size = (picture: LoadedPicture | null | undefined) => (picture ? { width: picture.width, height: picture.height } : null)
  const photos: Record<string, { width: number; height: number } | null> = {}
  for (const item of audit.items) photos[item.id] = size(pictures.get(item.id))
  const input = siteAuditReportInput({
    timeZone: context.timeZone || organizationZoneOr(),
    organizationName: context.organizationName,
    job: context.job ?? null,
    photos,
    logo: size(pictures.get('logo')),
    audit: {
      id: audit.id,
      projectJobNumber: audit.projectJobNumber,
      projectName: audit.projectName,
      type: audit.type,
      customTitle: audit.customTitle,
      authorName: audit.authorName,
      dateMs: audit.date.getTime(),
      createdAtMs: audit.createdAt.getTime(),
      items: audit.items.map((item) => ({
        id: item.id,
        title: item.title,
        location: item.location,
        assignee: item.assignee,
        comments: item.comments,
        annotations: item.annotations,
        imageURL: item.imageURL,
        imageCapturedAtMs: item.imageCapturedAt?.getTime() ?? null,
        createdAtMs: item.createdAt.getTime(),
      })),
    },
  })
  const layout = siteAuditReportLayout(input)
  const images: Record<string, SiteAuditReportImage> = {}
  for (const [ref, picture] of pictures) if (picture?.image) images[ref] = picture.image
  const bytes = await renderSiteAuditReportPdf(layout, images)
  downloadPdf(bytes, layout.fileName)
}

/** The PDF button: builds and downloads the report, and says so when it cannot. */
export function openSiteAuditPdf(audit: SiteAudit, context: SiteAuditPdfContext = {}): void {
  downloadSiteAuditPdf(audit, context).catch((error: unknown) => {
    window.alert(error instanceof Error && error.message ? `The PDF could not be made: ${error.message}` : 'The PDF could not be made.')
  })
}

export function buildSiteAuditPdfContextFromProject(
  _audit: SiteAudit,
  project: Project | null | undefined,
  organization?: { name?: string; companyLogoURL?: string } | null
): SiteAuditPdfContext {
  return {
    organizationName: organization?.name,
    logoUrl: organization?.companyLogoURL,
    job: project
      ? {
          clientName: project.client?.name,
          addressLine1: project.addressLine1,
          addressLine2: project.addressLine2,
          townCity: project.townCity,
          postcode: project.postcode,
        }
      : null,
  }
}
