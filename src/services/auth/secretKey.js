import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools/pure'
import { decode, nsecEncode } from 'nostr-tools/nip19'

const HEX_64 = /^[0-9a-f]{64}$/i

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function hexToBytes(hex) {
  return Uint8Array.from(hex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)))
}

export function createKeypair() {
  const secretKey = generateSecretKey()
  return keypairFromSecretKey(secretKey)
}

export function parseSecretKey(input = '') {
  const value = String(input || '').trim()
  if (!value) throw new Error('Enter an nsec private key.')

  if (value.startsWith('nsec')) {
    const decoded = decode(value)
    if (decoded.type !== 'nsec') throw new Error('Expected an nsec private key.')
    return decoded.data
  }

  if (HEX_64.test(value)) return hexToBytes(value)

  throw new Error('Invalid private key. Paste an nsec or 64-character hex key.')
}

export function keypairFromSecretKey(secretKey) {
  const pubkey = getPublicKey(secretKey)
  return {
    pubkey,
    secretKey,
    nsec: nsecEncode(secretKey),
    hex: bytesToHex(secretKey),
  }
}

export function makeLocalSigner(secretKey) {
  const keypair = keypairFromSecretKey(secretKey)
  return {
    async getPublicKey() {
      return keypair.pubkey
    },
    async signEvent(event) {
      return finalizeEvent(event, secretKey)
    },
  }
}
