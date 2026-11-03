// Transactional: no marketing content
/**
 * iOS parity source: Core/MaterialRequestEmailBuilder.swift
 * Spec: docs/ios-parity/sections/16-job-tiles.md
 */

import { format } from 'date-fns'
import { escapeHtml } from '@/lib/security/htmlEscape'
import { quantityLabel, supplierGreeting } from '@/lib/materials/sendListLogic'

export type MaterialRequestLine = {
  material: string
  quantity: number
  unit: string
  brand?: string
  productCode?: string
  notes?: string
  lengthDisplay?: string
}

export type MaterialRequestEmailContext = {
  supplierName: string
  userName: string
  userEmail: string
  userPhone?: string | null
  userCompany: string
  jobNumber: string
  siteName?: string | null
  deliveryAddress?: string | null
  companyLogoURL?: string | null
  materials: MaterialRequestLine[]
  sentAt: Date
  /** Orders only. Quotes leave this empty — the template asks them to confirm time. */
  deliveryRequiredLabel?: string | null
}

function trim(value?: string | null): string {
  return (value || '').trim()
}

function formattedSentDate(date: Date): string {
  return format(date, "EEEE, d MMMM yyyy 'at' HH:mm")
}

function introFollowUp(isQuote: boolean, phone?: string | null): string {
  const trimmed = trim(phone)
  if (isQuote) {
    if (!trimmed) {
      return 'Once the quote is ready, please can you confirm lead times. Please note, this is only a quote request.'
    }
    const tel = trimmed.replace(/\s+/g, '')
    return `Once the quote is ready, please can you confirm lead times. Please note, this is only a quote request. <a href="tel:${escapeHtml(tel)}" class="mr-accent" style="color:#0369A1;text-decoration:none;font-weight:600;">${escapeHtml(trimmed)}</a>`
  }
  if (!trimmed) return 'Please confirm any long lead times before processing this order.'
  const tel = trimmed.replace(/\s+/g, '')
  return `Please confirm any long lead times before processing this order — <a href="tel:${escapeHtml(tel)}" class="mr-accent" style="color:#0369A1;text-decoration:none;font-weight:600;">${escapeHtml(trimmed)}</a>`
}

function contactPhoneHTML(phone?: string | null): string {
  const trimmed = trim(phone)
  if (!trimmed) return ''
  const tel = trimmed.replace(/\s+/g, '')
  return `<td class="mr-muted" style="font-size:13.5px;color:#475569;padding-right:14px;"><a class="mr-ink" href="tel:${escapeHtml(tel)}" style="color:#0b1220;text-decoration:none;font-weight:600;">📞&nbsp;${escapeHtml(trimmed)}</a></td>`
}

function companyLogoHeaderHTML(url?: string | null): string {
  const trimmed = trim(url)
  if (!trimmed) return ''
  return `<td align="right" style="vertical-align:middle;width:120px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" align="right"><tr><td bgcolor="#ffffff" style="padding:4px 6px;background-color:#ffffff;background-image:linear-gradient(#ffffff,#ffffff);border-radius:6px;"><img src="${escapeHtml(trimmed)}" alt="Company logo" width="96" height="40" style="display:block;max-width:96px;max-height:40px;width:auto;height:auto;margin-left:auto;border:0;outline:none;" /></td></tr></table></td>`
}

function itemsTableHTML(materials: MaterialRequestLine[], isQuote: boolean): string {
  const badge = isQuote ? { bg: '#e1f5ee', fg: '#0f6e56' } : { bg: '#e6f0fc', fg: '#185fa5' }
  if (materials.length === 0) {
    return `<tr><td class="mr-row mr-label" bgcolor="#ffffff" style="padding:14px 16px;background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#5B6B82;">(No materials listed)</td></tr>`
  }
  return materials
    .map((material) => {
      const name = escapeHtml(material.material)
      const manufacturer = escapeHtml(trim(material.brand) || '—')
      const part = trim(material.productCode)
      const partHTML = part
        ? ` · Part: <span class="mr-muted" style="color:#475569;font-weight:600;">${escapeHtml(part)}</span>`
        : ''
      const lengthSpec = trim(material.lengthDisplay)
      const lengthHTML = lengthSpec
        ? ` · Length: <span class="mr-muted" style="color:#475569;font-weight:600;">${escapeHtml(lengthSpec)}</span>`
        : ''
      const notes = trim(material.notes)
      const notesHTML = notes
        ? `<div class="mr-label" style="font-size:12.5px;color:#5B6B82;margin-top:3px;line-height:18px;font-style:italic;">${escapeHtml(notes)}</div>`
        : ''
      const qtyLabel = escapeHtml(quantityLabel(material.unit, material.quantity))
      return `<tr><td class="mr-row" bgcolor="#ffffff" style="padding:14px 16px;border-bottom:1px solid #eef1f6;background:#ffffff;background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="vertical-align:top;">
              <div class="mr-ink" style="font-size:15px;font-weight:700;color:#0b1220;line-height:20px;">${name}</div>
              <div class="mr-label" style="font-size:12.5px;color:#5B6B82;margin-top:3px;line-height:18px;">Manufacturer: <span class="mr-muted" style="color:#475569;font-weight:600;">${manufacturer}</span>${partHTML}${lengthHTML}</div>
              ${notesHTML}
            </td>
            <td align="right" style="vertical-align:top;padding-left:14px;white-space:nowrap;">
              <span style="display:inline-block;background:${badge.bg};color:${badge.fg};font-size:13px;font-weight:800;padding:6px 12px;border-radius:999px;">${material.quantity} ${qtyLabel}</span>
            </td>
          </tr>
        </table>
      </td></tr>`
    })
    .join('')
}

function brandMark(): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="vertical-align:middle;padding-right:11px;">
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" role="img" aria-label="Project Planner">
        <rect x="4" y="14" width="5" height="14" rx="1.3" fill="#0ea5e9"/>
        <rect x="11" y="9" width="5" height="19" rx="1.3" fill="#2563eb"/>
        <rect x="18" y="5" width="5" height="23" rx="1.3" fill="#60a5fa"/>
        <rect x="25" y="11" width="5" height="17" rx="1.3" fill="#0ea5e9"/>
      </svg>
    </td>
    <td style="vertical-align:middle;">
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:800;letter-spacing:.06em;color:#ffffff;line-height:1;">
        PROJECT <span style="color:#7DD3FC;">PLANNER</span>
      </div>
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;color:#9fb0c9;margin-top:4px;letter-spacing:.04em;">{{KIND}}</div>
    </td>
  </tr></table>`
}

export function quoteSubject(jobNumber: string, company: string): string {
  return `Quote request — ${jobNumber} — ${company}`
}

export function orderSubject(jobNumber: string, company: string): string {
  return `Material order request — ${jobNumber} — ${company}`
}

export function buildPlainTextEmail(context: MaterialRequestEmailContext, isQuote: boolean): string {
  const contact = trim(context.supplierName) || 'there'
  const phone = trim(context.userPhone)
  const address = trim(context.deliveryAddress)
  const siteName = trim(context.siteName)
  const lead = isQuote
    ? 'Can I get a quote for the items below?'
    : 'Please can I place an order for the items below?'
  const confirm = isQuote
    ? phone
      ? `Once the quote is ready, please can you confirm lead times. Please note, this is only a quote request. My number is ${phone}.`
      : 'Once the quote is ready, please can you confirm lead times. Please note, this is only a quote request.'
    : phone
      ? `Please confirm any long lead times before processing this order. My number is ${phone}.`
      : 'Please confirm any long lead times before processing this order.'
  const materialLines =
    context.materials.length === 0
      ? '- (No materials listed)'
      : context.materials
          .map((item, index) => {
            const qty = `${item.quantity} ${quantityLabel(item.unit, item.quantity)}`
            const details = [
              trim(item.brand) ? `Brand: ${trim(item.brand)}` : '',
              trim(item.productCode) ? `Code: ${trim(item.productCode)}` : '',
              trim(item.lengthDisplay) ? `Length: ${trim(item.lengthDisplay)}` : '',
              trim(item.notes) ? `Details: ${trim(item.notes)}` : '',
            ].filter(Boolean)
            const prefix = `${index + 1}. ${item.material} — qty ${qty}`
            return details.length ? `${prefix}\n   ${details.join('; ')}` : prefix
          })
          .join('\n')
  let siteLine = 'Site address: (not set)'
  if (address && siteName) siteLine = `Site: ${siteName}\nSite address: ${address}`
  else if (address) siteLine = `Site address: ${address}`
  else if (siteName) siteLine = `Site: ${siteName}`
  const thankYou = isQuote
    ? 'Thank you for taking the time to quote these materials.'
    : 'Thank you for processing this order.'
  const required = !isQuote ? trim(context.deliveryRequiredLabel) : ''
  const requiredLines = required ? [`Required delivery: ${required}`, ''] : []

  return [
    `Hi ${contact},`,
    '',
    lead,
    '',
    siteLine,
    '',
    ...requiredLines,
    confirm,
    '',
    `Job number: ${context.jobNumber}`,
    '',
    'Material list:',
    materialLines,
    '',
    thankYou,
    '',
    `${context.userName} via Project Planner`,
  ].join('\n')
}

export function plainTextAsSimpleHTML(plainText: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<style>
  :root{color-scheme:light dark;supported-color-schemes:light dark;}
  @media (prefers-color-scheme: dark){
    body, .pt-page{background:#0E1A2E!important;background-color:#0E1A2E!important;}
    .pt-ink{color:#E6EDF6!important;}
  }
</style>
<style>
  [data-ogsc] .pt-ink{color:#E6EDF6!important;}
  [data-ogsb] .pt-page{background-color:#0E1A2E!important;}
</style>
</head>
<body class="pt-page" bgcolor="#ffffff" style="margin:0;padding:20px;background:#ffffff;background-color:#ffffff;">
<pre class="pt-ink" style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111111;white-space:pre-wrap;word-wrap:break-word;">${escapeHtml(plainText)}</pre>
</body>
</html>`
}

export function buildStyledEmail(context: MaterialRequestEmailContext, isQuote: boolean): string {
  const supplier = trim(context.supplierName) || 'there'
  const itemCount = context.materials.length
  const itemCountLabel = itemCount === 1 ? 'item' : 'items'
  const siteName = trim(context.siteName)
  const siteSuffix = siteName
    ? ` · <span class="mr-muted" style="font-weight:600;color:#475569;">${escapeHtml(siteName)}</span>`
    : ''
  const jobPanelValue = `${escapeHtml(context.jobNumber)}${siteSuffix}`
  const jobHeaderPill = isQuote
    ? `Job (${escapeHtml(context.jobNumber)})`
    : `JOB · ${escapeHtml(context.jobNumber)}`
  const pillBg = isQuote ? '#0369A1' : '#C2410C'
  const kind = isQuote ? 'Material quote request' : 'Material order request'
  const headline = isQuote
    ? 'Can I get a quote for the items below?'
    : 'Please can I place an order for the items below?'
  const itemsLabel = isQuote ? 'Items to price' : 'Materials requested'
  const signOff = isQuote
    ? 'Thank you for taking the time to quote these materials.'
    : 'Thank you for processing this order.'
  const preheader = isQuote
    ? `Quote request from ${escapeHtml(context.userName)} (${escapeHtml(context.userCompany)}) for job ${escapeHtml(context.jobNumber)} — pricing & lead time please.`
    : `Order request from ${escapeHtml(context.userName)} (${escapeHtml(context.userCompany)}) for job ${escapeHtml(context.jobNumber)} — please confirm availability and delivery.`
  const address = trim(context.deliveryAddress)
  const secondPanel = isQuote
    ? `<td class="stack stack-pad mr-panel" bgcolor="#f5f8fc" width="50%" style="padding:16px 18px;background-color:#f5f8fc;vertical-align:top;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <div class="mr-label" style="font-size:11px;font-weight:700;letter-spacing:.08em;color:#5B6B82;text-transform:uppercase;">Company</div>
        <div class="mr-ink" style="font-size:14px;color:#0b1220;margin-top:4px;line-height:20px;font-weight:700;">${escapeHtml(context.userCompany)}</div>
      </td>`
    : `<td class="stack stack-pad mr-panel" bgcolor="#f5f8fc" width="50%" style="padding:16px 18px;background-color:#f5f8fc;vertical-align:top;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <div class="mr-label" style="font-size:11px;font-weight:700;letter-spacing:.08em;color:#5B6B82;text-transform:uppercase;">Deliver to</div>
        <div class="mr-ink" style="font-size:14px;color:#0b1220;margin-top:4px;line-height:20px;font-weight:600;">${escapeHtml(address)}</div>
      </td>`
  const requiredLabel = !isQuote ? trim(context.deliveryRequiredLabel) : ''
  const requiredPanel = requiredLabel
    ? `<tr><td class="px mr-card" bgcolor="#ffffff" style="background-color:#ffffff;padding:10px 32px 0 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="mr-panel-green" bgcolor="#eef8f4" style="background:#eef8f4;background-color:#eef8f4;border:1px solid #cce8dc;border-radius:12px;border-collapse:separate;">
          <tr><td class="mr-panel-green" bgcolor="#eef8f4" style="padding:16px 18px;background-color:#eef8f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            <div class="mr-green" style="font-size:11px;font-weight:700;letter-spacing:.08em;color:#0f6e56;text-transform:uppercase;">Required delivery</div>
            <div class="mr-ink" style="font-size:16px;color:#0b1220;margin-top:4px;line-height:22px;font-weight:800;">${escapeHtml(requiredLabel)}</div>
          </td></tr>
        </table>
      </td></tr>`
    : ''
  const quoteDeliver =
    isQuote && address
      ? `<tr><td class="px mr-card" bgcolor="#ffffff" style="background-color:#ffffff;padding:10px 32px 0 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="mr-panel" bgcolor="#f5f8fc" style="background:#f5f8fc;background-color:#f5f8fc;border:1px solid #e3e8ef;border-radius:12px;border-collapse:separate;">
          <tr><td class="mr-panel" bgcolor="#f5f8fc" style="padding:16px 18px;background-color:#f5f8fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            <div class="mr-label" style="font-size:11px;font-weight:700;letter-spacing:.08em;color:#5B6B82;text-transform:uppercase;">Deliver to</div>
            <div class="mr-ink" style="font-size:14px;color:#0b1220;margin-top:4px;line-height:20px;font-weight:600;">${escapeHtml(address)}</div>
          </td></tr>
        </table>
      </td></tr>`
      : ''

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<title>${isQuote ? 'Quote request' : 'Material order request'}</title>
<style type="text/css">
  :root{color-scheme:light dark;supported-color-schemes:light dark;}
  body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
  table,td{mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;}
  body{margin:0;padding:0;width:100%!important;background:#eef2f7;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;}
  @media only screen and (max-width:620px) {
    .container{width:100%!important;}
    .px{padding-left:22px!important;padding-right:22px!important;}
    .stack{display:block!important;width:100%!important;box-sizing:border-box!important;}
    .stack-pad{padding:10px 0 0 0!important;}
  }
  @media (prefers-color-scheme: dark){
    body, .mr-page{background:#050B16!important;background-color:#050B16!important;}
    .mr-card, .mr-row{background:#0E1A2E!important;background-color:#0E1A2E!important;}
    .mr-row{border-color:#1E3354!important;}
    .mr-panel{background:#0A1628!important;background-color:#0A1628!important;border-color:#1E3354!important;}
    .mr-panel-green{background:#0B2620!important;background-color:#0B2620!important;border-color:#14532D!important;}
    .mr-ink{color:#E6EDF6!important;}
    .mr-muted{color:#B6C2D2!important;}
    .mr-label{color:#94A3B8!important;}
    .mr-accent{color:#7DD3FC!important;}
    .mr-green{color:#6EE7B7!important;}
  }
</style>
<style type="text/css">
  [data-ogsc] .mr-ink{color:#E6EDF6!important;}
  [data-ogsc] .mr-muted{color:#B6C2D2!important;}
  [data-ogsc] .mr-label{color:#94A3B8!important;}
  [data-ogsc] .mr-accent{color:#7DD3FC!important;}
  [data-ogsc] .mr-green{color:#6EE7B7!important;}
  [data-ogsb] .mr-page{background-color:#050B16!important;}
  [data-ogsb] .mr-card, [data-ogsb] .mr-row{background-color:#0E1A2E!important;}
  [data-ogsb] .mr-panel{background-color:#0A1628!important;}
  [data-ogsb] .mr-panel-green{background-color:#0B2620!important;}
</style>
</head>
<body class="body mr-page" bgcolor="#eef2f7" style="margin:0;padding:0;background:#eef2f7;background-color:#eef2f7;">
<div style="display:none;font-size:1px;color:#eef2f7;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</div>
<table role="presentation" class="mr-page" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#eef2f7" style="background:#eef2f7;background-color:#eef2f7;">
  <tr><td class="mr-page" align="center" bgcolor="#eef2f7" style="padding:24px 12px;background-color:#eef2f7;">
    <table role="presentation" class="container mr-card" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:600px;max-width:600px;background:#ffffff;background-color:#ffffff;border-radius:14px;overflow:hidden;">
      <tr><td bgcolor="#0b1220" style="background:#0b1220;background-color:#0b1220;padding:22px 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="left" style="vertical-align:middle;">
              <span style="display:inline-block;background:${pillBg};color:#ffffff;font-size:11px;font-weight:800;letter-spacing:.08em;padding:6px 12px;border-radius:999px;">${jobHeaderPill}</span>
            </td>
            ${companyLogoHeaderHTML(context.companyLogoURL)}
          </tr>
          <tr><td colspan="2" style="padding-top:14px;">${brandMark().replace('{{KIND}}', kind)}</td></tr>
        </table>
      </td></tr>
      <tr><td class="px mr-card" bgcolor="#ffffff" style="background-color:#ffffff;padding:30px 32px 8px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <p class="mr-muted" style="margin:0 0 6px 0;font-size:15px;color:#475569;">Hi ${escapeHtml(supplier)},</p>
        <h1 class="mr-ink" style="margin:6px 0 12px 0;font-size:26px;line-height:32px;font-weight:800;color:#0b1220;">${headline}</h1>
        <p class="mr-muted" style="margin:0;font-size:15px;line-height:22px;color:#475569;">${introFollowUp(isQuote, context.userPhone)}</p>
      </td></tr>
      <tr><td class="px mr-card" bgcolor="#ffffff" style="background-color:#ffffff;padding:22px 32px 6px 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="mr-panel" bgcolor="#f5f8fc" style="background:#f5f8fc;background-color:#f5f8fc;border:1px solid #e3e8ef;border-radius:12px;border-collapse:separate;">
          <tr>
            <td class="stack mr-panel" bgcolor="#f5f8fc" width="50%" style="padding:16px 18px;background-color:#f5f8fc;vertical-align:top;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;border-right:1px solid #e3e8ef;">
              <div class="mr-label" style="font-size:11px;font-weight:700;letter-spacing:.08em;color:#5B6B82;text-transform:uppercase;">Job name and reference</div>
              <div class="mr-ink" style="font-size:17px;font-weight:800;color:#0b1220;margin-top:4px;">${jobPanelValue}</div>
            </td>
            ${secondPanel}
          </tr>
        </table>
      </td></tr>
      ${requiredPanel}
      ${quoteDeliver}
      <tr><td class="px mr-card" bgcolor="#ffffff" style="background-color:#ffffff;padding:22px 32px 10px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td class="mr-accent" align="left" style="font-size:12px;font-weight:700;letter-spacing:.08em;color:#0369A1;text-transform:uppercase;">${itemsLabel}</td>
          <td class="mr-label" align="right" style="font-size:12px;color:#5B6B82;font-weight:600;">${itemCount} ${itemCountLabel}</td>
        </tr></table>
      </td></tr>
      <tr><td class="px mr-card" bgcolor="#ffffff" style="background-color:#ffffff;padding:0 32px 6px 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e3e8ef;border-radius:12px;overflow:hidden;">
          <tr><td bgcolor="#0b1220" style="background:#0b1220;background-color:#0b1220;padding:11px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
              <td style="font-size:11px;font-weight:700;letter-spacing:.08em;color:#ffffff;text-transform:uppercase;">Item</td>
              <td align="right" style="font-size:11px;font-weight:700;letter-spacing:.08em;color:#ffffff;text-transform:uppercase;">Qty</td>
            </tr></table>
          </td></tr>
          ${itemsTableHTML(context.materials, isQuote)}
        </table>
      </td></tr>
      <tr><td class="px mr-card" bgcolor="#ffffff" style="background-color:#ffffff;padding:28px 32px 10px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <p class="mr-muted" style="margin:0 0 18px 0;font-size:15px;color:#475569;line-height:22px;">${signOff}</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="mr-panel" bgcolor="#f5f8fc" style="background:#f5f8fc;background-color:#f5f8fc;border:1px solid #e3e8ef;border-radius:12px;border-collapse:separate;">
          <tr><td class="mr-panel" bgcolor="#f5f8fc" style="padding:18px 20px;background-color:#f5f8fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            <div class="mr-label" style="font-size:11px;font-weight:700;letter-spacing:.08em;color:#5B6B82;text-transform:uppercase;margin-bottom:8px;">Kind regards</div>
            <div class="mr-ink" style="font-size:17px;font-weight:800;color:#0b1220;line-height:22px;">${escapeHtml(context.userName)} <span class="mr-muted" style="font-size:13.5px;font-weight:600;color:#475569;">via Project Planner</span></div>
            <div class="mr-muted" style="font-size:13.5px;color:#475569;margin-top:2px;line-height:20px;">${escapeHtml(context.userCompany)}</div>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;"><tr>
              ${contactPhoneHTML(context.userPhone)}
              <td class="mr-muted" style="font-size:13.5px;color:#475569;">
                <a class="mr-ink" href="mailto:${escapeHtml(context.userEmail)}" style="color:#0b1220;text-decoration:none;font-weight:600;">✉&nbsp;${escapeHtml(context.userEmail)}</a>
              </td>
            </tr></table>
          </td></tr>
        </table>
      </td></tr>
      <tr><td bgcolor="#0ea5e9" style="height:4px;background:#0ea5e9;font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td bgcolor="#0b1220" style="background:#0b1220;background-color:#0b1220;padding:20px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <div style="font-size:11px;color:#9fb0c9;line-height:17px;">
          Sent ${escapeHtml(formattedSentDate(context.sentAt))} via <a href="https://projectplanner.us" style="color:#7DD3FC;text-decoration:none;font-weight:700;">Project Planner</a><br>
          <span style="color:#9fb0c9;">Replies route directly to ${escapeHtml(context.userName)} at ${escapeHtml(context.userEmail)}.</span>
        </div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`
}

export function buildMaterialRequestEmail(params: {
  context: MaterialRequestEmailContext
  isQuote: boolean
  sendAsPlainText: boolean
  contactName: string
}): { subject: string; html: string } {
  const greeting = supplierGreeting(params.contactName, params.sendAsPlainText)
  const context = { ...params.context, supplierName: greeting }
  const subject = params.isQuote
    ? quoteSubject(params.context.jobNumber, params.context.userCompany)
    : orderSubject(params.context.jobNumber, params.context.userCompany)
  if (params.sendAsPlainText) {
    return { subject, html: plainTextAsSimpleHTML(buildPlainTextEmail(context, params.isQuote)) }
  }
  return { subject, html: buildStyledEmail(context, params.isQuote) }
}
