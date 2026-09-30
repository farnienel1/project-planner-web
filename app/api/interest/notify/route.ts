import { NextRequest, NextResponse } from 'next/server'
import { sendProjectPlannerEmail } from '@/lib/email/resendClient'
import { enforceRateLimit, jsonError, readJsonBody } from '@/lib/security/apiGuard'
const SUPPORT_EMAIL = 'support@projectplanner.us'

export const runtime = 'nodejs'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function clip(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, 'interest-notify', 8, 60 * 60 * 1000)
  if (limited) return limited
  const body = await readJsonBody<Record<string, unknown>>(request)
  if (!body.ok) return body.response
  if (clip(body.value.website, 200)) {
    return NextResponse.json({ ok: true })
  }
  const firstName = clip(body.value.firstName, 99)
  const company = clip(body.value.company, 199)
  const email = clip(body.value.email, 199).toLowerCase()
  const teamSize = clip(body.value.teamSize, 39) || 'team size not given'
  if (!firstName || !company || !EMAIL.test(email)) {
    return jsonError('That registration could not be emailed.', 400)
  }
  const lastName = clip(body.value.lastName, 99)
  const phone = clip(body.value.phone, 39)
  const role = clip(body.value.role, 79)
  const sectors = Array.isArray(body.value.sectors) ? body.value.sectors.filter((row) => typeof row === 'string').join(', ') : ''
  const currentTools = clip(body.value.currentTools, 79)
  const message = clip(body.value.message, 2000)
  const source = clip(body.value.source, 79) || 'direct'
  const campaign = clip(body.value.campaign, 119)

  const ownerHtml = `
    <p><strong>${escapeHtml(firstName)} ${escapeHtml(lastName)}</strong> at ${escapeHtml(company)} registered interest.</p>
    <p>Role: ${escapeHtml(role || 'not given')}<br/>
    Team size: ${escapeHtml(teamSize)}<br/>
    Email: ${escapeHtml(email)}<br/>
    Phone: ${escapeHtml(phone || 'not given')}<br/>
    Sectors: ${escapeHtml(sectors || 'not given')}<br/>
    Currently using: ${escapeHtml(currentTools || 'not given')}<br/>
    Source: ${escapeHtml(source)}${campaign ? ` / ${escapeHtml(campaign)}` : ''}</p>
    <p>${escapeHtml(message || 'No message.')}</p>
  `

  const ackHtml = `
    <p>Hello ${escapeHtml(firstName)},</p>
    <p>You're on the list. We'll email you when Project Planner opens, and ${escapeHtml(company)} will be in the first group through the door.</p>
    <p>What happens next:</p>
    <p>1. The odd short update as we finish building. No spam, no newsletter.<br/>
    2. An invite before it goes public, with a free trial.<br/>
    3. A setup call so you start with your own jobs and people in it.</p>
    <p>If you need us before then, reply to this email or write to support@projectplanner.us.</p>
    <p>Project Planner</p>
  `

  await sendProjectPlannerEmail({
    to: SUPPORT_EMAIL,
    subject: `New interest — ${company} (${teamSize} on the tools)`,
    html: ownerHtml,
    replyTo: email,
  })
  await sendProjectPlannerEmail({
    to: email,
    subject: "You're on the Project Planner list",
    html: ackHtml,
    replyTo: SUPPORT_EMAIL,
  })
  return NextResponse.json({ ok: true })
}
