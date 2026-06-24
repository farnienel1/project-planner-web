export function SaveButton({
  saving,
  saved,
  onClick,
}: {
  saving: boolean
  saved: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={saving}
      className={`w-full rounded-2xl py-3.5 text-sm font-bold transition-all ${saved ? 'bg-emerald-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'} disabled:opacity-50`}
    >
      {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
    </button>
  )
}
