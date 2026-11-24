'use client'

import { LONDON_TIME_ZONE } from '@/lib/orgTime/zoneTime'
import Link from 'next/link'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { DeveloperShell } from '@/components/developer/DeveloperShell'
import { LoadingSpinner } from '@/components/dashboard/PageShell'
import { ownerGet } from '@/lib/owner/client/ownerApi'
import type {
  BuildInfo,
  EmailLogSummary,
  FunctionErrorsSummary,
  NotConnected,
  PlatformConfigStatus,
  RulesCompare,
} from '@/lib/owner/platformStatus'

type StatusResponse = {
  checkedAt: string
  windowDays: number
  build: BuildInfo
  rulebookVersion: string | null
  rulebookUrl: string
  rules: { connected: true; rules: RulesCompare[] } | NotConnected
  rulesWorkflowUrl: string
  functionErrors: FunctionErrorsSummary | NotConnected
  logsUrl: string | null
  emails: EmailLogSummary | NotConnected
  emailLogUrl: string | null
  platformConfig: { connected: true; config: PlatformConfigStatus } | NotConnected
  platformConfigUrl: string | null
  clientErrors: { connected: true; href: string } | NotConnected
}

function when(iso: string | null | undefined, empty = 'Not recorded'): string {
  if (!iso) return empty
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return empty
  return new Date(ms).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: LONDON_TIME_ZONE })
}

/** A tile with its destination: an internal page, or an outside page opened in a new tab. */
function Tile({
  title,
  testId,
  link,
  children,
}: {
  title: string
  testId: string
  link: { href: string; label: string; external?: boolean } | null
  children: ReactNode
}) {
  return (
    <section className="card pad space-y-2" data-testid={testId}>
      <h2 className="h2">{title}</h2>
      {children}
      {link ? (
        link.external ? (
          <a href={link.href} target="_blank" rel="noopener noreferrer" className="pu-link text-sm">
            {link.label} ↗
          </a>
        ) : (
          <Link href={link.href} className="pu-link text-sm">
            {link.label}
          </Link>
        )
      ) : null}
    </section>
  )
}

/**
 * Owner console Status (owner request 24 Nov): one place for what is running and whether it is healthy. Every tile
 * opens somewhere the owner can look closer; a source the server cannot read is listed under "Not connected" with the
 * reason, never shown as zero (standing rule "useful features only").
 */
export function DeveloperStatusScreen() {
  const [data, setData] = useState<StatusResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await ownerGet<StatusResponse>('/api/owner/status'))
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the status.')
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  if (loading && !data && !error) return <LoadingSpinner label="Checking status…" />

  const notConnected: { title: string; reason: string }[] = []
  if (data && !data.rules.connected) notConnected.push({ title: 'Live rules', reason: data.rules.reason })
  if (data && !data.functionErrors.connected) notConnected.push({ title: 'Cloud Functions and Cloud Run errors', reason: data.functionErrors.reason })
  if (data && !data.emails.connected) notConnected.push({ title: 'Email failures', reason: data.emails.reason })
  if (data && !data.clientErrors.connected) notConnected.push({ title: 'Client errors', reason: data.clientErrors.reason })
  if (data && !data.platformConfig.connected) notConnected.push({ title: 'Minimum builds and switches', reason: data.platformConfig.reason })

  return (
    <DeveloperShell
      title="Status"
      actions={
        <button type="button" className="btn sm ghost" onClick={() => void load()} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      }
    >
      {error ? (
        <p className="banner" data-hue="red" role="alert">
          {error}
        </p>
      ) : null}
      {data ? (
        <>
          <p className="text-sm text-(--ink2)">Checked {when(data.checkedAt)}. Errors and emails cover the last {data.windowDays} days.</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Tile
              title="Web deploy"
              testId="status-deploy"
              link={data.build.commitUrl ? { href: data.build.commitUrl, label: 'Open the commit on GitHub', external: true } : null}
            >
              {data.build.commit ? (
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                  <dt className="text-(--ink3)">Commit</dt>
                  <dd className="font-mono">{data.build.commitShort}</dd>
                  <dt className="text-(--ink3)">Built</dt>
                  <dd>{when(data.build.builtAt)}</dd>
                  {data.build.deployId ? (
                    <>
                      <dt className="text-(--ink3)">Netlify deploy</dt>
                      <dd className="font-mono">{data.build.deployId}</dd>
                    </>
                  ) : null}
                  {data.build.context || data.build.branch ? (
                    <>
                      <dt className="text-(--ink3)">From</dt>
                      <dd>{[data.build.context, data.build.branch].filter(Boolean).join(' · ')}</dd>
                    </>
                  ) : null}
                  {data.build.appVersion ? (
                    <>
                      <dt className="text-(--ink3)">App version</dt>
                      <dd>{data.build.appVersion}</dd>
                    </>
                  ) : null}
                </dl>
              ) : (
                <p className="text-sm text-(--ink3)">This build did not record its commit.</p>
              )}
            </Tile>

            <Tile
              title="Rulebook"
              testId="status-rulebook"
              link={data.rulebookVersion ? { href: data.rulebookUrl, label: 'Read this rulebook', external: true } : null}
            >
              <p className="text-2xl font-extrabold">{data.rulebookVersion ? `Rules ${data.rulebookVersion}` : 'Not recorded'}</p>
              <p className="text-xs text-(--ink3)">The rulebook this web build runs. iPhone builds carry their own copy.</p>
            </Tile>

            {data.rules.connected ? (
              <Tile title="Live security rules" testId="status-rules" link={{ href: data.rulesWorkflowUrl, label: 'Open the rules publish workflow', external: true }}>
                <ul className="space-y-1 text-sm">
                  {data.rules.rules.map((rule) => (
                    <li key={rule.releaseId} className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{rule.label}</span>
                      <span className="chip" data-hue={rule.matches === true ? 'green' : rule.matches === false ? 'red' : undefined}>
                        {rule.matches === true ? 'Matches this build' : rule.matches === false ? 'Differs' : 'Not compared'}
                      </span>
                      <span className="text-xs text-(--ink3)">published {when(rule.releasedAt)}</span>
                      {rule.note ? <span className="w-full text-xs text-(--ink3)">{rule.note}</span> : null}
                    </li>
                  ))}
                </ul>
              </Tile>
            ) : null}

            {data.functionErrors.connected ? (
              <Tile
                title="Cloud Functions and Cloud Run errors"
                testId="status-functions"
                link={data.logsUrl ? { href: data.logsUrl, label: 'Open the logs', external: true } : null}
              >
                <p className="text-2xl font-extrabold">
                  {data.functionErrors.capped ? 'At least ' : ''}
                  {data.functionErrors.total}
                </p>
                {data.functionErrors.byFunction.length ? (
                  <ul className="space-y-1 text-sm">
                    {data.functionErrors.byFunction.slice(0, 8).map((row) => (
                      <li key={row.name}>
                        <span className="font-mono">{row.name}</span> · {row.count} · last {when(row.lastAt)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-(--ink3)">No errors.</p>
                )}
              </Tile>
            ) : null}

            {data.emails.connected ? (
              <Tile
                title="Email failures"
                testId="status-emails"
                link={data.emailLogUrl ? { href: data.emailLogUrl, label: 'Open emailLog', external: true } : null}
              >
                <p className="text-2xl font-extrabold">
                  {data.emails.failed} failed of {data.emails.capped ? 'at least ' : ''}
                  {data.emails.total}
                </p>
                {data.emails.failedByType.length ? (
                  <ul className="space-y-1 text-sm">
                    {data.emails.failedByType.map((row) => (
                      <li key={row.type}>
                        {row.type} · {row.count}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {data.emails.lastFailedAt ? <p className="text-xs text-(--ink3)">Last failure {when(data.emails.lastFailedAt)}</p> : null}
              </Tile>
            ) : null}

            {data.clientErrors.connected ? (
              <Tile title="Client errors" testId="status-client-errors" link={{ href: data.clientErrors.href, label: 'Open Errors' }}>
                <p className="text-sm text-(--ink2)">Errors reported by the web and iPhone apps.</p>
              </Tile>
            ) : null}

            {data.platformConfig.connected ? (
              <Tile
                title="Minimum builds and switches"
                testId="status-platform-config"
                link={data.platformConfigUrl ? { href: data.platformConfigUrl, label: 'Open platformConfig/app', external: true } : null}
              >
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                  <dt className="text-(--ink3)">Oldest iPhone build</dt>
                  <dd>{data.platformConfig.config.minimumIosBuild ?? 'Not set'}</dd>
                  <dt className="text-(--ink3)">Oldest web version</dt>
                  <dd>{data.platformConfig.config.minimumWebVersion ?? 'Not set'}</dd>
                  {data.platformConfig.config.switches.map((row) => (
                    <SwitchRowView key={row.field} label={row.label} state={row.state} on={row.on} />
                  ))}
                </dl>
                <p className="text-xs text-(--ink3)">Read-only here (D17). Each switch is changed by the platform owner, one at a time.</p>
              </Tile>
            ) : null}
          </div>

          {notConnected.length ? (
            <section className="card pad space-y-2" data-testid="status-not-connected">
              <h2 className="h2">Not connected</h2>
              <ul className="space-y-1 text-sm">
                {notConnected.map((row) => (
                  <li key={row.title}>
                    <span className="font-semibold">{row.title}:</span> <span className="text-(--ink2)">{row.reason}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}
    </DeveloperShell>
  )
}

function SwitchRowView({ label, state, on }: { label: string; state: string; on: 'everywhere' | 'some' | 'off' }) {
  return (
    <>
      <dt className="text-(--ink3)">{label}</dt>
      <dd className={on === 'off' ? 'text-(--ink2)' : 'font-semibold'}>{state}</dd>
    </>
  )
}
