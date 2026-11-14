/** Loading skeletons for the User profile and Edit user pages: the band and the section cards (spec §3.1, §3.2). */
'use client'

import { ProfilePage, Skel } from './index'

function BandSkeleton({ stats }: { stats?: boolean }) {
  return (
    <section className="pu-band up-band" aria-hidden="true">
      <div className="up-band-top">
        <span className="up-sk-circle" />
        <div className="up-sk-stack">
          <Skel dark width={120} />
          <Skel dark width={260} height={24} />
          <Skel dark width={200} />
        </div>
      </div>
      {stats ? (
        <div className="up-sk-stack" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 24 }}>
          {[0, 1, 2, 3].map((index) => (
            <Skel key={index} dark width={110} height={20} />
          ))}
        </div>
      ) : null}
    </section>
  )
}

function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <section className="pu-card up-section" aria-hidden="true">
      <div className="up-section-h">
        <Skel width={38} height={38} />
        <Skel width={120} height={14} />
      </div>
      <div className="up-block">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="up-sk-stack">
            <Skel width="30%" />
            <Skel width="90%" height={38} />
          </div>
        ))}
      </div>
    </section>
  )
}

/** User profile (view). */
export function UserProfileSkeleton() {
  return (
    <ProfilePage>
      <div role="status" aria-label="Loading" className="up-form">
        <Skel width={60} height={16} />
        <BandSkeleton stats />
        <div className="up-grid2">
          <CardSkeleton rows={3} />
          <CardSkeleton rows={1} />
        </div>
      </div>
    </ProfilePage>
  )
}

/** Edit user / Edit operative. */
export function EditUserSkeleton() {
  return (
    <ProfilePage>
      <div role="status" aria-label="Loading" className="up-form">
        <Skel width={60} height={16} />
        <BandSkeleton />
        <CardSkeleton rows={3} />
        <CardSkeleton rows={2} />
        <CardSkeleton rows={2} />
      </div>
    </ProfilePage>
  )
}
