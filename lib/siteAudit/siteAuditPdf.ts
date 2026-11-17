/**
 * The site audit PDF on web (rulebook 1.61.0 §29, owner decision 17 Nov: the same PDF as the iPhone). The rulebook
 * lays the report out (`siteAuditReportLayout`); this file only loads the pictures, measures them and hands the pages
 * to the pdf-lib renderer, then downloads the file. Before 1.61.0 web printed an HTML page, so the browser chose the
 * page breaks and the result differed from the iPhone's.
 */
import { siteAuditReportLayout, type SiteAuditReportInput } from '@/lib/canonical'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'
import { downloadPdf } from '@/lib/pdf/downloadPdf'
import { loadCompanyLogo } from '@/lib/pdf/companyLogo'
import { withTimeout } from '@/lib/client/withTimeout'
import { renderSiteAuditReportPdf, type SiteAuditReportImage } from '@/lib/siteAudit/siteAuditReportPdf'
import type { Project, SiteAudit } from '@/types'

export interface SiteAuditPdfContext {
  organizationName?: string
  logoUrl?: string
  clientName?: string
  siteAddress?: string
  timeZone?: string
}

export function formatProjectSiteAddress(
  project: Pick<Project, 'addressLine1' | 'addressLine2' | 'townCity' | 'postcode'>
): string {
  return [project.addressLine1, project.addressLine2, project.townCity, project.postcode]
    .filter((part) => part && part.trim().length > 0)
    .join(', ')
}

type LoadedPicture = { image: SiteAuditReportImage; width: number; height: number }

/** A picture as JPEG or PNG bytes with its pixel size; anything else (HEIC, WebP) is redrawn as a JPEG. */
async function loadPicture(url: string): Promise<LoadedPicture | null> {
  try {
    const response = await withTimeout(fetch(url), 20_000, 'The photo took too long to load.')
    if (!response.ok) return null
    const blob = await response.blob()
    const bitmap = await createImageBitmap(blob)
    const { width, height } = bitmap
    const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer())
    const isJpeg = head[0] === 0xff && head[1] === 0xd8
    const isPng = head[0] === 0x89 && head[1] === 0x50
    if (isJpeg || isPng) {
      bitmap.close()
      return { image: { bytes: new Uint8Array(await blob.arrayBuffer()), format: isPng ? 'png' : 'jpg' }, width, height }
    }
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) {
      bitmap.close()
      return null
    }
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    context.drawImage(bitmap, 0, 0)
    bitmap.close()
    const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    if (!jpeg) return null
    return { image: { bytes: new Uint8Array(await jpeg.arrayBuffer()), format: 'jpg' }, width, height }
  } catch {
    return null
  }
}

/** Builds the report with the shared layout and downloads it. A photo that cannot be loaded keeps an empty box. */
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
  const input: SiteAuditReportInput = {
    timeZone: context.timeZone || organizationZoneOr(),
    organizationName: context.organizationName,
    clientName: context.clientName,
    siteAddress: context.siteAddress,
    logo: pictures.get('logo') ?? null,
    audit: {
      id: audit.id,
      projectJobNumber: audit.projectJobNumber,
      projectName: audit.projectName,
      type: audit.type,
      customTitle: audit.customTitle,
      authorName: audit.authorName,
      dateMs: audit.date.getTime(),
      createdAtMs: audit.createdAt.getTime(),
      items: audit.items.map((item) => {
        const picture = pictures.get(item.id)
        return {
          id: item.id,
          title: item.title,
          location: item.location,
          assignee: item.assignee,
          comments: item.comments,
          annotations: item.annotations,
          imageCapturedAtMs: item.imageCapturedAt?.getTime() ?? null,
          createdAtMs: item.createdAt.getTime(),
          // An item with a stored photo keeps its box even when the picture could not be loaded (same layout).
          photo: picture ? { width: picture.width, height: picture.height } : item.imageURL ? { width: 4, height: 3 } : null,
        }
      }),
    },
  }
  const layout = siteAuditReportLayout(input)
  const images: Record<string, SiteAuditReportImage> = {}
  for (const [ref, picture] of pictures) if (picture) images[ref] = picture.image
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
    clientName: project?.client?.name,
    siteAddress: project ? formatProjectSiteAddress(project) : undefined,
  }
}
