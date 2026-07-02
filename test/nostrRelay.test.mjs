import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildVisualFeedFilters,
  buildReactionFilter,
  buildReplyFilter,
  buildZapFilter,
  extractImageUrls,
  extractVisualUrls,
  extractZapSummary,
  loadFollowedHashtags,
  normalizeHashtags,
  normalizeRelays,
  saveFollowedHashtags,
} from '../src/services/nostrRelay.js'

test('normalizeRelays trims and filters wss URLs', () => {
  assert.deepEqual(normalizeRelays(['wss://relay.example///', '', 'ftp://bad']), [
    'wss://relay.example',
  ])
})

test('normalizeHashtags strips hash prefixes and deduplicates tags', () => {
  assert.deepEqual(normalizeHashtags(['#Bitcoin', ' nostr ', 'bitcoin', '', '#Nostr']), [
    'bitcoin',
    'nostr',
  ])
})

test('followed hashtags are scoped by pubkey', () => {
  const store = new Map()
  const originalLocalStorage = globalThis.localStorage
  globalThis.localStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, String(value)),
  }

  try {
    saveFollowedHashtags(['#bitcoin'], 'a'.repeat(64))
    saveFollowedHashtags(['#nostr'], 'b'.repeat(64))

    assert.deepEqual(loadFollowedHashtags('a'.repeat(64)), ['bitcoin'])
    assert.deepEqual(loadFollowedHashtags('b'.repeat(64)), ['nostr'])
    assert.deepEqual(loadFollowedHashtags(), [])
  } finally {
    globalThis.localStorage = originalLocalStorage
  }
})

test('buildVisualFeedFilters fetches followed authors and followed hashtags as OR filters', () => {
  const author = 'a'.repeat(64)
  const filters = buildVisualFeedFilters([author], {
    tags: ['bitcoin', '#photography'],
    since: 10,
    until: 20,
    limit: 12,
  })

  assert.equal(filters.length, 3)
  assert.deepEqual(filters[0], {
    kinds: [1],
    limit: 48,
    since: 10,
    until: 20,
    authors: [author],
  })
  assert.deepEqual(filters[1], {
    kinds: [1],
    limit: 48,
    since: 10,
    until: 20,
    '#t': ['bitcoin'],
  })
  assert.deepEqual(filters[2]['#t'], ['photography'])
})

test('extractVisualUrls separates images and videos from content', () => {
  const event = {
    content: 'Check this out https://example.com/photo.jpg and https://example.com/clip.mp4',
    tags: [],
  }
  const { images, videos } = extractVisualUrls(event)
  assert.deepEqual(images, ['https://example.com/photo.jpg'])
  assert.deepEqual(videos, ['https://example.com/clip.mp4'])
})

test('extractVisualUrls reads urls from imeta and url tags', () => {
  const event = {
    content: '',
    tags: [
      ['url', 'https://cdn.example/media.webm'],
      ['imeta', 'url https://cdn.example/alt.mov'],
    ],
  }
  const { images, videos } = extractVisualUrls(event)
  assert.deepEqual(images, [])
  assert.deepEqual(videos, ['https://cdn.example/media.webm', 'https://cdn.example/alt.mov'])
})

test('extractImageUrls remains a convenience for images only', () => {
  const event = {
    content: 'https://a.com/pic.png https://a.com/movie.m4v',
    tags: [],
  }
  assert.deepEqual(extractImageUrls(event), ['https://a.com/pic.png'])
})

test('buildZapFilter targets kind 9735 by event id', () => {
  const ids = ['a'.repeat(64), 'b'.repeat(64)]
  const filter = buildZapFilter(ids)
  assert.deepEqual(filter.kinds, [9735])
  assert.deepEqual(filter['#e'], ids)
  assert.equal(filter.limit, 200)
})

test('extractZapSummary counts zap receipts and sums sats from bolt11', () => {
  const eventId = 'c'.repeat(64)
  const zaps = [
    {
      kind: 9735,
      id: 'z1',
      tags: [
        ['e', eventId],
        ['bolt11', 'lnbc10u1pv'],
      ],
    },
    {
      kind: 9735,
      id: 'z2',
      tags: [
        ['e', eventId],
        ['bolt11', 'lnbc100n1pv'],
      ],
    },
    { kind: 9735, id: 'z3', tags: [['e', 'other']] },
  ]
  const summary = extractZapSummary(zaps, eventId)
  assert.equal(summary.zapCount, 2)
  assert.equal(summary.sats, 1010)
  assert.equal(summary.msats, 1010000)
})

test('extractZapSummary prefers amount from zap request description', () => {
  const eventId = 'd'.repeat(64)
  const description = JSON.stringify({ tags: [['amount', '1234567']] })
  const zaps = [
    {
      kind: 9735,
      id: 'z1',
      tags: [
        ['e', eventId],
        ['description', description],
        ['bolt11', 'lnbc1u1pv'],
      ],
    },
  ]
  const summary = extractZapSummary(zaps, eventId)
  assert.equal(summary.zapCount, 1)
  assert.equal(summary.msats, 1234567)
  assert.equal(summary.sats, 1234)
})

test('extractZapSummary does not return a count key that could overwrite reaction counts', () => {
  const eventId = 'e'.repeat(64)
  const zaps = [
    {
      kind: 9735,
      id: 'z1',
      tags: [
        ['e', eventId],
        ['bolt11', 'lnbc5u1pv'],
      ],
    },
  ]
  const summary = extractZapSummary(zaps, eventId)
  assert.equal(summary.zapCount, 1)
  assert.equal(summary.sats, 500)
  assert.ok(!('count' in summary))
})

test('extractZapSummary returns zero counts when no receipts reference the event', () => {
  const eventId = 'f'.repeat(64)
  const zaps = [
    {
      kind: 9735,
      id: 'z1',
      tags: [
        ['e', 'other'],
        ['bolt11', 'lnbc1u1pv'],
      ],
    },
    { kind: 1, id: 'n1', tags: [['e', eventId]] },
  ]
  const summary = extractZapSummary(zaps, eventId)
  assert.equal(summary.zapCount, 0)
  assert.equal(summary.sats, 0)
  assert.equal(summary.msats, 0)
})

test('extractVisualUrls detects all required video extensions', () => {
  const extensions = ['mp4', 'webm', 'ogv', 'mov', 'm4v']
  const content = extensions.map((ext, index) => `https://x.com/v${index}.${ext}`).join(' ')
  const { images, videos } = extractVisualUrls({ content, tags: [] })
  assert.equal(images.length, 0)
  assert.equal(videos.length, extensions.length)
  for (const ext of extensions) {
    assert.ok(videos.some((url) => url.endsWith(`.${ext}`)))
  }
})

test('extractVisualUrls is case-insensitive and ignores query strings', () => {
  const event = {
    content: 'https://x.com/clip.MP4?token=abc https://x.com/photo.JPG?size=2',
    tags: [],
  }
  const { images, videos } = extractVisualUrls(event)
  assert.deepEqual(images, ['https://x.com/photo.JPG?size=2'])
  assert.deepEqual(videos, ['https://x.com/clip.MP4?token=abc'])
})

test('extractVisualUrls deduplicates urls across content and tags', () => {
  const event = {
    content: 'Watch https://x.com/clip.mp4',
    tags: [['url', 'https://x.com/clip.mp4']],
  }
  const { videos } = extractVisualUrls(event)
  assert.deepEqual(videos, ['https://x.com/clip.mp4'])
})

test('extractVisualUrls ignores non-visual urls', () => {
  const event = {
    content: 'https://x.com/page.html and https://x.com/file.pdf',
    tags: [],
  }
  const { images, videos } = extractVisualUrls(event)
  assert.deepEqual(images, [])
  assert.deepEqual(videos, [])
})
