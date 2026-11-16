import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { emulatorHost, firestoreDocumentsBase, identityToolkitBase } from './googleApis.ts'

const NAMES = ['NEXT_PUBLIC_USE_EMULATORS', 'FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST', 'NEXT_PUBLIC_FIREBASE_PROJECT_ID'] as const
const saved = Object.fromEntries(NAMES.map((name) => [name, process.env[name]]))
afterEach(() => {
  for (const name of NAMES) {
    if (saved[name] === undefined) delete process.env[name]
    else process.env[name] = saved[name]
  }
})

test('review #348 L4: Google hosts unless the harness switch AND a loopback emulator host are both set', () => {
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'demo'
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'
  delete process.env.NEXT_PUBLIC_USE_EMULATORS
  assert.ok(firestoreDocumentsBase().startsWith('https://firestore.googleapis.com/'))
  assert.equal(identityToolkitBase(), 'https://identitytoolkit.googleapis.com/v1')

  process.env.NEXT_PUBLIC_USE_EMULATORS = '1'
  assert.ok(firestoreDocumentsBase().startsWith('http://127.0.0.1:8080/v1/projects/demo/'))
  assert.equal(identityToolkitBase(), 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1')

  for (const host of ['evil.example.com:8080', '10.0.0.5:8080', 'localhost', '127.0.0.1:8080/x', 'localhost.evil:80']) {
    process.env.FIRESTORE_EMULATOR_HOST = host
    assert.equal(emulatorHost('FIRESTORE_EMULATOR_HOST'), '', host)
  }
  process.env.FIRESTORE_EMULATOR_HOST = '[::1]:8080'
  assert.equal(emulatorHost('FIRESTORE_EMULATOR_HOST'), '[::1]:8080')
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080'
  assert.equal(emulatorHost('FIRESTORE_EMULATOR_HOST'), 'localhost:8080')
})
