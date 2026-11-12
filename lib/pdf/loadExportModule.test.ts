import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PDF_LOAD_FAILED_MESSAGE, loadExportModule } from './loadExportModule.ts'

test('a failed export-module load shows the friendly message, never the raw chunk error', async () => {
  await assert.rejects(
    loadExportModule(() => Promise.reject(new Error('ChunkLoadError: Loading chunk 8774 failed.'))),
    (error: Error) => error.message === PDF_LOAD_FAILED_MESSAGE
  )
  assert.equal(PDF_LOAD_FAILED_MESSAGE, 'The PDF could not be made. Check your connection and try again.')
})

test('a loaded module is returned unchanged, and builder errors keep their own message', async () => {
  const exportModule = { build: () => Promise.reject(new Error('Evidence missing')) }
  const loaded = await loadExportModule(() => Promise.resolve(exportModule))
  assert.equal(loaded, exportModule)
  await assert.rejects(loaded.build(), /Evidence missing/)
})
