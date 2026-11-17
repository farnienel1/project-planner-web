/**
 * Tests only: a software passkey authenticator (ES256, "none" attestation) that produces the exact JSON a browser
 * hands to the server, so the passkey tests run the real @simplewebauthn/server checks. Never imported by app code.
 */
import { createHash, generateKeyPairSync, randomBytes, sign as signData, type KeyObject } from 'node:crypto'

function b64url(bytes: Uint8Array | Buffer): string {
  return Buffer.from(bytes).toString('base64url')
}

/** A minimal CBOR encoder: unsigned / negative integers, byte strings, text strings and maps — enough for WebAuthn. */
function cborHead(major: number, value: number): Buffer {
  if (value < 24) return Buffer.from([(major << 5) | value])
  if (value < 0x100) return Buffer.from([(major << 5) | 24, value])
  if (value < 0x10000) return Buffer.from([(major << 5) | 25, value >> 8, value & 0xff])
  const out = Buffer.alloc(5)
  out[0] = (major << 5) | 26
  out.writeUInt32BE(value, 1)
  return out
}

type CborValue = number | string | Uint8Array | Map<number | string, CborValue>

function cbor(value: CborValue): Buffer {
  if (typeof value === 'number') return value >= 0 ? cborHead(0, value) : cborHead(1, -1 - value)
  if (typeof value === 'string') {
    const bytes = Buffer.from(value, 'utf8')
    return Buffer.concat([cborHead(3, bytes.length), bytes])
  }
  if (value instanceof Uint8Array) return Buffer.concat([cborHead(2, value.length), Buffer.from(value)])
  const parts: Buffer[] = [cborHead(5, value.size)]
  for (const [key, inner] of value) parts.push(cbor(key), cbor(inner))
  return Buffer.concat(parts)
}

export type SoftAuthenticator = {
  credentialId: Buffer
  privateKey: KeyObject
  userHandle: string | null
  counter: number
}

export function newSoftAuthenticator(counterStart = 0): SoftAuthenticator {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
  return { credentialId: randomBytes(32), privateKey, userHandle: null, counter: counterStart }
}

function authData(rpID: string, flags: number, counter: number, attested?: Buffer): Buffer {
  const counterBytes = Buffer.alloc(4)
  counterBytes.writeUInt32BE(counter >>> 0, 0)
  return Buffer.concat([createHash('sha256').update(rpID).digest(), Buffer.from([flags]), counterBytes, attested || Buffer.alloc(0)])
}

const UP = 0x01
const UV = 0x04
const AT = 0x40

export function softRegistration(
  device: SoftAuthenticator,
  input: { challenge: string; origin: string; rpID: string; userHandle: string; userVerified?: boolean }
) {
  const jwk = device.privateKey.export({ format: 'jwk' }) as { x: string; y: string }
  const cose = cbor(
    new Map<number, CborValue>([
      [1, 2],
      [3, -7],
      [-1, 1],
      [-2, Buffer.from(jwk.x, 'base64url')],
      [-3, Buffer.from(jwk.y, 'base64url')],
    ])
  )
  const idLength = Buffer.alloc(2)
  idLength.writeUInt16BE(device.credentialId.length, 0)
  const attested = Buffer.concat([Buffer.alloc(16), idLength, device.credentialId, cose])
  const flags = UP | AT | (input.userVerified === false ? 0 : UV)
  const attestationObject = cbor(
    new Map<string, CborValue>([
      ['fmt', 'none'],
      ['attStmt', new Map()],
      ['authData', authData(input.rpID, flags, device.counter, attested)],
    ])
  )
  device.userHandle = input.userHandle
  const clientDataJSON = Buffer.from(JSON.stringify({ type: 'webauthn.create', challenge: input.challenge, origin: input.origin, crossOrigin: false }))
  return {
    id: b64url(device.credentialId),
    rawId: b64url(device.credentialId),
    type: 'public-key' as const,
    response: { clientDataJSON: b64url(clientDataJSON), attestationObject: b64url(attestationObject), transports: ['internal'] },
    clientExtensionResults: {},
    authenticatorAttachment: 'platform' as const,
  }
}

export function softAssertion(
  device: SoftAuthenticator,
  input: { challenge: string; origin: string; rpID: string; counter?: number; userVerified?: boolean; userHandle?: string | null }
) {
  const counter = input.counter ?? (device.counter += 1)
  const data = authData(input.rpID, UP | (input.userVerified === false ? 0 : UV), counter)
  const clientDataJSON = Buffer.from(JSON.stringify({ type: 'webauthn.get', challenge: input.challenge, origin: input.origin, crossOrigin: false }))
  const signature = signData('sha256', Buffer.concat([data, createHash('sha256').update(clientDataJSON).digest()]), device.privateKey)
  const handle = input.userHandle === undefined ? device.userHandle : input.userHandle
  return {
    id: b64url(device.credentialId),
    rawId: b64url(device.credentialId),
    type: 'public-key' as const,
    response: {
      clientDataJSON: b64url(clientDataJSON),
      authenticatorData: b64url(data),
      signature: b64url(signature),
      ...(handle ? { userHandle: handle } : {}),
    },
    clientExtensionResults: {},
    authenticatorAttachment: 'platform' as const,
  }
}
