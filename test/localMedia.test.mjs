import test from 'node:test'
import assert from 'node:assert/strict'
import { blobToDataUrl, blobToSha256Hex, mediaMetadataFromBlob } from '../src/services/localMedia.js'

test('blobToSha256Hex hashes prepared media bytes', async () => {
  const blob = new Blob(['faro-media'], { type: 'image/jpeg' })

  assert.equal(await blobToSha256Hex(blob), '8635fb880b6b83c44ab9d3e4705527fa374015cdce69008b60e637533119605d')
})

test('blobToDataUrl preserves preview data URLs for local fallback', async () => {
  const blob = new Blob(['hello'], { type: 'image/jpeg' })

  assert.equal(await blobToDataUrl(blob), 'data:image/jpeg;base64,aGVsbG8=')
})

test('mediaMetadataFromBlob returns publish-ready media metadata', async () => {
  const blob = new Blob(['faro-media'], { type: 'image/jpeg' })

  assert.deepEqual(await mediaMetadataFromBlob(blob, { width: 1080, height: 1350, ratioKey: '4:3' }), {
    blob,
    mimeType: 'image/jpeg',
    sha256: '8635fb880b6b83c44ab9d3e4705527fa374015cdce69008b60e637533119605d',
    width: 1080,
    height: 1350,
    dimensions: '1080x1350',
    ratioKey: '4:3',
    bytes: 10,
  })
})
