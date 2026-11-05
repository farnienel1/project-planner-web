/**
 * Quick actions: the user's saved actions in their saved order (`loadSavedQuickActionOrder`), each its existing
 * link. Customise keeps its behaviour — × removes an action, Add opens the existing chooser — through the handlers
 * passed in. Presentational.
 */

import Link from 'next/link'
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/solid'
import { QuickActionIcon } from '@/components/home/QuickActionIcon'

export type QuickActionView = { id: string; title: string; href: string; icon: string }

export function QuickActionsCard(props: {
  actions: QuickActionView[]
  customise: boolean
  showHint: boolean
  onToggleCustomise: () => void
  onDismissHint: () => void
  onRemove: (id: string) => void
  onAdd: () => void
}) {
  const { actions, customise, showHint, onToggleCustomise, onDismissHint, onRemove, onAdd } = props
  return (
    <section className="dash-card" aria-labelledby="quick-actions-title">
      <div className="dash-ch">
        <h2 id="quick-actions-title">Quick actions</h2>
        <button type="button" className="dash-link" onClick={onToggleCustomise} aria-pressed={customise}>
          {customise ? 'Done' : 'Customise'}
        </button>
      </div>
      {customise && showHint ? (
        <p className="dash-hint">
          Remove an action with ×, or add one with Add.
          <button type="button" onClick={onDismissHint}>
            OK
          </button>
        </p>
      ) : null}
      <div className="dash-qa">
        {actions.map((action) => (
          <div key={action.id} className="dash-qa-item">
            <Link href={action.href}>
              <QuickActionIcon name={action.icon} />
              <span>{action.title}</span>
            </Link>
            {customise ? (
              <button type="button" className="rm" aria-label={`Remove ${action.title}`} onClick={() => onRemove(action.id)}>
                <XMarkIcon aria-hidden />
              </button>
            ) : null}
          </div>
        ))}
        {customise ? (
          <div className="dash-qa-item">
            <button type="button" className="add" onClick={onAdd}>
              <PlusIcon aria-hidden />
              <span>Add</span>
            </button>
          </div>
        ) : null}
      </div>
    </section>
  )
}
