/**
 * Home page "Material ordering" section: animated 3-step flow with demo snapshots,
 * the "why it's useful" grid, and the WhatsApp explainer.
 * Styles: app/marketing.css ("Materials flow" block, mf-* classes).
 */

import Link from 'next/link'
import type { ReactNode } from 'react'
import { AddMaterialSnap, OrderEmailSnap, SendListSnap } from '@/components/marketing/DemoSnapshots'
import { MktIcon } from '@/components/marketing/icons'
import { Reveal } from '@/components/marketing/Reveal'

const STEPS: ReadonlyArray<{ n: number; who: string; icon: string; title: string; copy: string; snap: ReactNode }> = [
  {
    n: 1,
    who: 'Operatives',
    icon: 'hardhat',
    title: 'The operatives add their materials',
    copy: 'Search the company catalogue, pick the size and quantity, and it lands on the job’s list for the day it’s needed.',
    snap: <AddMaterialSnap />,
  },
  {
    n: 2,
    who: 'Site manager',
    icon: 'send',
    title: 'The site manager orders the materials',
    copy: 'One list per job per day. Check it, pick the wholesaler contact, and send it as a quote request or an order.',
    snap: <SendListSnap />,
  },
  {
    n: 3,
    who: 'Wholesaler',
    icon: 'mail',
    title: 'The wholesaler receives the order request',
    copy: 'A clear email with the job, delivery address, items, part numbers and quantities. Replies go straight to the manager.',
    snap: <OrderEmailSnap />,
  },
]

const WHY: ReadonlyArray<[string, string, string]> = [
  ['list', 'No doubled-up orders', 'Everyone adds to the same list, so two people never order the same drum of cable.'],
  ['box', 'Less wastage', 'Order what the job needs for the day, not a bit extra to be safe.'],
  ['file', 'A record of what was ordered', 'Every quote and order is kept against the job, with who sent it and when.'],
  ['search', 'A catalogue to stop mis-orders', 'Pick from your own material database with brands, sizes and part numbers.'],
  ['note', 'No more lost paper lists', 'No back-of-a-docket lists left in the van or the canteen.'],
  ['bell', 'Never forget to send it', 'Cut-off reminders go to every manager before the wholesaler’s deadline.'],
]

const WA_TICKS = [
  'Press Send via WhatsApp and the order opens already written out',
  'Pick the wholesaler’s saved contact, or type a mobile for a one-off',
  'The list stays on the job, so you still have a record',
  'Move to email orders when you’re ready, a job at a time',
]

const ORDER_LINES = [
  '600mm Cable Tray × 10 Lengths',
  '2.5mm² Twin & Earth 6242B × 2 Drums',
  '20mm Galvanised Conduit × 30 Lengths',
  'Hilti HUS3-H 8×75 Anchors × 4 Boxes',
]

export function MaterialsFlow() {
  return (
    <section className="s mf" id="materials">
      <div className="wrap">
        <Reveal className="shead">
          <span className="kicker">Material ordering</span>
          <h2>From the floor to the wholesaler in three steps.</h2>
          <p>
            The people who know what’s needed add it. The person who signs it off sends it. The wholesaler gets a
            proper order, not a photo of a scrap of paper.
          </p>
        </Reveal>

        <div className="mf-track" aria-hidden>
          <div className="mf-line">
            <span className="mf-token">
              <MktIcon name="box" size={16} />
            </span>
          </div>
          {STEPS.map((step) => (
            <div key={step.n} className={`mf-node n${step.n}`}>
              <span className="mf-dot">
                <MktIcon name={step.icon} size={20} />
              </span>
              <span className="mf-who">
                Step {step.n} · {step.who}
              </span>
            </div>
          ))}
        </div>

        <ol className="mf-steps">
          {STEPS.map((step) => (
            <li key={step.n}>
              <div className="mf-h">
                <span className="mf-num">{step.n}</span>
                <h3>{step.title}</h3>
              </div>
              <p>{step.copy}</p>
              {step.snap}
            </li>
          ))}
        </ol>

        <Reveal className="shead" style={{ marginTop: 88 }}>
          <span className="kicker">Why it matters</span>
          <h2>Why this is so useful on a live job.</h2>
        </Reveal>
        <div className="mf-why">
          {WHY.map(([icon, title, copy]) => (
            <div key={title} className="mf-whyc">
              <i>
                <MktIcon name={icon} size={19} />
              </i>
              <div>
                <h3>{title}</h3>
                <p>{copy}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mf-wa">
          <div>
            <span className="kicker">Works with WhatsApp</span>
            <h2>You don’t have to change how you work overnight.</h2>
            <p className="lead">
              Plenty of wholesalers still take orders over WhatsApp, and plenty of managers prefer it. That’s fine.
            </p>
            <ul className="ticks">
              {WA_TICKS.map((tick) => (
                <li key={tick}>
                  <i>
                    <MktIcon name="check" size={15} />
                  </i>
                  {tick}
                </li>
              ))}
            </ul>
          </div>
          <div className="mf-chat" role="img" aria-label="An order request prepared as a WhatsApp message">
            <div className="ch">
              <span className="av2">CE</span>
              <div>
                <b>City Electrical Supplies</b>
                <span>Paul · Trade counter</span>
              </div>
            </div>
            <div className="cb">
              <div className="m">
                <b>Order request · C984 · 71 Broadwick Street</b>
                <br />
                Deliver Fri 16 Oct, London W1F 9QY
                <ul>
                  {ORDER_LINES.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                Please confirm any long lead times. Thanks, Dave
                <em>07:42</em>
              </div>
              <div className="r">
                All in stock, on the van for 7am Friday 👍<em>07:51</em>
              </div>
            </div>
            <div className="cf">Prepared by Project Planner · you press send</div>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 34 }}>
          <Link href="/features/materials" className="btn">
            Explore materials &amp; wholesalers <MktIcon name="chevR" size={16} />
          </Link>
        </div>
      </div>
    </section>
  )
}
