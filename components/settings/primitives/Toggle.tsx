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
      data-hue="blue"
      className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full transition-colors focus-visible:outline-none disabled:cursor-not-allowed ${
        checked ? 'bg-[var(--h,var(--blue))]' : 'bg-[var(--line2)]'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-[22px] w-[22px] transform rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.2)] transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-[3px]'
        } mt-[3px]`}
      />
    </button>
  )
}
