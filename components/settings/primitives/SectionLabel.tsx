/**
 * Heading above a settings card. Readable ink colour, optional step number and
 * one-line description. `label` alone renders a plain heading as before.
 */
export function SectionLabel({
  label,
  description,
  step,
}: {
  label: string
  description?: string
  step?: number
}) {
  return (
    <div className="mb-2.5 mt-7 flex items-start gap-2.5 px-1 first:mt-0">
      {step ? (
        <span
          className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-[var(--ink)] text-[12px] font-bold text-[var(--card)]"
          aria-hidden
        >
          {step}
        </span>
      ) : null}
      <div className="min-w-0">
        <h2 className="text-[15.5px] font-bold leading-snug text-[var(--ink)]">{label}</h2>
        {description ? <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--ink3)]">{description}</p> : null}
      </div>
    </div>
  )
}
