/**
 * The EXIF orientation of a JPEG (1–8; 1 when there is none or it cannot be read). 5–8 mean the picture is shown
 * turned a quarter, so its shown width and height are the stored height and width. Display only: used to give a
 * photo the browser cannot decode the same box shape the iPhone draws it in.
 */
export function jpegExifOrientation(bytes: Uint8Array): number {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return 1
  let i = 2
  while (i + 4 <= bytes.length) {
    if (bytes[i] !== 0xff) return 1
    const marker = bytes[i + 1]
    if (marker === 0xda || marker === 0xd9) return 1
    const length = (bytes[i + 2] << 8) | bytes[i + 3]
    if (length < 2) return 1
    if (marker === 0xe1 && i + 10 <= bytes.length && String.fromCharCode(...bytes.subarray(i + 4, i + 8)) === 'Exif') {
      const tiff = i + 10
      if (tiff + 8 > bytes.length) return 1
      const little = bytes[tiff] === 0x49
      const u16 = (at: number) => (little ? bytes[at] | (bytes[at + 1] << 8) : (bytes[at] << 8) | bytes[at + 1])
      const u32 = (at: number) =>
        little
          ? (bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16) | (bytes[at + 3] << 24)) >>> 0
          : ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0
      const ifd = tiff + u32(tiff + 4)
      if (ifd + 2 > bytes.length) return 1
      const entries = u16(ifd)
      for (let e = 0; e < entries; e += 1) {
        const at = ifd + 2 + e * 12
        if (at + 12 > bytes.length) return 1
        if (u16(at) === 0x0112) {
          const value = u16(at + 8)
          return value >= 1 && value <= 8 ? value : 1
        }
      }
      return 1
    }
    i += 2 + length
  }
  return 1
}
