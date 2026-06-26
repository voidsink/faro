import { SimplePool } from 'nostr-tools/pool'
import { NostrConnect } from 'nostr-tools/kinds'
import { decrypt as nip04Decrypt, encrypt as nip04Encrypt } from 'nostr-tools/nip04'
import { BunkerSigner, createNostrConnectURI, parseBunkerInput } from 'nostr-tools/nip46'
import { finalizeEvent, generateSecretKey, getPublicKey, verifyEvent } from 'nostr-tools/pure'

const HEX_64 = /^[0-9a-f]{64}$/i
const DEFAULT_NOSTR_CONNECT_PERMS = ['sign_event:1', 'sign_event:7', 'sign_event:24242']

function randomSecret() {
  const bytes = new Uint8Array(12)
  globalThis.crypto?.getRandomValues?.(bytes)
  if (bytes.some(Boolean)) return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function generateClientSecretKey() {
  const bytes = new Uint8Array(32)
  globalThis.crypto?.getRandomValues?.(bytes)
  return bytes.some(Boolean) ? bytes : generateSecretKey()
}

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

export function createNostrConnectToken({
  relays = [],
  secret = randomSecret(),
  perms = DEFAULT_NOSTR_CONNECT_PERMS,
  name = 'Faro',
  url = typeof window !== 'undefined' ? window.location.origin : '',
  image = '',
} = {}) {
  const clientSecretKey = generateClientSecretKey()
  const clientPubkey = getPublicKey(clientSecretKey)
  const uri = createNostrConnectURI({
    clientPubkey,
    relays,
    secret,
    perms,
    name,
    url,
    image,
  })

  return { uri, clientSecretKey, clientPubkey, secret, relays, perms }
}

function withTimeout(promise, timeoutMs, message) {
  let timeoutId
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs)
  })

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId))
}

function wrapRemoteSigner(bunkerSigner, parsed, accountPubkey, clientSecretKey) {
  const signerPubkey = bunkerSigner.bp?.pubkey || bunkerSigner.remotePubkey || parsed.signerPubkey
  const relays = bunkerSigner.bp?.relays?.length ? bunkerSigner.bp.relays : bunkerSigner.relays || parsed.relays

  return {
    pubkey: accountPubkey,
    source: 'bunker',
    type: parsed.type,
    relays,
    signerPubkey,
    clientPubkey: getPublicKey(clientSecretKey),
    getPublicKey: () => Promise.resolve(accountPubkey),
    signEvent: (event) =>
      withTimeout(
        bunkerSigner.signEvent(event),
        90000,
        'Remote signer did not approve the signing request in time.',
      ),
    close: () => bunkerSigner.close(),
  }
}

class LegacyNip04RemoteSigner {
  constructor({ clientSecretKey, remotePubkey, relays }) {
    this.clientSecretKey = clientSecretKey
    this.remotePubkey = remotePubkey
    this.relays = relays
    this.clientPubkey = getPublicKey(clientSecretKey)
    this.pool = new SimplePool()
    this.listeners = new Map()
    this.serial = 0
    this.closed = false
    this.subscription = this.pool.subscribe(
      relays,
      { kinds: [NostrConnect], authors: [remotePubkey], '#p': [this.clientPubkey], limit: 0 },
      {
        onevent: (event) => this.handleResponseEvent(event),
      },
    )
  }

  handleResponseEvent(event) {
    if (!event.content?.includes('?iv=')) return
    let payload
    try {
      payload = JSON.parse(nip04Decrypt(this.clientSecretKey, event.pubkey, event.content))
    } catch {
      return
    }

    const listener = this.listeners.get(payload.id)
    if (!listener) return
    this.listeners.delete(payload.id)
    if (payload.error) listener.reject(new Error(payload.error))
    else listener.resolve(payload.result)
  }

  async sendRequest(method, params = []) {
    if (this.closed) throw new Error('this signer is not open anymore, create a new one')
    this.serial += 1
    const id = `faro-legacy-${this.serial}-${Math.random().toString(36).slice(2)}`
    const content = nip04Encrypt(
      this.clientSecretKey,
      this.remotePubkey,
      JSON.stringify({ id, method, params }),
    )
    const event = finalizeEvent(
      {
        kind: NostrConnect,
        tags: [['p', this.remotePubkey]],
        content,
        created_at: Math.floor(Date.now() / 1000),
      },
      this.clientSecretKey,
    )

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.listeners.delete(id)
        reject(new Error('Remote signer did not approve the signing request in time.'))
      }, 90000)
      this.listeners.set(id, {
        resolve: (value) => {
          clearTimeout(timeoutId)
          resolve(value)
        },
        reject: (error) => {
          clearTimeout(timeoutId)
          reject(error)
        },
      })
      Promise.any(this.pool.publish(this.relays, event)).catch((error) => {
        clearTimeout(timeoutId)
        this.listeners.delete(id)
        reject(error)
      })
    })
  }

  async getPublicKey() {
    if (!this.cachedPubkey) this.cachedPubkey = await this.sendRequest('get_public_key', [])
    return this.cachedPubkey
  }

  async signEvent(event) {
    const response = await this.sendRequest('sign_event', [JSON.stringify(event)])
    const signed = JSON.parse(response)
    if (!verifyEvent(signed)) throw new Error(`event returned from bunker is improperly signed: ${response}`)
    return signed
  }

  async close() {
    this.closed = true
    this.subscription?.close?.()
    this.pool.close(this.relays)
  }
}

function connectLegacyNip04FromUri(clientSecretKey, connectionUri, abortSignalOrTimeout = 60000) {
  const uri = new URL(connectionUri)
  const relays = uri.searchParams.getAll('relay')
  const secret = uri.searchParams.get('secret') || ''
  const clientPubkey = getPublicKey(clientSecretKey)
  const pool = new SimplePool()

  return new Promise((resolve, reject) => {
    let done = false
    let timeoutId = null
    const finish = (callback, value) => {
      if (done) return
      done = true
      if (timeoutId) clearTimeout(timeoutId)
      subscription?.close?.()
      pool.close(relays)
      callback(value)
    }
    const subscription = pool.subscribe(
      relays,
      { kinds: [NostrConnect], '#p': [clientPubkey], limit: 0 },
      {
        onevent(event) {
          if (!event.content?.includes('?iv=')) return
          let response
          try {
            response = JSON.parse(nip04Decrypt(clientSecretKey, event.pubkey, event.content))
          } catch {
            return
          }
          if (response.result !== secret) return
          finish(resolve, new LegacyNip04RemoteSigner({ clientSecretKey, remotePubkey: event.pubkey, relays }))
        },
        onclose() {
          if (!done) finish(reject, new Error('subscription closed before legacy NIP-04 connection was established.'))
        },
      },
    )

    if (typeof abortSignalOrTimeout === 'number') {
      timeoutId = setTimeout(
        () => finish(reject, new Error('Remote signer connection timed out. Check the signer app and relay.')),
        abortSignalOrTimeout,
      )
    } else if (abortSignalOrTimeout) {
      abortSignalOrTimeout.addEventListener('abort', () => finish(reject, new Error('Remote signer connection cancelled.')), { once: true })
    }
  })
}

export async function createRemoteSigner(input, options = {}) {
  const parsed = parseRemoteSignerUrl(input)
  if (parsed.type === 'nostrconnect' && !options.clientSecretKey) {
    throw new Error('Generated nostrconnect:// login requires the matching in-memory client key. Use the QR flow instead of pasting nostrconnect:// URLs.')
  }
  const clientSecretKey = options.clientSecretKey || generateSecretKey()
  const { timeoutMs = 60000, onauth, abortSignal } = options

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
      bunkerSigner = await Promise.any([
        BunkerSigner.fromURI(clientSecretKey, parsed.raw, { onauth }, abortSignal || timeoutMs),
        connectLegacyNip04FromUri(clientSecretKey, parsed.raw, abortSignal || timeoutMs),
      ])
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
