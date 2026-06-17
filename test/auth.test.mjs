import test from 'node:test'
import assert from 'node:assert/strict'
import { authLabelForSource, isSigningSource, safeIdentityForStorage } from '../src/services/auth/identity.js'
import { createKeypair, keypairFromSecretKey, makeLocalSigner, parseSecretKey } from '../src/services/auth/secretKey.js'
import { parseRemoteSignerUrl } from '../src/services/auth/nip46.js'

test('auth labels and signing sources cover Faro login methods', () => {
  assert.equal(authLabelForSource('nip07'), 'Browser signer')
  assert.equal(authLabelForSource('pomegranate'), 'Google')
  assert.equal(isSigningSource('nsec'), true)
  assert.equal(isSigningSource('unknown'), false)
})

test('safeIdentityForStorage strips private key material', () => {
  const identity = safeIdentityForStorage({ pubkey: 'abc', source: 'nsec', nsec: 'secret', secretKey: new Uint8Array([1]) })
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
  const parsed = parseRemoteSignerUrl(`bunker://${pubkey}?relay=${encodeURIComponent('wss://relay.example')}`)
  assert.equal(parsed.signerPubkey, pubkey)
  assert.deepEqual(parsed.relays, ['wss://relay.example'])
  assert.throws(() => parseRemoteSignerUrl('https://example.com'), /bunker/)
  assert.throws(() => parseRemoteSignerUrl(`bunker://${pubkey}`), /relay/)
})
