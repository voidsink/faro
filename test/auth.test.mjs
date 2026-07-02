import test from 'node:test'
import assert from 'node:assert/strict'
import {
  authLabelForSource,
  isSigningSource,
  safeIdentityForStorage,
} from '../src/services/auth/identity.js'
import {
  getNip07Pubkey,
  hasNip07Signer,
  loginWithNip07,
  nip07Signer,
} from '../src/services/auth/nip07.js'
import {
  createKeypair,
  keypairFromSecretKey,
  makeLocalSigner,
  parseSecretKey,
} from '../src/services/auth/secretKey.js'
import {
  buildBunkerUrl,
  createNostrConnectToken,
  createRemoteSigner,
  isRemoteSignerUrl,
  parseRemoteSignerUrl,
  safeRemoteSignerIdentity,
  secretKeyFromHex,
  secretKeyToHex,
} from '../src/services/auth/nip46.js'

test('auth labels and signing sources cover Faro login methods', () => {
  assert.equal(authLabelForSource('nip07'), 'Browser signer')
  assert.equal(authLabelForSource('pomegranate'), 'Google')
  assert.equal(isSigningSource('nsec'), true)
  assert.equal(isSigningSource('unknown'), false)
})

test('safeIdentityForStorage strips private key material', () => {
  const identity = safeIdentityForStorage({
    pubkey: 'abc',
    source: 'nsec',
    nsec: 'secret',
    secretKey: new Uint8Array([1]),
  })
  assert.deepEqual(identity, { pubkey: 'abc', source: 'nsec' })
})

test('secret key utilities generate and parse nsec keys', async () => {
  const keypair = createKeypair()
  assert.equal(keypair.pubkey.length, 64)
  assert.match(keypair.nsec, /^nsec/)

  const parsed = keypairFromSecretKey(parseSecretKey(keypair.nsec))
  assert.equal(parsed.pubkey, keypair.pubkey)

  const signer = makeLocalSigner(parsed.secretKey)
  assert.equal(await signer.getPublicKey(), keypair.pubkey)
  const signed = await signer.signEvent({ kind: 1, content: 'hello', tags: [], created_at: 1 })
  assert.equal(signed.pubkey, keypair.pubkey)
  assert.equal(signed.sig.length, 128)
})

test('parseBunkerUrl validates bunker URLs', () => {
  const pubkey = 'a'.repeat(64)
  const parsed = parseRemoteSignerUrl(
    `bunker://${pubkey}?relay=${encodeURIComponent('wss://relay.example')}`,
  )
  assert.equal(parsed.signerPubkey, pubkey)
  assert.deepEqual(parsed.relays, ['wss://relay.example'])
  assert.equal(parsed.secret, '')
  assert.throws(() => parseRemoteSignerUrl('https://example.com'), /bunker/)
  assert.throws(() => parseRemoteSignerUrl(`bunker://${pubkey}`), /relay/)
})

test('isRemoteSignerUrl recognizes bunker and nostrconnect schemes', () => {
  assert.equal(isRemoteSignerUrl('bunker://deadbeef'), true)
  assert.equal(isRemoteSignerUrl('nostrconnect://deadbeef'), true)
  assert.equal(isRemoteSignerUrl('https://example.com'), false)
  assert.equal(isRemoteSignerUrl(''), false)
})

test('parseRemoteSignerUrl supports nostrconnect:// URLs', () => {
  const pubkey = 'b'.repeat(64)
  const parsed = parseRemoteSignerUrl(
    `nostrconnect://${pubkey}?relay=${encodeURIComponent('wss://relay.example')}&secret=shh`,
  )
  assert.equal(parsed.type, 'nostrconnect')
  assert.equal(parsed.signerPubkey, pubkey)
  assert.deepEqual(parsed.relays, ['wss://relay.example'])
  assert.equal(parsed.secret, 'shh')
})

test('createNostrConnectToken creates a QR-ready connection URI and matching client key', () => {
  const token = createNostrConnectToken({
    relays: ['wss://relay.example'],
    secret: 'test-secret',
    name: 'Faro Test',
    url: 'https://faro.example',
  })
  const parsed = parseRemoteSignerUrl(token.uri)

  assert.equal(parsed.type, 'nostrconnect')
  assert.equal(parsed.signerPubkey, token.clientPubkey)
  assert.deepEqual(parsed.relays, ['wss://relay.example'])
  assert.equal(parsed.secret, 'test-secret')
  assert.match(token.uri, /perms=sign_event%3A1%2Csign_event%3A7%2Csign_event%3A24242/)
  assert.equal(token.clientSecretKey.length, 32)
})

test('createRemoteSigner rejects pasted nostrconnect URLs without the matching client key', async () => {
  const token = createNostrConnectToken({ relays: ['wss://relay.example'], secret: 'test-secret' })
  await assert.rejects(() => createRemoteSigner(token.uri), /matching in-memory client key/)
})

test('safeIdentityForStorage keeps remote signer reconnect metadata but strips private keys', () => {
  const identity = safeIdentityForStorage({
    pubkey: 'abc',
    source: 'bunker',
    raw: 'bunker://pubkey?secret=shh',
    clientSecretKey: new Uint8Array([1]),
    remoteSigner: { pubkey: 'abc' },
    secret: 'shh',
    signerPubkey: 'pubkey',
    relays: ['wss://relay'],
    bunkerUrl: 'bunker://pubkey?relay=wss%3A%2F%2Frelay',
    clientSecretKeyHex: '01'.repeat(32),
    encryption: 'nip04',
  })
  assert.deepEqual(identity, {
    pubkey: 'abc',
    source: 'bunker',
    signerPubkey: 'pubkey',
    relays: ['wss://relay'],
    bunkerUrl: 'bunker://pubkey?relay=wss%3A%2F%2Frelay',
    clientSecretKeyHex: '01'.repeat(32),
    encryption: 'nip04',
  })
})

test('remote signer reconnect helpers persist bunker pointer and client key', () => {
  const secretKey = Uint8Array.from(Array.from({ length: 32 }, (_, index) => index + 1))
  const hex = secretKeyToHex(secretKey)
  assert.deepEqual(secretKeyFromHex(hex), secretKey)

  const url = buildBunkerUrl({
    signerPubkey: 'd'.repeat(64),
    relays: ['wss://relay.example'],
    secret: 'one-time-secret',
  })
  const parsed = parseRemoteSignerUrl(url)
  assert.equal(parsed.type, 'bunker')
  assert.equal(parsed.signerPubkey, 'd'.repeat(64))
  assert.deepEqual(parsed.relays, ['wss://relay.example'])
  assert.equal(parsed.secret, '')
})

test('safeRemoteSignerIdentity keeps only safe metadata', () => {
  const parsed = parseRemoteSignerUrl(
    'bunker://' + 'c'.repeat(64) + '?relay=wss://relay.example&secret=shh',
  )
  const identity = safeRemoteSignerIdentity(parsed, 'accountpubkey', 'bunker')
  assert.equal(identity.source, 'bunker')
  assert.equal(identity.pubkey, 'accountpubkey')
  assert.equal(identity.signerPubkey, parsed.signerPubkey)
  assert.deepEqual(identity.relays, parsed.relays)
  assert.equal(identity.secret, undefined)
  assert.equal(identity.raw, undefined)
})

function makeMockWindow(pubkey = '') {
  return {
    nostr: {
      getPublicKey: () => Promise.resolve(pubkey),
      signEvent: (event) => Promise.resolve({ ...event, pubkey, sig: 'mock-sig' }),
    },
  }
}

test('hasNip07Signer detects a browser signer and rejects missing APIs', () => {
  assert.equal(hasNip07Signer(makeMockWindow('a'.repeat(64))), true)
  assert.equal(hasNip07Signer({ nostr: { getPublicKey: () => {} } }), false)
  assert.equal(hasNip07Signer({ nostr: { signEvent: () => {} } }), false)
  assert.equal(hasNip07Signer({}), false)
  assert.equal(hasNip07Signer(undefined), false)
})

test('getNip07Pubkey returns the live pubkey from the browser signer', async () => {
  const pubkey = 'a'.repeat(64)
  const win = makeMockWindow(pubkey)
  assert.equal(await getNip07Pubkey(win), pubkey)
})

test('getNip07Pubkey throws when no browser signer is present', async () => {
  await assert.rejects(() => getNip07Pubkey({}), /No browser signer detected/)
})

test('loginWithNip07 fetches a fresh pubkey every login', async () => {
  const pubkey = 'b'.repeat(64)
  const win = makeMockWindow(pubkey)
  const identity = await loginWithNip07(win)
  assert.deepEqual(identity, { pubkey, source: 'nip07' })
})

test('nip07Signer returns the browser signer API', () => {
  const win = makeMockWindow('c'.repeat(64))
  assert.equal(nip07Signer(win), win.nostr)
  assert.equal(nip07Signer({}), null)
})

test('loginWithNip07 fetches a fresh pubkey when the signer account has switched', async () => {
  const originalPubkey = 'd'.repeat(64)
  const switchedPubkey = 'e'.repeat(64)
  let callCount = 0
  const win = {
    nostr: {
      getPublicKey: () => {
        callCount += 1
        return Promise.resolve(callCount === 1 ? originalPubkey : switchedPubkey)
      },
      signEvent: (event) =>
        Promise.resolve({
          ...event,
          pubkey: callCount === 1 ? originalPubkey : switchedPubkey,
          sig: 'mock-sig',
        }),
    },
  }

  const first = await loginWithNip07(win)
  assert.equal(first.pubkey, originalPubkey)

  const second = await loginWithNip07(win)
  assert.equal(second.pubkey, switchedPubkey)
  assert.equal(second.source, 'nip07')
})

test('loginWithNip07 trusts the signed probe pubkey over stale authorization pubkey', async () => {
  const authorizedPubkey = 'f'.repeat(64)
  const activeSignerPubkey = '1'.repeat(64)
  const win = {
    nostr: {
      getPublicKey: () => Promise.resolve(authorizedPubkey),
      signEvent: (event) => Promise.resolve({ ...event, pubkey: activeSignerPubkey, sig: 'mock-sig' }),
    },
  }

  const identity = await loginWithNip07(win)
  assert.deepEqual(identity, { pubkey: activeSignerPubkey, source: 'nip07' })
})
