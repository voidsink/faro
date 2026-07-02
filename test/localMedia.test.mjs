import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ASPECT_RATIOS,
  JPEG_QUALITY,
  LOCAL_POSTS_STORAGE_KEY,
  MAX_IMAGE_SIDE,
  ORIGINAL_ASPECT_RATIO_KEY,
  blobToSha256Hex,
  estimateLocalStorageBytes,
  loadLocalPosts,
  mediaMetadataFromBlob,
} from '../src/services/localMedia.js'

test('ASPECT_RATIOS includes an Original / Natural option', () => {
  assert.equal(ORIGINAL_ASPECT_RATIO_KEY, 'original')
  assert.equal(ASPECT_RATIOS.original.label, 'Original')
  assert.equal(ASPECT_RATIOS.original.original, true)
})

test('mediaMetadataFromBlob returns ratioKey and dimensions', async () => {
  const blob = new Blob(['hello image'], { type: 'image/jpeg' })
  const meta = await mediaMetadataFromBlob(blob, { width: 1200, height: 900, ratioKey: '4:3' })
  assert.equal(meta.mimeType, 'image/jpeg')
  assert.equal(meta.width, 1200)
  assert.equal(meta.height, 900)
  assert.equal(meta.dimensions, '1200x900')
  assert.equal(meta.ratioKey, '4:3')
  assert.equal(meta.bytes, blob.size)
})

test('mediaMetadataFromBlob falls back to 1:1 for unknown ratios', async () => {
  const blob = new Blob(['x'], { type: 'image/png' })
  const meta = await mediaMetadataFromBlob(blob, { width: 1, height: 1, ratioKey: 'weird' })
  assert.equal(meta.ratioKey, '1:1')
})

test('blobToSha256Hex computes deterministic SHA-256 for a Blob', async () => {
  const blob = new Blob(['faro'], { type: 'text/plain' })
  const hash = await blobToSha256Hex(blob)
  assert.equal(hash.length, 64)
  assert.match(hash, /^[0-9a-f]+$/)
  const second = await blobToSha256Hex(new Blob(['faro'], { type: 'text/plain' }))
  assert.equal(hash, second)
})

test('estimateLocalStorageBytes approximates string byte size', () => {
  assert.equal(estimateLocalStorageBytes('abc'), 6)
  assert.equal(estimateLocalStorageBytes({ a: 1 }) > 0, true)
})

test('loadLocalPosts returns empty array when storage is empty', () => {
  const previousLocalStorage = globalThis.localStorage
  globalThis.localStorage = {
    getItem: () => null,
    removeItem: () => {},
    setItem: () => {},
  }

  try {
    assert.deepEqual(loadLocalPosts(), [])
  } finally {
    if (previousLocalStorage === undefined) {
      delete globalThis.localStorage
    } else {
      globalThis.localStorage = previousLocalStorage
    }
  }
})

test('constants expose expected defaults', () => {
  assert.equal(typeof LOCAL_POSTS_STORAGE_KEY, 'string')
  assert.equal(MAX_IMAGE_SIDE, 1400)
  assert.equal(JPEG_QUALITY, 0.82)
})
