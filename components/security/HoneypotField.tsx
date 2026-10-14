type HoneypotFieldProps = {
  id?: string
  value?: string
  onChange?: (value: string) => void
}

export function HoneypotField({ id = 'website', value, onChange }: HoneypotFieldProps) {
  return (
    <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden="true">
      <label htmlFor={id}>Website</label>
      <input
        id={id}
        name="website"
        tabIndex={-1}
        autoComplete="off"
        {...(onChange ? { value: value ?? '', onChange: (event) => onChange(event.target.value) } : {})}
      />
    </div>
  )
}
