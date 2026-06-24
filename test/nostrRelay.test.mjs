import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildMediaPostEvent,
  buildReactionEvent,
  buildReplyEvent,
  buildReplyFilter,
  buildReactionFilter,
  buildVisualFeedFilters,
  extractReactionSummary,
  mapReplyEvents,
} from '../src/services/nostrRelay.js'

const rootEvent = {
  id: 'a'.repeat(64),
  pubkey: 'b'.repeat(64),
}

const liker = 'c'.repeat(64)
const commenter = 'd'.repeat(64)

test('buildReactionFilter targets NIP-25 reactions by root event id', () => {
  assert.deepEqual(buildReactionFilter([rootEvent.id], { limit: 50 }), {
    kinds: [7],
    '#e': [rootEvent.id],
    limit: 50,
  })
})

test('extractReactionSummary counts positive reactions and detects viewer like', () => {
  const reactions = [
    { id: '1', kind: 7, pubkey: liker, content: '+', tags: [['e', rootEvent.id], ['p', rootEvent.pubkey]] },
    { id: '2', kind: 7, pubkey: 'e'.repeat(64), content: '🤙', tags: [['e', rootEvent.id]] },
    { id: '3', kind: 7, pubkey: 'f'.repeat(64), content: '-', tags: [['e', rootEvent.id]] },
  ]

  assert.deepEqual(extractReactionSummary(reactions, rootEvent.id, liker), {
    count: 2,
    likedByMe: true,
    reactions: [reactions[0], reactions[1]],
  })
})

test('buildReplyFilter targets kind 1 replies by root event id', () => {
  assert.deepEqual(buildReplyFilter([rootEvent.id], { limit: 80 }), {
    kinds: [1],
    '#e': [rootEvent.id],
    limit: 80,
  })
})

test('mapReplyEvents keeps only replies for the target and normalizes author references', () => {
  const reply = {
    id: '4',
    kind: 1,
    pubkey: commenter,
    content: 'Nice photo',
    created_at: 1710000000,
    tags: [['e', rootEvent.id, '', 'root'], ['p', rootEvent.pubkey]],
  }
  const unrelated = {
    id: '5',
    kind: 1,
    pubkey: commenter,
    content: 'Elsewhere',
    created_at: 1710000001,
    tags: [['e', '0'.repeat(64)]],
  }

  assert.deepEqual(mapReplyEvents([unrelated, reply], rootEvent.id), [
    {
      id: reply.id,
      eventId: rootEvent.id,
      pubkey: commenter,
      content: 'Nice photo',
      createdAt: '2024-03-09T16:00:00.000Z',
      tags: reply.tags,
      event: reply,
    },
  ])
})


test('buildMediaPostEvent creates a kind 1 media post with Blossom metadata tags', () => {
  assert.deepEqual(
    buildMediaPostEvent({
      caption: '  Golden hour #Faro #nostr  ',
      mediaUrl: 'https://blossom.example.com/abc.jpg',
      media: {
        sha256: 'a'.repeat(64),
        mimeType: 'image/jpeg',
        dimensions: '1080x1350',
      },
    }),
    {
      kind: 1,
      content: 'Golden hour #Faro #nostr https://blossom.example.com/abc.jpg',
      tags: [
        ['url', 'https://blossom.example.com/abc.jpg'],
        ['x', 'a'.repeat(64)],
        ['m', 'image/jpeg'],
        ['dim', '1080x1350'],
        ['t', 'faro'],
        ['t', 'nostr'],
      ],
    },
  )
})

test('buildReactionEvent creates a NIP-25 like event for a visual post', () => {
  assert.deepEqual(buildReactionEvent(rootEvent), {
    kind: 7,
    content: '+',
    tags: [['e', rootEvent.id], ['p', rootEvent.pubkey]],
  })
})

test('buildReplyEvent creates a kind 1 root reply for a visual post', () => {
  assert.deepEqual(buildReplyEvent(rootEvent, '  Great frame  '), {
    kind: 1,
    content: 'Great frame',
    tags: [['e', rootEvent.id, '', 'root'], ['p', rootEvent.pubkey]],
  })
})


test('buildVisualFeedFilters includes the viewer and followed authors for logged-in feeds', () => {
  const viewer = '1'.repeat(64)
  const followed = '2'.repeat(64)

  assert.deepEqual(buildVisualFeedFilters([viewer, followed], { limit: 12, since: 100, until: 200 }), [
    {
      kinds: [1],
      authors: [viewer, followed],
      limit: 48,
      since: 100,
      until: 200,
    },
  ])
})

test('buildVisualFeedFilters omits authors for logged-out global feed requests', () => {
  const [filter] = buildVisualFeedFilters([], { limit: 24, until: 200 })

  assert.deepEqual(filter, {
    kinds: [1],
    limit: 96,
    since: undefined,
    until: 200,
  })
  assert.equal(Object.hasOwn(filter, 'authors'), false)
})

test('buildVisualFeedFilters allows overriding raw relay fetch size', () => {
  const viewer = '1'.repeat(64)
  const [filter] = buildVisualFeedFilters([viewer], { limit: 50, filterLimit: 120, until: 200 })

  assert.deepEqual(filter, {
    kinds: [1],
    authors: [viewer],
    limit: 120,
    since: undefined,
    until: 200,
  })
})
