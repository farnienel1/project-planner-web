/**
 * Demo snapshots: focused HTML redraws of real Project Planner screens for the
 * marketing site. Same layout, labels and colours as the app, enlarged and cropped
 * to what matters. Demo company: Northgate M&E. No real customer data.
 * Styles: app/marketing.css (the "Demo snapshots" block, ds-* classes).
 */

import type { CSSProperties } from 'react'
import { MktIcon } from '@/components/marketing/icons'

function Bars({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden>
      <rect x="2" y="10" width="4" height="8" rx="1.5" fill="#fff" opacity=".65" />
      <rect x="8" y="6" width="4" height="12" rx="1.5" fill="#fff" opacity=".85" />
      <rect x="14" y="2" width="4" height="16" rx="1.5" fill="#fff" />
    </svg>
  )
}

function Av({ initials, tone = '' }: { initials: string; tone?: '' | 'g' | 'r' | 'p' }) {
  return <span className={`ds-av ${tone}`.trim()}>{initials}</span>
}

const SIDE: ReadonlyArray<[string, string]> = [
  ['sun', 'Daily Overview'],
  ['folder', 'Projects'],
  ['wrench', 'Small Works'],
  ['hardhat', 'Operatives'],
  ['report', 'Weekly Report'],
  ['cal', 'My Schedule'],
  ['clock', 'Timesheets'],
  ['alert', 'Warnings'],
  ['list', 'Tasks'],
  ['shield', 'Site audit'],
]

/** Home dashboard (hero). */
export function DashboardSnap() {
  return (
    <div className="ds-snap" role="img" aria-label="Project Planner home dashboard">
      <div className="ds-bar">
        <span className="ds-crumb">
          Northgate M&amp;E &nbsp;/&nbsp; <b>Home</b>
        </span>
        <span className="ds-search">
          <MktIcon name="search" size={13} />
          <span>Search projects, people, pages</span>
          <kbd>⌘K</kbd>
        </span>
        <span className="ds-new">
          <MktIcon name="plus" size={11} />
          New
        </span>
        <Av initials="DM" />
      </div>
      <div className="ds-body">
        <div className="ds-side">
          <div className="ds-org">
            <i>
              <Bars />
            </i>
            <div>
              <b>Project Planner</b>
              <span>Northgate M&amp;E</span>
            </div>
          </div>
          <span className="ds-nav on">
            <MktIcon name="home" size={14} />
            Home
          </span>
          <span className="ds-lbl">Navigate</span>
          {SIDE.map(([icon, label]) => (
            <span key={label} className="ds-nav">
              <MktIcon name={icon} size={14} />
              {label}
            </span>
          ))}
        </div>
        <div className="ds-main">
          <div className="ds-hero">
            <div className="ds-eb">Monday 12 Oct</div>
            <div className="ds-big">Hi, Dave</div>
            <div className="ds-sub">11 active projects</div>
            <div className="ds-sts">
              <div className="ds-st">
                <b>3</b>
                <span>Tasks Due Today</span>
              </div>
              <div className="ds-st">
                <b>8</b>
                <span>Tasks Due This Week</span>
              </div>
              <div className="ds-st">
                <b>17</b>
                <span>Warnings</span>
              </div>
            </div>
            <div className="ds-hacts">
              <span className="w">
                <MktIcon name="plus" size={11} />
                Book labour
              </span>
              <span>Daily Overview</span>
              <span>Weekly Report</span>
            </div>
          </div>
          <div className="ds-row2">
            <div className="ds-card ds-stat">
              <span className="ds-ico warn">
                <MktIcon name="alert" size={16} />
              </span>
              <div>
                <b>17 active</b>
                <span>Warnings</span>
              </div>
            </div>
            <div className="ds-card ds-stat">
              <span className="ds-ico">
                <MktIcon name="list" size={16} />
              </span>
              <div>
                <b>5 pending</b>
                <span>Tasks</span>
              </div>
            </div>
          </div>
          <div className="ds-sec">
            Quick actions <span>Customise</span>
          </div>
          <div className="ds-qa">
            {(
              [
                ['report', 'Weekly Report'],
                ['sun', 'Daily Overview'],
                ['folder', 'Projects'],
                ['wrench', 'Small Works'],
              ] as const
            ).map(([icon, label]) => (
              <div key={label}>
                <span className="ds-ico">
                  <MktIcon name={icon} size={16} />
                </span>
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function FloatCard({
  icon,
  tint,
  title,
  sub,
  style,
}: {
  icon: string
  tint: string
  title: string
  sub: string
  style: CSSProperties
}) {
  return (
    <div className="ds-float" style={style}>
      <i style={{ color: tint }}>
        <MktIcon name={icon} size={16} />
      </i>
      <div>
        <b>{title}</b>
        <span>{sub}</span>
      </div>
    </div>
  )
}

/** Hero: dashboard snapshot with two floating notifications. */
export function HeroSnapshot() {
  return (
    <div className="ds-heroshot">
      <DashboardSnap />
      <FloatCard
        icon="cert"
        tint="#D23636"
        title="Qualification expired"
        sub="Mia Reid · SMSTS · 16 days ago"
        style={{ right: -18, top: 132 }}
      />
      <FloatCard
        icon="check"
        tint="#0E9467"
        title="Timesheet signed"
        sub="40h + 3h OT · ready for payroll"
        style={{ left: -26, bottom: -16, animationDelay: '-2.5s' }}
      />
    </div>
  )
}

/** Warnings page: high / medium / low, an expired qualification and unbooked labour. */
export function WarningsSnap() {
  return (
    <div className="ds-snap" role="img" aria-label="Warnings page sorted into high, medium and low">
      <div className="ds-main">
        <div className="ds-hero red">
          <div className="ds-eb">Active issues</div>
          <div className="ds-big">17 need attention</div>
          <div className="ds-sub">
            High: clashes, unbooked labour &amp; leave clashes · Medium: manager overlaps · Low: materials and
            qualifications
          </div>
          <div className="ds-sts">
            <div className="ds-st">
              <b>14</b>
              <span>High</span>
            </div>
            <div className="ds-st">
              <b>0</b>
              <span>Medium</span>
            </div>
            <div className="ds-st">
              <b>3</b>
              <span>Low</span>
            </div>
          </div>
        </div>
        <div className="ds-chips">
          <span className="ds-chip on">All · 17</span>
          <span className="ds-chip">Clashes · 0</span>
          <span className="ds-chip">Unbooked · 14</span>
          <span className="ds-chip">Materials · 0</span>
          <span className="ds-chip">Qualifications · 3</span>
        </div>
        <div className="ds-card ds-wcard">
          <div className="h">
            <span className="ds-ico red sm">
              <MktIcon name="cert" size={14} />
            </span>
            Qualification expired
            <span className="ds-pill low">Low</span>
          </div>
          <div>Mia Reid&apos;s SMSTS expired 16 days ago</div>
          <div className="ds-btns">
            <span>Dismiss</span>
            <span className="b">Open operative</span>
          </div>
        </div>
        <div className="ds-card ds-wcard">
          <div className="h">
            <span className="ds-ico warn sm">
              <MktIcon name="alert" size={14} />
            </span>
            Unbooked labour
            <span className="ds-pill high">High</span>
          </div>
          <div className="ds-muted">
            2 people are not booked on <b>Tue 13 October</b>.
          </div>
          <div className="ds-person">
            <Av initials="SB" tone="g" />
            <div>
              <b>Sam Belfort</b>
              <span>Electrician · unbooked</span>
            </div>
            <span className="ds-hrs">−8h</span>
          </div>
          <div className="ds-person">
            <Av initials="MR" tone="r" />
            <div>
              <b>Mia Reid</b>
              <span>Electrician · unbooked</span>
            </div>
            <span className="ds-hrs">−8h</span>
          </div>
          <div className="ds-btns">
            <span className="b">Book labour for this day</span>
            <span>Open daily overview</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function HsHeader({ tab }: { tab: 'Library' | 'Tracking' }) {
  return (
    <>
      <div className="ds-hero blue compact">
        <div className="ds-big">Health &amp; Safety</div>
        <div className="ds-sub">C984 · 71 Broadwick Street</div>
      </div>
      <div className="ds-tabs">
        {['Hub', 'Library', 'Tracking', 'RAMS', 'Other'].map((name) => (
          <span key={name} className={name === tab ? 'on' : undefined}>
            {name}
          </span>
        ))}
      </div>
    </>
  )
}

const TRACKING: ReadonlyArray<{ title: string; issued: string; signed: number; total: number; note?: string }> = [
  { title: 'Working at Height — Ladders & Podiums', issued: 'Issued 5 Oct 2026 · W/C 5 Oct', signed: 9, total: 11 },
  { title: 'Safe Isolation (Lock Off, Prove Dead)', issued: 'Issued 5 Oct 2026 · W/C 5 Oct', signed: 11, total: 11 },
  { title: 'COSHH — Hazardous Substances', issued: 'Issued 28 Sep 2026 · W/C 28 Sep', signed: 5, total: 8, note: '3 to chase' },
]

/** H&S: tracking in front, the talk library behind. */
export function HsSnap() {
  return (
    <div className="ds-stack">
      <div className="ds-snap back" aria-hidden>
        <div className="ds-main">
          <HsHeader tab="Library" />
          <div className="ds-chips">
            <span className="ds-chip teal">All</span>
            <span className="ds-chip">General</span>
            <span className="ds-chip">Electrical</span>
            <span className="ds-chip">Plumbing &amp; Gas</span>
            <span className="ds-chip">Groundworks</span>
          </div>
          <div className="ds-card">
            {['Asbestos Awareness', 'COSHH — Hazardous Substances', 'Confined Spaces Awareness'].map((title) => (
              <div key={title} className={`ds-lib${title.startsWith('COSHH') ? ' hl' : ''}`}>
                <div>
                  <b>{title}</b>
                  <span>General · General</span>
                </div>
                <div className="acts">
                  <i>View</i>
                  <i className="b">Issue</i>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="ds-snap front" role="img" aria-label="Health and safety signature tracking">
        <div className="ds-main">
          <HsHeader tab="Tracking" />
          {TRACKING.map((row, index) => {
            const pct = Math.round((row.signed / row.total) * 100)
            return (
              <div key={row.title} className="ds-card ds-trk">
                <div className="t">
                  {row.title}
                  <em>{pct}%</em>
                </div>
                <div className="m">{row.issued}</div>
                <div className="ds-prog">
                  <i style={{ width: `${pct}%` }} />
                </div>
                <div className="ds-signed">
                  {row.signed}/{row.total} signed{row.note ? ` · ${row.note}` : ''}
                  {index === 0 && (
                    <span className="avs">
                      <Av initials="DM" />
                      <Av initials="SB" tone="g" />
                      <Av initials="MR" tone="r" />
                      <Av initials="JB" tone="p" />
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/** Step 1: Add material sheet with the catalogue search open. */
export function AddMaterialSnap() {
  return (
    <div className="ds-sheet" role="img" aria-label="Add material: searching the catalogue for 2.5mm twin and earth">
      <div className="ds-sh">
        Add material<span className="lnk">Cancel</span>
      </div>
      <div className="ds-sb">
        <div>
          <div className="ds-fl">Search catalogue</div>
          <div className="ds-in focus">2.5mm twin</div>
        </div>
        <div className="ds-drop">
          <small>2 MATCHES</small>
          <div className="hl">
            2.5mm² Twin &amp; Earth 6242B LSZH (100m Drum)
            <span>Prysmian · Cable · Catalogue</span>
          </div>
          <div>
            2.5mm² Twin &amp; Earth 6242Y PVC Grey (100m Drum)
            <span>Prysmian · Cable · Catalogue</span>
          </div>
        </div>
        <div className="ds-two">
          <div>
            <div className="ds-fl">Quantity</div>
            <div className="ds-in">2</div>
          </div>
          <div>
            <div className="ds-fl">Unit</div>
            <div className="ds-in">Drums</div>
          </div>
        </div>
        <div className="ds-fbtn">
          <span className="p">Add material</span>
          <span className="g">Cancel</span>
        </div>
      </div>
    </div>
  )
}

/** Step 2: Send list with a wholesaler contact ticked. */
export function SendListSnap() {
  return (
    <div className="ds-sheet" role="img" aria-label="Send list: pick the wholesaler, then quote, order or send via WhatsApp">
      <div className="ds-sh">
        <span className="lnk">Cancel</span>
        Send list
        <span style={{ width: 38 }} />
      </div>
      <div className="ds-sb">
        <div className="ds-grp">
          <div>
            <div>
              <b>
                <span className="ds-job">C984</span> · 71 Broadwick Street
              </b>
              <span>Fri 16 Oct · Broadwick St, London W1F</span>
            </div>
            <span className="ds-pill draft">5 items</span>
          </div>
        </div>
        <div className="ds-lab">Wholesalers · 1 selected</div>
        <div className="ds-grp">
          <div>
            <span className="ds-wl">CE</span>
            <div>
              <b>City Electrical Supplies</b>
              <span>2 contacts</span>
            </div>
          </div>
          <div className="sub">
            <div>
              <b>Paul · Trade counter</b>
              <span>orders@cityelectrical.co.uk</span>
            </div>
            <span className="ds-chk on">
              <MktIcon name="check" size={11} />
            </span>
          </div>
          <div>
            <span className="ds-wl">SP</span>
            <div>
              <b>Southside Plumbing &amp; Heating</b>
              <span>1 contact</span>
            </div>
          </div>
        </div>
        <div className="ds-acts3">
          <span className="q">Quote</span>
          <span className="o">Order</span>
          <span className="wa">Send via WhatsApp</span>
        </div>
        <div className="ds-foot">5 items · 1 recipient · Cut-off 16:00</div>
      </div>
    </div>
  )
}

const EMAIL_ROWS: ReadonlyArray<[string, string, string]> = [
  ['600mm Cable Tray', 'Legrand · Part 123-456', '10 Lengths'],
  ['2.5mm² Twin & Earth 6242B', 'Prysmian · 100m drum', '2 Drums'],
  ['20mm Galvanised Conduit', 'Univolt · 3.75m', '30 Lengths'],
]

/** Step 3: the material order request email the wholesaler receives. */
export function OrderEmailSnap() {
  return (
    <div className="ds-mail" role="img" aria-label="Material order request email">
      <div className="mh">
        <span className="job">JOB · C984</span>
        <div className="brand">
          <Bars size={18} />
          <div>
            PROJECT <em>PLANNER</em>
            <small>Material order request</small>
          </div>
        </div>
      </div>
      <div className="mb">
        <div className="hi">Hi Paul,</div>
        <h4>Please can I place an order for the items below?</h4>
        <div className="meta">
          <div>
            <small>Job</small>
            <b>C984 · 71 Broadwick St</b>
          </div>
          <div>
            <small>Deliver to</small>
            <b>London W1F 9QY · Fri 16 Oct</b>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
            </tr>
          </thead>
          <tbody>
            {EMAIL_ROWS.map(([name, sub, qty]) => (
              <tr key={name}>
                <td>
                  {name}
                  <small>{sub}</small>
                </td>
                <td>
                  <span>{qty}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mfoot" />
    </div>
  )
}

/** Features page: Add material behind, Send list in front. */
export function MaterialsSnap() {
  return (
    <div className="ds-stack">
      <div className="back" aria-hidden>
        <AddMaterialSnap />
      </div>
      <div className="front narrow">
        <SendListSnap />
      </div>
    </div>
  )
}
