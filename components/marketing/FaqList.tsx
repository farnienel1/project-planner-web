import { MktIcon } from '@/components/marketing/icons'

export function FaqList({ items, id }: { items: [string, string][]; id?: string }) {
  return (
    <div id={id}>
      {items.map(([question, answer]) => (
        <details key={question} className="acc">
          <summary>
            {question}
            <MktIcon name="chevD" size={20} />
          </summary>
          <div className="a">{answer}</div>
        </details>
      ))}
    </div>
  )
}
