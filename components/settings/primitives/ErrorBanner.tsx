export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="banner" data-hue="red">
      <span className="text-sm font-semibold">{message}</span>
    </div>
  )
}
