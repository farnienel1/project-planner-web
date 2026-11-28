/** What the PDF button says when some photos could not be drawn (null when every photo is in the PDF). */
export function siteAuditPdfPhotosNotice(result: { photos: number; photosNotDrawn: number }): string | null {
  if (result.photosNotDrawn <= 0) return null
  const all = result.photosNotDrawn === result.photos
  const what = all ? (result.photos === 1 ? 'The photo' : `All ${result.photos} photos`) : `${result.photosNotDrawn} of ${result.photos} photos`
  return `The PDF was downloaded, but ${what} could not be loaded and ${result.photosNotDrawn === 1 ? 'is' : 'are'} shown as grey boxes. Check the connection and download it again.`
}
