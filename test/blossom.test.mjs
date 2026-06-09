import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BLOSSOM_SERVER_STORAGE_KEY,
  buildBlossomAuthEvent,
  buildBlossomUploadUrl,
  normalizeBlossomServerUrl,
} from '../src/services/blossom.js'

test('normalizeBlossomServerUrl accepts http servers and trims trailing slashes', () => {
  assert.equal(normalizeBlossomServerUrl(' https://blossom.example.com/// '), 'https://blossom.example.com')
  assert.equal(normalizeBlossomServerUrl('http://localhost:3000/upload'), 'http://localhost:3000/upload')
})

test('normalizeBlossomServerUrl rejects non-http servers', () => {
  assert.equal(normalizeBlossomServerUrl('wss://relay.example.com'), '')
  assert.equal(normalizeBlossomServerUrl(''), '')
})

test('buildBlossomUploadUrl posts to server upload endpoint', () => {
  assert.equal(buildBlossomUploadUrl('https://blossom.example.com'), 'https://blossom.example.com/upload')
  assert.equal(buildBlossomUploadUrl('https://blossom.example.com/upload'), 'https://blossom.example.com/upload')
})

test('buildBlossomAuthEvent creates a NIP-98-style upload authorization event', () => {
  assert.deepEqual(
    buildBlossomAuthEvent({
      uploadUrl: 'https://blossom.example.com/upload',
      sha256: 'a'.repeat(64),
      mimeType: 'image/jpeg',
      size: 123,
      now: () => 1710000000,
    }),
    {
      kind: 27235,
      created_at: 1710000000,
      content: '',
      tags: [
        ['u', 'https://blossom.example.com/upload'],
        ['method', 'PUT'],
        ['x', 'a'.repeat(64)],
        ['m', 'image/jpeg'],
        ['size', '123'],
      ],
    },
  )
})

test('BLOSSOM_SERVER_STORAGE_KEY is app-specific', () => {
  assert.equal(BLOSSOM_SERVER_STORAGE_KEY, 'faro-blossom-server')
})
