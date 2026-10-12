export function SaveButton({
  saving,
  saved,
  onClick,
  dirty = true,
  label = 'Save',
}: {
  saving: boolean
  saved: boolean
  onClick: () => void
  dirty?: boolean
  label?: string
}) {
  const disabled = saving || !dirty
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`btn primary block ${
        saved && !dirty ? 'bg-[var(--green)]' : dirty && !saving ? '' : 'opacity-45'
      } disabled:cursor-not-allowed`}
    >
      {saving ? 'Saving…' : saved && !dirty ? '✓ Saved' : label}
    </button>
  )
}
