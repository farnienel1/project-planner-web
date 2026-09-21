export function SuccessBanner({ message }: { message: string }) {
  return (
    <div className="banner" data-hue="green">
      <span className="text-sm font-semibold">{message}</span>
    </div>
  )
}
