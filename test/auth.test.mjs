import test from 'node:test'
import assert from 'node:assert/strict'
import {
  authLabelForSource,
  isSigningSource,
  safeIdentityForStorage,
} from '../src/services/auth/identity.js'
import {
  createKeypair,
  keypairFromSecretKey,
  makeLocalSigner,
  parseSecretKey,
} from '../src/services/auth/secretKey.js'
import {
  createNostrConnectToken,
  isRemoteSignerUrl,
  parseRemoteSignerUrl,
  safeRemoteSignerIdentity,
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

test('safeIdentityForStorage strips remote signer secrets', () => {
  const identity = safeIdentityForStorage({
    pubkey: 'abc',
    source: 'bunker',
    raw: 'bunker://pubkey?secret=shh',
    clientSecretKey: new Uint8Array([1]),
    remoteSigner: { pubkey: 'abc' },
    secret: 'shh',
    signerPubkey: 'pubkey',
    relays: ['wss://relay'],
  })
  assert.deepEqual(identity, {
    pubkey: 'abc',
    source: 'bunker',
    signerPubkey: 'pubkey',
    relays: ['wss://relay'],
  })
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
