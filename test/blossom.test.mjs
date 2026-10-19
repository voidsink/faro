import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BLOSSOM_SERVER_STORAGE_KEY,
  buildBlossomAuthEvent,
  buildBlossomUploadUrl,
  loadBlossomServers,
  normalizeBlossomServerUrl,
  uploadBlobToBlossom,
} from '../src/services/blossom.js'

test('normalizeBlossomServerUrl accepts http servers and trims trailing slashes', () => {
  assert.equal(
    normalizeBlossomServerUrl(' https://blossom.example.com/// '),
    'https://blossom.example.com',
  )
  assert.equal(
    normalizeBlossomServerUrl('http://localhost:3000/upload'),
    'http://localhost:3000/upload',
  )
})

test('normalizeBlossomServerUrl rejects non-http servers', () => {
  assert.equal(normalizeBlossomServerUrl('wss://relay.example.com'), '')
  assert.equal(normalizeBlossomServerUrl(''), '')
})

test('buildBlossomUploadUrl posts to server upload endpoint', () => {
  assert.equal(
    buildBlossomUploadUrl('https://blossom.example.com'),
    'https://blossom.example.com/upload',
  )
  assert.equal(
    buildBlossomUploadUrl('https://blossom.example.com/upload'),
    'https://blossom.example.com/upload',
  )
})

test('buildBlossomAuthEvent creates a BUD-11 upload authorization event', () => {
  assert.deepEqual(
    buildBlossomAuthEvent({
      uploadUrl: 'https://blossom.example.com/upload',
      sha256: 'a'.repeat(64),
      mimeType: 'image/jpeg',
      size: 123,
      now: () => 1710000000,
    }),
    {
      kind: 24242,
      created_at: 1710000000,
      content: 'Upload Blob',
      tags: [
        ['t', 'upload'],
        ['expiration', '1710000600'],
        ['x', 'a'.repeat(64)],
        ['server', 'blossom.example.com'],
        ['m', 'image/jpeg'],
        ['size', '123'],
      ],
    },
  )
})

test('BLOSSOM_SERVER_STORAGE_KEY is app-specific', () => {
  assert.equal(BLOSSOM_SERVER_STORAGE_KEY, 'faro-blossom-server')
})

test('loadBlossomServers uses all defaults when no setting is saved', () => {
  const previousLocalStorage = globalThis.localStorage
  globalThis.localStorage = {
    getItem: () => null,
  }

  try {
    assert.deepEqual(loadBlossomServers(), [
      'https://blossom.nostr.build',
      'https://cdn.nostrverse.net',
      'https://cdn.satellite.earth',
      'https://blssm.us',
    ])
  } finally {
    if (previousLocalStorage === undefined) {
      delete globalThis.localStorage
    } else {
      globalThis.localStorage = previousLocalStorage
    }
  }
})

test('loadBlossomServers updates saved defaults and preserves custom settings', () => {
  const previousLocalStorage = globalThis.localStorage
  let stored
  globalThis.localStorage = { getItem: () => stored }
  try {
    stored = JSON.stringify([
      'https://cdn.nostrverse.net',
      'https://cdn.satellite.earth',
      'https://blssm.us',
    ])
    assert.equal(loadBlossomServers()[0], 'https://blossom.nostr.build')
    stored = JSON.stringify(['https://custom.example', 'https://blssm.us'])
    assert.deepEqual(loadBlossomServers(), ['https://custom.example', 'https://blssm.us'])
    stored = 'https://legacy.example'
    assert.deepEqual(loadBlossomServers(), ['https://legacy.example'])
  } finally {
    if (previousLocalStorage === undefined) delete globalThis.localStorage
    else globalThis.localStorage = previousLocalStorage
  }
})

test('uploadBlobToBlossom signs scoped auth and falls back after network and authorization failures', async () => {
  const media = { blob: new Blob(['image'], { type: 'image/jpeg' }), sha256: 'a'.repeat(64) }
  const signedEvents = []
  const signer = {
    signEvent: async (event) => {
      signedEvents.push(event)
      return { ...event, sig: 'test-signature' }
    },
  }
  const servers = [
    'https://timeout.example',
    'https://denied.example',
    'https://blossom.nostr.build',
  ]
  const result = await uploadBlobToBlossom(media, {
    serverUrls: servers,
    signer,
    fetchImpl: async (url, options) => {
      assert.equal(options.method, 'PUT')
      assert.equal(options.body, media.blob)
      assert.equal(options.headers['Content-Type'], 'image/jpeg')
      assert.equal(options.headers['X-SHA-256'], media.sha256)
      const token = options.headers.Authorization.slice('Nostr '.length)
      assert.match(token, /^[A-Za-z0-9_-]+$/)
      const auth = JSON.parse(Buffer.from(token, 'base64url').toString())
      assert.equal(auth.kind, 24242)
      assert.deepEqual(
        auth.tags.find(([name]) => name === 'server'),
        ['server', new URL(url).host],
      )
      assert.deepEqual(
        auth.tags.find(([name]) => name === 'x'),
        ['x', media.sha256],
      )
      if (url.startsWith(servers[0])) throw new TypeError('Failed to fetch')
      if (url.startsWith(servers[1])) {
        return new Response('Unauthorized', {
          status: 401,
          headers: { 'X-Reason': 'Invalid token' },
        })
      }
      return Response.json({ url: `${servers[2]}/${media.sha256}.jpg` }, { status: 201 })
    },
  })
  assert.equal(result.ok, true)
  assert.equal(result.serverUrl, servers[2])
  assert.equal(result.url, `${servers[2]}/${media.sha256}.jpg`)
  assert.equal(signedEvents.length, 3)
  assert.deepEqual(
    result.attempts.map(({ ok }) => ok),
    [false, false, true],
  )
  assert.match(result.attempts[1].error, /401.*Invalid token/)
})

test('uploadBlobToBlossom includes the server response when all uploads fail', async () => {
  const result = await uploadBlobToBlossom(
    { blob: new Blob(['image']) },
    {
      serverUrl: 'https://denied.example',
      signer: { signEvent: async (event) => event },
      fetchImpl: async () => new Response('Upload not permitted', { status: 401 }),
    },
  )
  assert.equal(result.ok, false)
  assert.match(result.error, /https:\/\/denied.example:.*401.*Upload not permitted/)
})
