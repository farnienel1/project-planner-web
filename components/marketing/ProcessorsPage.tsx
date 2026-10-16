import Link from 'next/link'
import { SUPPORT_EMAIL } from '@/lib/marketing/content'
import { LEGAL_ENTITY } from '@/lib/legal/customerLegalPack'
import { PROCESSOR_INVENTORY, PROCESSORS_NOT_USED, PRIVACY_PATH, TERMS_PATH } from '@/lib/legal/processors'
import { MktIcon } from '@/components/marketing/icons'

export function ProcessorsPage() {
  return (
    <div className="page">
      <div className="phero">
        <div className="wrap">
          <span className="eyebrow" data-hue="lib">
            <i>
              <MktIcon name="file" size={13} />
            </i>
            Legal
          </span>
          <h1>Processors</h1>
          <p>
            {LEGAL_ENTITY.name} · company no. 17237456 · Version {LEGAL_ENTITY.version} · Effective{' '}
            {LEGAL_ENTITY.effectiveDate}
          </p>
        </div>
      </div>
      <section className="s" style={{ paddingTop: 20 }}>
        <div className="wrap" style={{ maxWidth: 880 }}>
          <article className="card pad prose" style={{ padding: 40 }}>
            <p>
              This is the current list of processors and related services wired into Project Planner, taken from the
              product code. It is the list promised in the Data Processing Agreement. It is not a claim that every row
              is a GDPR sub-processor. Regions are tagged only where we have evidence in this repository.
            </p>
            <p>{PROCESSORS_NOT_USED}</p>
            <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: '24px 0 0', gap: 18 }}>
              {PROCESSOR_INVENTORY.map((row) => (
                <li key={row.id} className="card pad" style={{ padding: 20, boxShadow: 'var(--sh)' }}>
                  <h2 style={{ fontSize: 20, margin: 0 }}>{row.name}</h2>
                  <p style={{ marginTop: 8 }}>{row.purpose}</p>
                  <p className="muted small" style={{ marginTop: 8 }}>
                    Surfaces: {row.surfaces}
                    {' · '}
                    Region:{' '}
                    {row.region ? `${row.region.label} [${row.region.confidence}]` : 'Not tagged in this inventory'}
                  </p>
                </li>
              ))}
            </ul>
            <p className="muted small" style={{ marginTop: 28 }}>
              Related:{' '}
              <Link href={PRIVACY_PATH}>Privacy Policy</Link>
              {' · '}
              <Link href={TERMS_PATH}>Terms of Service</Link>
              . Questions: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
            </p>
          </article>
        </div>
      </section>
    </div>
  )
}
