/**
 * Tasks on Home (owner decision 9, 5 Nov 2026): the Tasks page's own "To do" list (`filterTasksForView(…, 'todo', …)`,
 * every task for staff, their own for operatives) with each task's status pill — tasks have no progress value, so no
 * bar or %. The header counts the rows of that list, so it always agrees with what is shown underneath; the old
 * Tasks card's "N pending" figure (`homeOverviewMetrics`) and its link are kept in the footer, labelled as the total. Rows open what the Tasks page opens
 * (`getTaskDetailHref`). Presentational.
 */

import Link from 'next/link'
import { ClipboardDocumentCheckIcon } from '@heroicons/react/24/outline'

export type TaskRowView = { id: string; title: string; subtitle: string; status: string; href: string | null }

export const TASKS_SHOWN = 5
const LIMIT = TASKS_SHOWN

export function TasksToDoCard(props: { pending: string; rows: TaskRowView[] | null; total: number }) {
  const { pending, rows, total } = props
  return (
    <section className="dash-card" aria-labelledby="tasks-title">
      <div className="dash-ch">
        <h2 id="tasks-title">
          Tasks to do <small>{rows == null ? '…' : total}</small>
        </h2>
        <Link href="/dashboard/tasks" className="dash-link">
          View all
        </Link>
      </div>
      {rows == null ? (
        <p className="dash-empty">Loading tasks…</p>
      ) : rows.length === 0 ? (
        <p className="dash-empty">Nothing to do.</p>
      ) : (
        <div className="dash-list">
          {rows.slice(0, LIMIT).map((task) => {
            const inner = (
              <>
                <span className="ic">
                  <ClipboardDocumentCheckIcon aria-hidden />
                </span>
                <span className="grow">
                  <span className="t">{task.title}</span>
                  <span className="s">{task.subtitle}</span>
                </span>
                <span className={task.status === 'In Progress' ? 'dash-tag t-blue' : 'dash-tag t-grey'}>{task.status}</span>
              </>
            )
            return task.href ? (
              <Link key={task.id} href={task.href} className="dash-li">
                {inner}
              </Link>
            ) : (
              <div key={task.id} className="dash-li">
                {inner}
              </div>
            )
          })}
          {total > LIMIT ? <p className="dash-muted" style={{ paddingTop: 8 }}>{total - LIMIT} more on the Tasks page</p> : null}
        </div>
      )}
      <p className="dash-muted" style={{ paddingTop: 8 }}>
        <Link href="/dashboard/tasks" className="dash-link">
          {pending} pending in total
        </Link>
      </p>
    </section>
  )
}
