/** Shown when the code that makes a PDF cannot be downloaded (for example offline). */
export const PDF_LOAD_FAILED_MESSAGE = 'The PDF could not be made. Check your connection and try again.'

/**
 * Loads an export module on demand (pdf-lib and the builders that use it). A failed load becomes an Error with
 * `PDF_LOAD_FAILED_MESSAGE`, so screens that show `e.message` show friendly text instead of a chunk-load error. Errors
 * from the builder itself are unchanged.
 */
export function loadExportModule<M>(load: () => Promise<M>): Promise<M> {
  return load().catch(() => {
    throw new Error(PDF_LOAD_FAILED_MESSAGE)
  })
}
