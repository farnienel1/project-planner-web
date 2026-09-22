'use client'

import { ClashDemo } from '@/components/marketing/ClashDemo'
import { MktIcon } from '@/components/marketing/icons'
import { mktToast } from '@/components/marketing/toast'

export function HeroMock() {
  return (
    <div className="mock reveal vis">
      <div className="win" role="img" aria-label="The Project Planner dashboard">
        <div className="win-bar">
          <i />
          <i />
          <i />
        </div>
        <div className="win-body">
          <div className="win-side">
            {(
              [
                ['home', 'blue', true],
                ['daily', 'daily', false],
                ['folder', 'proj', false],
                ['wrench', 'sw', false],
                ['cal', 'sched', false],
                ['alert', 'warn', false],
                ['clock', 'ts', false],
                ['shield', 'hs', false],
              ] as const
            ).map(([icon, hue, on]) => (
              <span key={icon} data-hue={hue} className={on ? 'on' : undefined}>
                <MktIcon name={icon} size={17} />
              </span>
            ))}
          </div>
          <div className="win-main">
            <div className="bp">
              <div className="xs" style={{ opacity: 0.8, fontWeight: 600 }}>
                Monday 21 September
              </div>
              <b style={{ fontSize: 22 }}>Good morning, Dave</b>
              <div className="mstat">
                <div>
                  <b>12</b>
                  <span>On site</span>
                </div>
                <div>
                  <b>3</b>
                  <span>Unbooked</span>
                </div>
                <div>
                  <b>1</b>
                  <span>Clash</span>
                </div>
              </div>
            </div>
            <ClashDemo compact />
            <div className="mrow">
              <span className="ico-chip sm" data-hue="proj">
                <MktIcon name="folder" size={17} />
              </span>
              <div className="grow">
                <b>C1042 · 12 High Street</b>
                <div style={{ height: 6, borderRadius: 9, background: 'var(--soft2)', marginTop: 6, overflow: 'hidden' }}>
                  <i style={{ display: 'block', width: '37%', height: '100%', background: 'var(--proj)' }} />
                </div>
              </div>
              <span className="xs muted" style={{ fontWeight: 700 }}>
                37%
              </span>
            </div>
            <div className="mrow">
              <span className="ico-chip sm" data-hue="sw">
                <MktIcon name="box" size={17} />
              </span>
              <div className="grow">
                <b>3no 100m drums of 2.5mm² T&E ordered</b>
                <span className="muted xs">Before the 15:30 cut-off · Prysmian</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="float" style={{ left: -40, bottom: -18 }}>
        <span className="ico-chip sm" data-hue="green">
          <MktIcon name="check" size={17} />
        </span>
        <div>
          <b>Timesheet signed</b>
          <span className="xs muted">40h + 3h OT · ready for payroll</span>
        </div>
      </div>
      <div className="float" style={{ right: -24, top: 40, animationDelay: '-2.5s' }}>
        <span className="ico-chip sm" data-hue="sched">
          <MktIcon name="cal" size={17} />
        </span>
        <div>
          <b>5 days booked</b>
          <span className="xs muted">Mon–Fri · 07:30–16:00</span>
        </div>
      </div>
    </div>
  )
}

type Cell = { t: string; s: string; h: string; k?: string } | null

function cellStyle(kind?: string) {
  if (kind === 'clash') return { background: 'var(--red-t)', borderLeft: '4px solid var(--red)' }
  if (kind === 'custom') return { background: 'var(--daily-t)', borderLeft: '4px solid var(--daily)' }
  if (kind === 'half') return { background: 'var(--ts-t)', borderLeft: '4px solid var(--ts)' }
  if (kind === 'ot') return { background: 'var(--warn-t)', borderLeft: '4px solid var(--warn)' }
  if (kind === 'office') return { background: 'var(--blue-t)', borderLeft: '4px solid var(--blue)' }
  return { background: 'var(--sched-t)', borderLeft: '4px solid var(--sched)' }
}

export function SchedulePanel() {
  const days = ['Mon 21', 'Tue 22', 'Wed 23', 'Thu 24', 'Fri 25']
  const C = (t: string, s: string, h: string, k?: string): Cell => ({ t, s, h, k })
  const rows: [string, string, string, Cell[]][] = [
    [
      'JB',
      'Joe Bloggs',
      '#0E9467',
      [
        C('Full day', '07:30–16:00', '8h'),
        C('2 jobs', 'Clash', '12h', 'clash'),
        C('Custom', '06:00–14:30', '8h', 'custom'),
        C('AM', '07:30–11:30', '4h', 'half'),
        C('Full day + OT', '16:00–19:00 @1.5×', '8h +3h', 'ot'),
      ],
    ],
    [
      'SK',
      'Sam Khan',
      '#6A45E6',
      [
        C('Full day', '07:30–16:00', '8h'),
        C('PM', '12:30–16:30', '4h', 'half'),
        null,
        C('Custom', '10:00–18:30', '8h', 'custom'),
        C('Full day', '07:30–16:00', '8h'),
      ],
    ],
    [
      'MR',
      'Mia Reid',
      '#D96F0C',
      [
        null,
        C('Nights', '20:00–04:00 @1.5×', '8h', 'ot'),
        C('Full day', '07:30–16:00', '8h'),
        C('Full day', '07:30–16:00', '8h'),
        C('Training', 'Office · 09:00–13:00', '4h', 'office'),
      ],
    ],
  ]

  return (
    <div className="panel">
      <div className="row" style={{ marginBottom: 14 }}>
        <b style={{ fontFamily: 'var(--head)', fontSize: 17 }}>Week of 21 Sep · C1042</b>
        <span className="grow" />
        <span className="pill" data-hue="red">
          <MktIcon name="alert" size={14} />1 clash
        </span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '44px repeat(5,minmax(92px,1fr))',
            gap: 7,
            fontSize: 12,
            minWidth: 540,
          }}
        >
          {['', ...days].map((day, i) => (
            <div key={`d-${i}`} style={{ textAlign: 'center', fontWeight: 700, color: i === 1 ? 'var(--blue)' : 'var(--ink3)' }}>
              {day}
            </div>
          ))}
          {rows.map((row) => (
            <div key={row[0]} style={{ display: 'contents' }}>
              <span className="av" style={{ background: row[2], width: 36, height: 36 }} title={row[1]}>
                {row[0]}
              </span>
              {row[3].map((cell, idx) =>
                cell ? (
                  <div
                    key={`${row[0]}-${idx}`}
                    style={{ minHeight: 64, borderRadius: 12, padding: '7px 8px', lineHeight: 1.3, ...cellStyle(cell.k) }}
                  >
                    <b style={cell.k === 'clash' ? { color: 'var(--red)' } : undefined}>{cell.t}</b>
                    <br />
                    <span style={{ color: 'var(--ink2)' }}>{cell.s}</span>
                    <br />
                    <b>{cell.h}</b>
                  </div>
                ) : (
                  <div
                    key={`${row[0]}-empty-${idx}`}
                    style={{
                      minHeight: 64,
                      borderRadius: 12,
                      border: '2px dashed var(--line)',
                      display: 'grid',
                      placeItems: 'center',
                      color: 'var(--ink3)',
                      fontWeight: 700,
                    }}
                  >
                    + Book
                  </div>
                )
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="row wr" style={{ gap: 14, marginTop: 14, fontSize: 12.5, color: 'var(--ink2)' }}>
        {(
          [
            ['sched', 'Full day'],
            ['ts', 'AM / PM'],
            ['daily', 'Custom hours'],
            ['warn', 'Overtime'],
            ['blue', 'Office'],
            ['red', 'Clash'],
          ] as const
        ).map(([hue, label]) => (
          <span key={label} className="row" style={{ gap: 6 }} data-hue={hue}>
            <i style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--h)' }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

export function WarnPanel() {
  return (
    <div className="panel">
      <div className="bp" data-hue="red" style={{ marginBottom: 12 }}>
        <div className="xs" style={{ opacity: 0.85, fontWeight: 600 }}>
          Active issues
        </div>
        <b style={{ fontSize: 26 }}>3 need attention</b>
      </div>
      <div style={{ marginBottom: 9 }}>
        <ClashDemo />
      </div>
      {(
        [
          ['warn', 'Unbooked labour', 'Sam Khan, Mia Reid · Mon 21 Sep · 8h short each'],
          ['sw', 'Materials not ordered', 'C1057 Riverside Court · cut-off 15:30'],
        ] as const
      ).map(([hue, title, sub]) => (
        <div key={title} className="mrow acc" data-hue={hue} style={{ marginBottom: 9 }}>
          <span className="ico-chip sm" data-hue={hue}>
            <MktIcon name="alert" size={16} />
          </span>
          <div className="grow">
            <b>{title}</b>
            <span className="muted xs">{sub}</span>
          </div>
        </div>
      ))}
      <p className="muted xs" style={{ marginTop: 6 }}>
        Try it: approve the clash for the weekly report, or delete one of Joe&apos;s bookings.
      </p>
    </div>
  )
}

export function HsPanel() {
  return (
    <div className="panel">
      <div className="row" style={{ marginBottom: 14 }}>
        <span className="ico-chip" data-hue="hs">
          <MktIcon name="shield" size={22} />
        </span>
        <div className="grow">
          <b style={{ fontFamily: 'var(--head)', fontSize: 17 }}>Working at height</b>
          <div className="muted small">Issued Mon 21 Sep · C1042</div>
        </div>
        <b style={{ fontFamily: 'var(--head)', fontSize: 24, color: 'var(--hs)' }}>9/11</b>
      </div>
      <div style={{ height: 10, borderRadius: 9, background: 'var(--soft2)', overflow: 'hidden', marginBottom: 14 }}>
        <i style={{ display: 'block', height: '100%', width: '82%', background: 'var(--hs)' }} />
      </div>
      <div className="row wr" style={{ gap: 8 }}>
        {['JB', 'SK', 'MR', 'DH', 'PM', 'AL', 'TW', 'RK', 'GC'].map((initials) => (
          <span key={initials} className="pill" data-hue="green">
            <MktIcon name="check" size={13} />
            {initials}
          </span>
        ))}
        <span className="pill" data-hue="warn">
          2 pending
        </span>
      </div>
      <div className="row" style={{ marginTop: 16 }}>
        <button type="button" className="btn sm" onClick={() => mktToast('Sample: PDF generated')}>
          <MktIcon name="pdf" size={16} />
          Generate PDF
        </button>
        <button type="button" className="btn sm tint" data-hue="warn" onClick={() => mktToast('Sample: reminder sent')}>
          <MktIcon name="bell" size={16} />
          Chase 2
        </button>
      </div>
    </div>
  )
}

export function TimesheetPanel() {
  return (
    <div className="panel">
      <div className="bp" data-hue="ts" style={{ marginBottom: 12 }}>
        <div className="xs" style={{ opacity: 0.85, fontWeight: 600 }}>
          Current payment run
        </div>
        <b style={{ fontSize: 22 }}>17 – 30 September</b>
        <div className="xs" style={{ opacity: 0.85 }}>
          Paid 5 October
        </div>
      </div>
      {(
        [
          ['JB', 'Joe Bloggs', '40h · 3h OT', 'Signed', 'green'],
          ['SK', 'Sam Khan', '37.5h', 'Awaiting you', 'warn'],
          ['MR', 'Mia Reid', '32h · £45 expenses', 'Signed', 'green'],
        ] as const
      ).map((row) => (
        <div key={row[1]} className="mrow" style={{ marginBottom: 9 }}>
          <span className="av" style={{ background: 'var(--ts)' }}>
            {row[0]}
          </span>
          <div className="grow">
            <b>{row[1]}</b>
            <span className="muted xs">{row[2]}</span>
          </div>
          <span className="pill" data-hue={row[4]} style={{ height: 24, fontSize: 11.5 }}>
            {row[3]}
          </span>
        </div>
      ))}
    </div>
  )
}

export function MaterialsPanel() {
  return (
    <div className="panel">
      <div className="row" style={{ marginBottom: 12 }}>
        <b style={{ fontFamily: 'var(--head)', fontSize: 17 }}>Materials · Mon 21</b>
        <span className="grow" />
        <span className="pill" data-hue="warn">
          <MktIcon name="clock" size={13} />
          Cut-off 15:30
        </span>
      </div>
      {(
        [
          ['2.5mm² T&E LSF', '3no 100m drums · Prysmian', 'Ordered', 'green'],
          ['300mm tray', '12 lengths · Legrand', 'Draft', 'lib'],
          ['GU10 3000K dimmable', '40 · Bell', 'Ordered', 'green'],
        ] as const
      ).map((row) => (
        <div key={row[0]} className="mrow" style={{ marginBottom: 9 }}>
          <span className="ico-chip sm" data-hue="sw">
            <MktIcon name="box" size={16} />
          </span>
          <div className="grow">
            <b>{row[0]}</b>
            <span className="muted xs">{row[1]}</span>
          </div>
          <span className="pill" data-hue={row[3]} style={{ height: 24, fontSize: 11.5 }}>
            {row[2]}
          </span>
        </div>
      ))}
    </div>
  )
}

export function ProjectsPanel() {
  return (
    <div className="panel">
      <div className="bp" style={{ marginBottom: 12 }}>
        <div className="xs" style={{ opacity: 0.85, fontWeight: 700 }}>
          C1042 · CAT A
        </div>
        <b style={{ fontSize: 24 }}>12 High Street</b>
        <div style={{ height: 8, borderRadius: 9, background: 'rgba(255,255,255,.2)', marginTop: 12, overflow: 'hidden' }}>
          <i style={{ display: 'block', height: '100%', width: '37%', background: '#fff' }} />
        </div>
        <div className="xs" style={{ marginTop: 6, opacity: 0.85 }}>
          37% complete · 18 days left
        </div>
      </div>
      <div className="row wr" style={{ gap: 8 }}>
        {(
          [
            ['cal', 'sched', 'Scheduling'],
            ['tasks', 'task', 'Tasks'],
            ['box', 'sw', 'Materials'],
            ['shield', 'hs', 'H&S'],
            ['camera', 'daily', 'Site audit'],
            ['pin', 'proj', 'Location'],
          ] as const
        ).map(([icon, hue, label]) => (
          <span key={label} className="pill" data-hue={hue}>
            <MktIcon name={icon} size={14} />
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

export function ReportsPanel() {
  const table = [
    ['', 'M', 'T', 'W', 'T', 'F', 'Σ'],
    ['Joe Bloggs', '8', '12', '8', '4', '11', '43'],
    ['Sam Khan', '8', '4', '—', '8', '8', '28'],
    ['Mia Reid', '—', '8', '8', '8', '4', '28'],
  ]
  return (
    <div className="panel">
      <div className="bp" data-hue="rep" style={{ marginBottom: 12 }}>
        <b style={{ fontSize: 22 }}>Weekly report</b>
        <div className="xs" style={{ opacity: 0.85 }}>
          21 – 27 September 2026
        </div>
      </div>
      <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
        <tbody>
          {table.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td
                  key={`${i}-${j}`}
                  style={{
                    padding: 8,
                    textAlign: j ? 'center' : 'left',
                    fontWeight: i === 0 || j === 6 ? 800 : 500,
                    borderBottom: '1px solid var(--line)',
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function PeoplePanel() {
  return (
    <div className="panel">
      {(
        [
          ['DS', 'Admin', 'Full access', 'user'],
          ['TM', 'Manager', 'Books labour, signs off time', 'blue'],
          ['JB', 'Operative', 'Own schedule, timesheets, H&S', 'ops'],
        ] as const
      ).map((row) => (
        <div key={row[1]} className="mrow" style={{ marginBottom: 9 }}>
          <span className="av" style={{ background: `var(--${row[3]})` }}>
            {row[0]}
          </span>
          <div className="grow">
            <b>{row[1]}</b>
            <span className="muted xs">{row[2]}</span>
          </div>
        </div>
      ))}
      <div className="row" style={{ marginTop: 6 }}>
        <span className="pill" data-hue="leave">
          <MktIcon name="sun" size={13} />
          22 days leave
        </span>
        <span className="pill" data-hue="rep">
          <MktIcon name="award" size={13} />
          SMSTS · exp 2028
        </span>
      </div>
    </div>
  )
}

export function FeaturePanel({ id }: { id: string }) {
  if (id === 'scheduling') return <SchedulePanel />
  if (id === 'warnings') return <WarnPanel />
  if (id === 'hs') return <HsPanel />
  if (id === 'timesheets') return <TimesheetPanel />
  if (id === 'materials') return <MaterialsPanel />
  if (id === 'projects') return <ProjectsPanel />
  if (id === 'reports') return <ReportsPanel />
  if (id === 'people') return <PeoplePanel />
  return null
}
