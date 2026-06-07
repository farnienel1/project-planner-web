import { format } from 'date-fns'
import type { Project, SiteAudit, SiteAuditItem } from '@/types'

export interface SiteAuditPdfContext {
  organizationName?: string
  logoUrl?: string
  clientName?: string
  siteAddress?: string
  companyTagline?: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function formatProjectSiteAddress(
  project: Pick<Project, 'addressLine1' | 'addressLine2' | 'townCity' | 'postcode'>
): string {
  return [project.addressLine1, project.addressLine2, project.townCity, project.postcode]
    .filter((part) => part && part.trim().length > 0)
    .join(', ')
}

export function siteAuditReferenceCode(audit: SiteAudit): string {
  const job = audit.projectJobNumber.replace(/\s/g, '')
  const ts = Math.floor(audit.createdAt.getTime() / 1000)
  return `SA-${job}-${ts}`
}

function organizationInitials(name?: string): string {
  if (!name?.trim()) return 'PP'
  const parts = name.trim().split(/\s+/).slice(0, 2)
  if (parts.length === 0) return name.slice(0, 2).toUpperCase()
  return parts.map((part) => part.charAt(0).toUpperCase()).join('')
}

function authorSignatureShort(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}. ${parts.slice(1).join(' ')}`
  }
  return name
}

function itemCaptureTime(item: SiteAuditItem): string {
  return format(item.createdAt, 'HH:mm:ss')
}

function itemCaptureStamp(item: SiteAuditItem): string {
  return format(item.createdAt, 'd MMM yyyy · HH:mm:ss')
}

function renderLogoBlock(context: SiteAuditPdfContext): string {
  const orgName = escapeHtml(context.organizationName || 'Site Audit')
  const initials = escapeHtml(organizationInitials(context.organizationName))
  const tagline = escapeHtml(context.companyTagline || 'Mechanical & Electrical')

  if (context.logoUrl) {
    return `
      <div class="pdf-logo-wrap">
        <img class="pdf-logo-img" src="${escapeHtml(context.logoUrl)}" alt="${orgName}" />
        <div class="pdf-logo-text">
          <p class="pdf-org-name">${orgName}</p>
          <p class="pdf-org-tagline">${tagline}</p>
        </div>
      </div>
    `
  }

  return `
    <div class="pdf-logo-wrap">
      <div class="pdf-logo-placeholder">${initials}</div>
      <div class="pdf-logo-text">
        <p class="pdf-org-name">${orgName}</p>
        <p class="pdf-org-tagline">${tagline}</p>
      </div>
    </div>
  `
}

function renderDetailRow(key: string, value: string, muted = false): string {
  return `
    <div class="pdf-detail-row">
      <p class="k">${escapeHtml(key)}</p>
      <p class="v${muted ? ' v-muted' : ''}">${escapeHtml(value)}</p>
    </div>
  `
}

function renderItemCard(item: SiteAuditItem, index: number): string {
  const title = item.title.trim() || 'Untitled item'
  const location = item.location.trim() || '—'
  const assignee = item.assignee.trim() || '—'
  const comments = item.comments.trim() || '—'
  const annotations = item.annotations?.trim()
  const hasAnnotations = Boolean(annotations)
  const annotationValue = hasAnnotations ? annotations! : 'None'

  const photoBlock = item.imageURL
    ? `
      <div class="pdf-photo-box">
        <img src="${escapeHtml(item.imageURL)}" alt="${escapeHtml(title)}" />
        <span class="pdf-photo-timestamp">${escapeHtml(itemCaptureStamp(item))}</span>
      </div>
    `
    : ''

  const bodyClass = item.imageURL ? 'pdf-item-body' : 'pdf-item-body pdf-item-body--no-photo'

  return `
    <div class="pdf-item">
      <div class="pdf-item-card">
        <div class="pdf-item-header">
          <div class="pdf-item-num">${index}</div>
          <p class="pdf-item-title">${escapeHtml(title)}</p>
          <span class="pdf-item-time">${escapeHtml(itemCaptureTime(item))}</span>
        </div>
        <div class="${bodyClass}">
          ${photoBlock}
          <div>
            ${renderDetailRow('Location', location)}
            ${renderDetailRow('Assignee', assignee)}
            ${renderDetailRow('Comments', comments)}
            ${renderDetailRow('Annotations', annotationValue, !hasAnnotations)}
          </div>
        </div>
      </div>
    </div>
  `
}

export function buildSiteAuditPdfHtml(audit: SiteAudit, context: SiteAuditPdfContext = {}): string {
  const reference = siteAuditReferenceCode(audit)
  const orgName = context.organizationName || 'Site Audit'
  const clientName = context.clientName?.trim() || '—'
  const projectLabel = `${audit.projectJobNumber} ${audit.projectName}`.trim()
  const subtitle = context.siteAddress?.trim()
    ? `${audit.projectJobNumber} · ${context.siteAddress.trim()}`
    : `${audit.projectJobNumber} · ${audit.projectName}`
  const itemCount = audit.items.length
  const itemCountLabel = `${itemCount} item${itemCount === 1 ? '' : 's'}`
  const typeLabel = `${audit.type} audit`
  const docTitle = `SiteAudit_${audit.projectJobNumber}_${audit.type.replace(/\s/g, '')}_${format(audit.date, 'dMMMyy')}`

  const itemsHtml = audit.items.map((item, idx) => renderItemCard(item, idx + 1)).join('')

  const customTitleBlock = audit.customTitle?.trim()
    ? `<p class="pdf-header-custom">${escapeHtml(audit.customTitle.trim())}</p>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(docTitle)}</title>
  <style>
    :root {
      --c-text: #0B1020;
      --c-text-secondary: #6B7280;
      --c-border: #EEF0F3;
      --c-primary: #185FA5;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      color: var(--c-text);
      background: #FFFFFF;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .pdf-document {
      width: 100%;
      max-width: 595px;
      margin: 0 auto;
      background: #FFFFFF;
    }

    .pdf-header {
      background: linear-gradient(135deg, #0B1020 0%, #1A2447 100%);
      color: #FFFFFF;
      padding: 28px 32px 22px;
      position: relative;
      overflow: hidden;
    }

    .pdf-header::before {
      content: '';
      position: absolute;
      top: -30px;
      right: -30px;
      width: 180px;
      height: 180px;
      background: radial-gradient(circle, rgba(24, 95, 165, 0.4) 0%, transparent 70%);
      border-radius: 50%;
      pointer-events: none;
    }

    .pdf-header-inner {
      position: relative;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
    }

    .pdf-header-main { min-width: 0; flex: 1; }

    .pdf-header-label {
      font-size: 10px;
      opacity: 0.7;
      font-weight: 500;
      letter-spacing: 0.8px;
      text-transform: uppercase;
    }

    .pdf-header-title {
      font-size: 24px;
      font-weight: 600;
      margin: 6px 0 4px;
      letter-spacing: -0.3px;
    }

    .pdf-header-subtitle {
      font-size: 13px;
      opacity: 0.85;
      line-height: 1.35;
    }

    .pdf-header-custom {
      font-size: 11px;
      font-weight: 500;
      opacity: 0.75;
      margin-top: 6px;
    }

    .pdf-logo-wrap {
      text-align: right;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 8px;
      flex-shrink: 0;
    }

    .pdf-logo-placeholder {
      width: 64px;
      height: 64px;
      border-radius: 12px;
      background: linear-gradient(135deg, #185FA5 0%, #378ADD 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      font-size: 18px;
      font-weight: 700;
      color: #FFFFFF;
      letter-spacing: -0.5px;
    }

    .pdf-logo-img {
      width: 64px;
      height: 64px;
      border-radius: 12px;
      object-fit: contain;
      background: rgba(255, 255, 255, 0.08);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }

    .pdf-org-name {
      font-size: 11px;
      font-weight: 600;
      margin: 0;
    }

    .pdf-org-tagline {
      font-size: 9px;
      opacity: 0.7;
      margin: 1px 0 0;
    }

    .pdf-meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18px;
      padding: 24px 32px;
      background: #F7F8FA;
      border-bottom: 1px solid var(--c-border);
    }

    .pdf-meta-grid .label-key {
      font-size: 9px;
      color: var(--c-text-secondary);
      margin: 0 0 3px;
      font-weight: 600;
      letter-spacing: 0.6px;
      text-transform: uppercase;
    }

    .pdf-meta-grid .label-val {
      font-size: 13px;
      color: var(--c-text);
      margin: 0;
      font-weight: 500;
      line-height: 1.35;
    }

    .pdf-meta-grid .label-val.mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 11px;
    }

    .pdf-section-heading {
      padding: 22px 32px 14px;
    }

    .pdf-section-heading .accent {
      display: block;
      width: 24px;
      height: 3px;
      background: var(--c-primary);
      margin-bottom: 8px;
    }

    .pdf-section-heading h3 {
      color: var(--c-text);
      font-size: 14px;
      font-weight: 600;
      margin: 0;
      letter-spacing: 0.2px;
      text-transform: uppercase;
    }

    .pdf-item {
      padding: 0 32px 22px;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .pdf-item-card {
      border: 1px solid var(--c-border);
      border-radius: 8px;
      overflow: hidden;
    }

    .pdf-item-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      background: #F7F8FA;
      border-bottom: 1px solid var(--c-border);
    }

    .pdf-item-num {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: var(--c-primary);
      color: #FFFFFF;
      font-size: 11px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .pdf-item-title {
      flex: 1;
      font-size: 13px;
      font-weight: 600;
      color: var(--c-text);
      margin: 0;
    }

    .pdf-item-time {
      font-size: 10px;
      color: var(--c-text-secondary);
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      flex-shrink: 0;
    }

    .pdf-item-body {
      display: grid;
      grid-template-columns: 200px 1fr;
      gap: 14px;
      padding: 14px;
    }

    .pdf-item-body--no-photo {
      grid-template-columns: 1fr;
    }

    .pdf-photo-box {
      background: #F7F8FA;
      border-radius: 4px;
      overflow: hidden;
      position: relative;
      min-height: 118px;
      height: 118px;
    }

    .pdf-photo-box img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .pdf-photo-timestamp {
      position: absolute;
      bottom: 6px;
      left: 6px;
      background: rgba(0, 0, 0, 0.75);
      color: #FFFFFF;
      font-size: 9px;
      padding: 2px 6px;
      border-radius: 2px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }

    .pdf-detail-row { padding: 4px 0; }
    .pdf-detail-row + .pdf-detail-row { border-top: 1px dashed var(--c-border); }
    .pdf-detail-row .k {
      font-size: 9px;
      color: var(--c-text-secondary);
      margin: 0 0 1px;
      font-weight: 500;
      letter-spacing: 0.3px;
      text-transform: uppercase;
    }
    .pdf-detail-row .v {
      font-size: 11px;
      color: var(--c-text);
      margin: 0;
      line-height: 1.4;
      white-space: pre-wrap;
    }
    .pdf-detail-row .v-muted {
      color: var(--c-text-secondary);
      font-style: italic;
    }

    .pdf-signature {
      padding: 14px 32px 72px;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .pdf-signature-grid {
      border-top: 2px solid #0B1020;
      padding-top: 14px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
    }

    .pdf-signature-label {
      font-size: 9px;
      color: var(--c-text-secondary);
      margin: 0 0 24px;
      font-weight: 600;
      letter-spacing: 0.6px;
      text-transform: uppercase;
    }

    .pdf-signature-script {
      font-family: 'Brush Script MT', 'Segoe Script', cursive;
      font-size: 18px;
      color: #1A2447;
      margin: 0;
      transform: rotate(-2deg);
      display: inline-block;
    }

    .pdf-signature-line {
      border-bottom: 0.5px solid var(--c-text);
      margin: 4px 0;
    }

    .pdf-signature-line.author { width: 70%; }
    .pdf-signature-line.client { width: 90%; }

    .pdf-signature-foot {
      font-size: 9px;
      color: var(--c-text-secondary);
      margin: 4px 0 0;
    }

    .pdf-print-footer {
      border-top: 1px solid var(--c-border);
      padding: 16px 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10px;
      color: var(--c-text-secondary);
      background: #FFFFFF;
    }

    .pdf-print-footer .org {
      font-weight: 600;
      color: var(--c-text);
      margin: 0;
    }

    .pdf-print-footer .ref {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 9px;
      margin: 1px 0 0;
    }

    @page {
      size: A4;
      margin: 0;
    }

    @media print {
      body { background: #FFFFFF; }
      .pdf-document { max-width: none; }
      .pdf-print-footer {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
      }
      .pdf-signature {
        padding-bottom: 88px;
      }
    }
  </style>
</head>
<body>
  <div class="pdf-document">
    <div class="pdf-header">
      <div class="pdf-header-inner">
        <div class="pdf-header-main">
          <p class="pdf-header-label">Site Audit Report</p>
          <p class="pdf-header-title">${escapeHtml(audit.type)}</p>
          <p class="pdf-header-subtitle">${escapeHtml(subtitle)}</p>
          ${customTitleBlock}
        </div>
        ${renderLogoBlock(context)}
      </div>
    </div>

    <div class="pdf-meta-grid">
      <div>
        <p class="label-key">Project</p>
        <p class="label-val">${escapeHtml(projectLabel)}</p>
      </div>
      <div>
        <p class="label-key">Client</p>
        <p class="label-val">${escapeHtml(clientName)}</p>
      </div>
      <div>
        <p class="label-key">Author</p>
        <p class="label-val">${escapeHtml(audit.authorName)}</p>
      </div>
      <div>
        <p class="label-key">Date</p>
        <p class="label-val">${escapeHtml(format(audit.date, 'd MMM yyyy'))}</p>
      </div>
      <div>
        <p class="label-key">Type</p>
        <p class="label-val">${escapeHtml(typeLabel)}</p>
      </div>
      <div>
        <p class="label-key">Reference</p>
        <p class="label-val mono">${escapeHtml(reference)}</p>
      </div>
    </div>

    <div class="pdf-section-heading">
      <span class="accent"></span>
      <h3>Site observations · ${itemCountLabel}</h3>
    </div>

    ${itemsHtml}

    <div class="pdf-signature">
      <div class="pdf-signature-grid">
        <div>
          <p class="pdf-signature-label">Author signature</p>
          <p class="pdf-signature-script">${escapeHtml(authorSignatureShort(audit.authorName))}</p>
          <div class="pdf-signature-line author"></div>
          <p class="pdf-signature-foot">${escapeHtml(audit.authorName)} · ${escapeHtml(format(audit.date, 'd MMM yyyy'))}</p>
        </div>
        <div>
          <p class="pdf-signature-label" style="margin-bottom: 36px;">Client acknowledgement</p>
          <div class="pdf-signature-line client"></div>
          <p class="pdf-signature-foot">Signed &amp; dated</p>
        </div>
      </div>
    </div>

    <div class="pdf-print-footer">
      <div>
        <p class="org">${escapeHtml(orgName)}</p>
        <p>${escapeHtml(context.companyTagline || 'Mechanical & Electrical Contractors')}</p>
      </div>
      <div style="text-align: right;">
        <p style="margin: 0;">Site audit report</p>
        <p class="ref">${escapeHtml(reference)}</p>
      </div>
    </div>
  </div>
</body>
</html>`
}

export function openSiteAuditPdf(audit: SiteAudit, context: SiteAuditPdfContext = {}): void {
  const html = buildSiteAuditPdfHtml(audit, context)
  const win = window.open('', '_blank')
  if (!win) return

  win.document.write(html)
  win.document.close()
  win.focus()

  const triggerPrint = () => {
    win.focus()
    win.print()
  }

  const images = win.document.images
  if (images.length === 0) {
    setTimeout(triggerPrint, 300)
    return
  }

  let loaded = 0
  const onDone = () => {
    loaded += 1
    if (loaded >= images.length) {
      setTimeout(triggerPrint, 200)
    }
  }

  for (let i = 0; i < images.length; i += 1) {
    const img = images[i]
    if (img.complete) {
      onDone()
    } else {
      img.addEventListener('load', onDone)
      img.addEventListener('error', onDone)
    }
  }

  setTimeout(triggerPrint, 2500)
}

export function buildSiteAuditPdfContextFromProject(
  audit: SiteAudit,
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
