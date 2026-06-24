export function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-[28px] w-[50px] flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed ${checked ? 'bg-blue-500' : 'bg-slate-200'}`}
    >
      <span
        className={`pointer-events-none inline-block h-[22px] w-[22px] transform rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.25)] ring-0 transition-transform duration-200 ${checked ? 'translate-x-[22px]' : 'translate-x-[1px]'}`}
      />
    </button>
  )
}
