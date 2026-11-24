export function mapPinIconHtml(color: string, selected = false): string {
  const scale = selected ? 1.15 : 1
  const width = Math.round(30 * scale)
  const height = Math.round(40 * scale)
  const shadow = selected ? '0 4px 14px rgba(37,99,235,0.45)' : '0 2px 8px rgba(15,23,42,0.35)'

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 30 40" style="display:block;filter:drop-shadow(${shadow})">
    <path d="M15 0C8.4 0 3 5.4 3 12c0 9 12 26 12 26s12-17 12-26C27 5.4 21.6 0 15 0z" fill="${color}" stroke="#ffffff" stroke-width="2"/>
    <circle cx="15" cy="12" r="5" fill="#ffffff"/>
  </svg>`
}

export function mapPinIconOptions(color: string, selected = false) {
  const scale = selected ? 1.15 : 1
  const width = Math.round(30 * scale)
  const height = Math.round(40 * scale)
  return {
    className: '',
    html: mapPinIconHtml(color, selected),
    iconSize: [width, height],
    iconAnchor: [width / 2, height],
    popupAnchor: [0, -height + 4],
  }
}

/** A round dot for the site map (owner 24 Nov: projects blue, small works red), white ring so it shows on any tile. */
export function mapDotIconOptions(color: string, selected = false) {
  const size = selected ? 22 : 16
  const ring = selected ? 3 : 2
  const shadow = selected ? '0 0 0 3px rgba(15,23,42,0.35)' : '0 1px 4px rgba(15,23,42,0.45)'
  return {
    className: '',
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:50%;background:${color};border:${ring}px solid #ffffff;box-shadow:${shadow};box-sizing:border-box"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  }
}
