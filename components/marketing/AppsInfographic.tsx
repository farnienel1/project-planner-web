'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { MODULES } from '@/lib/marketing/content'
import { ICON_PATHS } from '@/components/marketing/icons'
import { MktIcon } from '@/components/marketing/icons'

const APPS: [string, string, string][] = [
  ['Outlook calendar', 'cal', '#2F74DA'],
  ['Excel sheets', 'grid', '#0E9467'],
  ['OneNote', 'note', '#8540DA'],
  ['Word documents', 'file', '#1E5AA8'],
  ['WhatsApp groups', 'chat', '#1A9444'],
  ['Google Sheets', 'grid', '#0B8E80'],
  ['Email chains', 'mail', '#D96F0C'],
  ['Paper timesheets', 'clock', '#B87700'],
  ['Shared drives', 'drive', '#3D56D1'],
  ['Text messages', 'phone', '#CC336C'],
  ['Teams chat', 'users', '#6A45E6'],
  ['Sticky notes', 'sticky', '#DB4A2E'],
]

export function AppsInfographic() {
  const ref = useRef<HTMLDivElement>(null)
  const W = 1160
  const H = 560
  const cx = W / 2
  const ly = 372
  const cols = 6
  const cw = 176
  const ch = 58
  const gx = (W - cols * cw) / (cols + 1)
  const pos = APPS.map((app, i) => {
    const r = Math.floor(i / cols)
    const c = i % cols
    const x = gx + c * (cw + gx)
    const y = 18 + r * (ch + 26)
    return { app, x, y, bx: x + cw / 2, by: y + ch }
  })
  const paths = pos.map(
    (p) => `M${p.bx},${p.by} C${p.bx},${p.by + 110} ${cx},${ly - 150} ${cx},${ly - 58}`
  )

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      el.classList.add('vis')
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('vis')
            io.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.2 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div className="infog reveal" ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="igT igD" preserveAspectRatio="xMidYMid meet">
        <title id="igT">Twelve separate apps replaced by Project Planner</title>
        <desc id="igD">
          Outlook calendar, Excel, OneNote, Word, WhatsApp groups, Google Sheets, email, paper timesheets, shared
          drives, text messages, Teams chat and sticky notes all flow into one Project Planner platform.
        </desc>
        <defs>
          <linearGradient id="igL" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#0C2350" />
            <stop offset="1" stopColor="#2F74DA" />
          </linearGradient>
          <linearGradient id="igF" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8391A7" stopOpacity=".35" />
            <stop offset="1" stopColor="#2F74DA" stopOpacity=".9" />
          </linearGradient>
          <filter id="igS" x="-20%" y="-20%" width="140%" height="160%">
            <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#0C2350" floodOpacity=".14" />
          </filter>
        </defs>
        {paths.map((d, i) => (
          <g key={`flow-${i}`}>
            <path
              d={d}
              fill="none"
              stroke="url(#igF)"
              strokeWidth="2"
              className="ig-flow"
              style={{ animationDelay: `${-(i * 0.17).toFixed(2)}s` }}
            />
            <circle r="4" fill={pos[i].app[2]}>
              <animateMotion
                dur={`${(2.6 + (i % 4) * 0.35).toFixed(2)}s`}
                repeatCount="indefinite"
                begin={`${(i * 0.21).toFixed(2)}s`}
                path={d}
              />
            </circle>
          </g>
        ))}
        {pos.map((p) => (
          <g key={p.app[0]}>
            <g filter="url(#igS)">
              <rect x={p.x} y={p.y} width={cw} height={ch} rx="16" fill="var(--card)" />
            </g>
            <rect x={p.x + 10} y={p.y + 11} width="36" height="36" rx="11" fill={p.app[2]} opacity=".14" />
            <g
              transform={`translate(${p.x + 18},${p.y + 19}) scale(.83)`}
              stroke={p.app[2]}
              fill="none"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              dangerouslySetInnerHTML={{ __html: ICON_PATHS[p.app[1]] || ICON_PATHS.file }}
            />
            <text x={p.x + 54} y={p.y + 34} fontFamily="Inter,sans-serif" fontSize="12.5" fontWeight="700" fill="var(--ink)">
              {p.app[0]}
            </text>
            <line
              x1={p.x + 52}
              y1={p.y + 30}
              x2={p.x + 56 + p.app[0].length * 6.7}
              y2={p.y + 30}
              stroke="var(--red)"
              strokeOpacity=".8"
              strokeWidth="2"
              className="ig-strike"
            />
          </g>
        ))}
        <g filter="url(#igS)">
          <rect x={cx - 58} y={ly - 58} width="116" height="116" rx="32" fill="url(#igL)" />
        </g>
        <g transform={`translate(${cx - 29},${ly - 29}) scale(2.9)`}>
          <rect x="2" y="10" width="4" height="8" rx="1.5" fill="#fff" opacity=".65" />
          <rect x="8" y="6" width="4" height="12" rx="1.5" fill="#fff" opacity=".85" />
          <rect x="14" y="2" width="4" height="16" rx="1.5" fill="#fff" />
        </g>
        <circle cx={cx} cy={ly} r="76" fill="none" stroke="#2F74DA" strokeOpacity=".35" strokeDasharray="4 7" className="ig-ring" />
        <text
          x={cx}
          y={ly + 104}
          textAnchor="middle"
          fontFamily="'Plus Jakarta Sans',Inter,sans-serif"
          fontSize="30"
          fontWeight="800"
          fill="var(--ink)"
          letterSpacing="-.5"
        >
          Project Planner
        </text>
        <text x={cx} y={ly + 132} textAnchor="middle" fontFamily="Inter,sans-serif" fontSize="15" fill="var(--ink2)">
          One login. Every job, operative, hour and signature.
        </text>
      </svg>
      <div className="row wr" style={{ justifyContent: 'center', gap: 10, marginTop: 6 }}>
        {MODULES.map((mod) => (
          <Link key={mod.id} href={`/features/${mod.id}`} className="pill" data-hue={mod.hue} style={{ height: 34, padding: '0 14px' }}>
            <MktIcon name={mod.icon} size={15} />
            {mod.name}
          </Link>
        ))}
      </div>
    </div>
  )
}
