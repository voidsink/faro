import { BunkerSigner, parseBunkerInput } from 'nostr-tools/nip46'
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure'

const HEX_64 = /^[0-9a-f]{64}$/i

export function isRemoteSignerUrl(input = '') {
  const value = String(input || '').trim()
  return value.startsWith('bunker://') || value.startsWith('nostrconnect://')
}

export function parseRemoteSignerUrl(input = '') {
  const raw = String(input || '').trim()
  if (!isRemoteSignerUrl(raw)) {
    throw new Error('Paste a bunker:// or nostrconnect:// URL.')
  }

  let url
  try {
    url = new URL(raw)
  } catch {
    throw new Error('Invalid remote signer URL.')
  }

  const signerPubkey = (url.hostname || url.pathname.replace(/^\/+/, '')).toLowerCase()
  if (!HEX_64.test(signerPubkey)) {
    throw new Error('Remote signer URL is missing a valid pubkey.')
  }

  const relays = url.searchParams.getAll('relay').filter(Boolean)
  if (!relays.length) {
    throw new Error('Remote signer URL needs at least one relay parameter.')
  }

  return {
    type: url.protocol.replace(':', ''),
    signerPubkey,
    relays,
    secret: url.searchParams.get('secret') || '',
    raw,
  }
}

export function safeRemoteSignerIdentity(parsed, accountPubkey, source = 'bunker') {
  if (!parsed?.signerPubkey || !accountPubkey) return null
  return {
    source,
    pubkey: accountPubkey,
    signerPubkey: parsed.signerPubkey,
    relays: parsed.relays,
    type: parsed.type,
  }
}

function withTimeout(promise, timeoutMs, message) {
  let timeoutId
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs)
  })

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId))
}

function wrapRemoteSigner(bunkerSigner, parsed, accountPubkey, clientSecretKey) {
  const signerPubkey = bunkerSigner.bp?.pubkey || parsed.signerPubkey
  const relays = bunkerSigner.bp?.relays?.length ? bunkerSigner.bp.relays : parsed.relays

  return {
    pubkey: accountPubkey,
    source: 'bunker',
    type: parsed.type,
    relays,
    signerPubkey,
    clientPubkey: getPublicKey(clientSecretKey),
    getPublicKey: () => Promise.resolve(accountPubkey),
    signEvent: (event) => bunkerSigner.signEvent(event),
    close: () => bunkerSigner.close(),
  }
}

export async function createRemoteSigner(input, options = {}) {
  const parsed = parseRemoteSignerUrl(input)
  const clientSecretKey = generateSecretKey()
  const { timeoutMs = 60000, onauth } = options

  let bunkerSigner
  try {
    if (parsed.type === 'bunker') {
      const bunkerPointer = await parseBunkerInput(parsed.raw)
      if (!bunkerPointer) {
        throw new Error('Could not parse bunker URL.')
      }
      bunkerSigner = BunkerSigner.fromBunker(clientSecretKey, bunkerPointer, { onauth })
      await withTimeout(
        bunkerSigner.connect(),
        timeoutMs,
        'Remote signer connection timed out. Check the bunker app and relay.',
      )
    } else if (parsed.type === 'nostrconnect') {
      bunkerSigner = await BunkerSigner.fromURI(clientSecretKey, parsed.raw, { onauth }, timeoutMs)
    } else {
      throw new Error(`Unsupported remote signer type: ${parsed.type}`)
    }

    const accountPubkey = await withTimeout(
      bunkerSigner.getPublicKey(),
      timeoutMs,
      'Remote signer did not return a public key in time.',
    )
    return wrapRemoteSigner(bunkerSigner, parsed, accountPubkey, clientSecretKey)
  } catch (error) {
    try {
      await bunkerSigner?.close?.()
    } catch {
      // Ignore cleanup errors.
    }
    throw error
  }
}
