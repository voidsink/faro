export const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://relay.nostr.band',
]
export const RELAYS_STORAGE_KEY = 'faro-relays'


const DEFAULT_TIMEOUT_MS = 8000
const MAX_VISUAL_EVENTS = 80
const IMAGE_EXTENSIONS = '(?:jpe?g|png|webp|gif)'
const URL_PATTERN = /https?:\/\/[^\s<>'"`]+/gi
const HEX64_PATTERN = /^[0-9a-f]{64}$/i

function uniqueStrings(values) {
  return [...new Set((values || []).filter(Boolean))]
}

export function normalizeRelays(relays = DEFAULT_RELAYS) {
  const normalized = uniqueStrings(relays)
    .map((relay) => String(relay || '').trim().replace(/\/+$/, ''))
    .filter((relay) => /^wss?:\/\//i.test(relay))
  return normalized.length ? normalized : [...DEFAULT_RELAYS]
}

export function parseRelayList(value) {
  if (Array.isArray(value)) return normalizeRelays(value)
  return normalizeRelays(
    String(value || '')
      .split(/[\n, ]+/)
      .map((relay) => relay.trim())
      .filter(Boolean),
  )
}

export function loadRelays() {
  try {
    const stored = localStorage.getItem(RELAYS_STORAGE_KEY)
    return stored ? parseRelayList(JSON.parse(stored)) : [...DEFAULT_RELAYS]
  } catch {
    return [...DEFAULT_RELAYS]
  }
}

export function saveRelays(relays) {
  const normalized = parseRelayList(relays)
  try {
    localStorage.setItem(RELAYS_STORAGE_KEY, JSON.stringify(normalized))
  } catch {
    // Ignore storage failures; caller can still use returned relays in memory.
  }
  return normalized
}

export function relaysForOptions(options = {}) {
  return normalizeRelays(options.relays || loadRelays())
}

function isValidPubkey(pubkey) {
  return typeof pubkey === 'string' && HEX64_PATTERN.test(pubkey)
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000)
}

function eventReferencesId(event, eventId) {
  return (event?.tags || []).some((tag) => Array.isArray(tag) && tag[0] === 'e' && tag[1] === eventId)
}

function isPositiveReaction(event) {
  const content = typeof event?.content === 'string' ? event.content.trim() : ''
  return content !== '-'
}

function hashtagsFromText(text) {
  return uniqueStrings(
    [...String(text || '').matchAll(/(^|\s)#([\p{L}\p{N}_-]+)/gu)]
      .map((match) => match[2].toLowerCase())
      .filter(Boolean),
  )
}

function makeSubId() {
  return `faro-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}


function closeSocket(socket) {
  try {
    if (socket && socket.readyState <= WebSocket.OPEN) {
      socket.close()
    }
  } catch {
    // Best-effort cleanup only.
  }
}

function cleanUrl(url) {
  return url.replace(/[),.;!?\]}]+$/g, '')
}

function isImageUrl(url) {
  try {
    const parsed = new URL(cleanUrl(url))
    return new RegExp(`\\.${IMAGE_EXTENSIONS}$`, 'i').test(parsed.pathname)
  } catch {
    return false
  }
}

function readTagValue(tag) {
  if (!Array.isArray(tag)) return ''

  if (tag[0] === 'url' && typeof tag[1] === 'string') return tag[1]

  if (tag[0] === 'imeta') {
    const urlPart = tag.find((part) => typeof part === 'string' && part.startsWith('url '))
    return urlPart ? urlPart.slice(4).trim() : ''
  }

  return ''
}

export function extractImageUrls(event) {
  const urls = []
  const content = typeof event?.content === 'string' ? event.content : ''

  for (const match of content.matchAll(URL_PATTERN)) {
    const url = cleanUrl(match[0])
    if (isImageUrl(url)) urls.push(url)
  }

  for (const tag of event?.tags || []) {
    const value = readTagValue(tag)
    if (!value) continue

    for (const match of value.matchAll(URL_PATTERN)) {
      const url = cleanUrl(match[0])
      if (isImageUrl(url)) urls.push(url)
    }

    if (/^https?:\/\//i.test(value) && isImageUrl(value)) {
      urls.push(cleanUrl(value))
    }
  }

  return uniqueStrings(urls)
}

export function requestEvents({ relays = DEFAULT_RELAYS, filters = [], timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const relayUrls = normalizeRelays(relays)
  const safeFilters = Array.isArray(filters) ? filters.filter(Boolean) : []

  if (!relayUrls.length || !safeFilters.length || typeof WebSocket === 'undefined') {
    return Promise.resolve([])
  }

  return new Promise((resolve) => {
    const eventsById = new Map()
    const sockets = []
    const completedRelays = new Set()
    const subId = makeSubId()
    let settled = false

    const finish = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      sockets.forEach(closeSocket)
      resolve([...eventsById.values()].sort((a, b) => (b.created_at || 0) - (a.created_at || 0)))
    }

    const markComplete = (relayUrl) => {
      completedRelays.add(relayUrl)
      if (completedRelays.size >= relayUrls.length) finish()
    }

    const timer = setTimeout(finish, timeoutMs)

    for (const relayUrl of relayUrls) {
      let socket

      try {
        socket = new WebSocket(relayUrl)
      } catch {
        markComplete(relayUrl)
        continue
      }

      sockets.push(socket)

      socket.onopen = () => {
        socket.send(JSON.stringify(['REQ', subId, ...safeFilters]))
      }

      socket.onmessage = (message) => {
        try {
          const data = JSON.parse(message.data)
          if (!Array.isArray(data) || data[1] !== subId) return

          if (data[0] === 'EVENT' && data[2]?.id) {
            eventsById.set(data[2].id, data[2])
          }

          if (data[0] === 'EOSE') {
            try {
              socket.send(JSON.stringify(['CLOSE', subId]))
            } catch {
              // Ignore close-send failures.
            }
            markComplete(relayUrl)
          }
        } catch {
          // Ignore malformed relay messages.
        }
      }

      socket.onerror = () => markComplete(relayUrl)
      socket.onclose = () => markComplete(relayUrl)
    }
  })
}

export async function fetchProfile(pubkey, options = {}) {
  const fallback = {
    ok: false,
    pubkey,
    profile: {
      name: '',
      display_name: '',
      picture: '',
      banner: '',
      about: '',
      nip05: '',
    },
    event: null,
    error: null,
  }

  if (!isValidPubkey(pubkey)) return { ...fallback, error: 'Invalid pubkey' }

  try {
    const events = await requestEvents({
      relays: relaysForOptions(options),
      timeoutMs: options.timeoutMs || DEFAULT_TIMEOUT_MS,
      filters: [{ kinds: [0], authors: [pubkey], limit: 1 }],
    })
    const event = events[0]
    if (!event) return fallback

    return {
      ...fallback,
      ok: true,
      profile: { ...fallback.profile, ...JSON.parse(event.content || '{}') },
      event,
    }
  } catch (error) {
    return { ...fallback, error: error?.message || 'Profile fetch failed' }
  }
}

export async function fetchFollowing(pubkey, options = {}) {
  const fallback = { ok: false, pubkey, pubkeys: [], event: null, error: null }

  if (!isValidPubkey(pubkey)) return { ...fallback, error: 'Invalid pubkey' }

  try {
    const events = await requestEvents({
      relays: relaysForOptions(options),
      timeoutMs: options.timeoutMs || DEFAULT_TIMEOUT_MS,
      filters: [{ kinds: [3], authors: [pubkey], limit: 1 }],
    })
    const event = events[0]
    if (!event) return fallback

    return {
      ...fallback,
      ok: true,
      pubkeys: uniqueStrings(
        (event.tags || [])
          .filter((tag) => tag[0] === 'p' && isValidPubkey(tag[1]))
          .map((tag) => tag[1]),
      ),
      relayHints: relayHintsFromFollowingEvent(event),
      event,
    }
  } catch (error) {
    return { ...fallback, error: error?.message || 'Following fetch failed' }
  }
}

export function relayHintsFromFollowingEvent(event) {
  return normalizeRelays(
    (event?.tags || [])
      .filter((tag) => tag[0] === 'p' && tag[2])
      .map((tag) => tag[2]),
  )
}

export async function fetchVisualFeed(authors, options = {}) {
  const authorList = uniqueStrings(authors).filter(isValidPubkey)
  const fallback = { ok: false, authors: authorList, events: [], error: null }

  if (!authorList.length) return { ...fallback, error: 'No valid authors' }

  try {
    const events = await requestEvents({
      relays: relaysForOptions(options),
      timeoutMs: options.timeoutMs || DEFAULT_TIMEOUT_MS,
      filters: [
        {
          kinds: [1],
          authors: authorList,
          limit: options.limit || MAX_VISUAL_EVENTS,
          until: options.until || nowSeconds(),
        },
      ],
    })

    return {
      ...fallback,
      ok: true,
      events: events
        .map((event) => ({ ...event, imageUrls: extractImageUrls(event) }))
        .filter((event) => event.imageUrls.length),
    }
  } catch (error) {
    return { ...fallback, error: error?.message || 'Visual feed fetch failed' }
  }
}

export function buildMediaPostEvent({ caption = '', mediaUrl, media = {} } = {}) {
  const cleanCaption = String(caption || '').trim()
  const cleanUrl = String(mediaUrl || '').trim()
  const content = [cleanCaption, cleanUrl].filter(Boolean).join(' ')
  const tags = []

  if (cleanUrl) tags.push(['url', cleanUrl])
  if (media.sha256) tags.push(['x', media.sha256])
  if (media.mimeType) tags.push(['m', media.mimeType])
  if (media.dimensions) tags.push(['dim', media.dimensions])
  for (const hashtag of hashtagsFromText(cleanCaption)) {
    tags.push(['t', hashtag])
  }

  return {
    kind: 1,
    content,
    tags,
  }
}

export function buildReactionEvent(rootEvent) {
  return {
    kind: 7,
    content: '+',
    tags: [['e', rootEvent.id], ['p', rootEvent.pubkey]],
  }
}

export function buildReplyEvent(rootEvent, content) {
  return {
    kind: 1,
    content: String(content || '').trim(),
    tags: [['e', rootEvent.id, '', 'root'], ['p', rootEvent.pubkey]],
  }
}

export async function publishEvent(event, options = {}) {
  const relayUrls = relaysForOptions(options)
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS
  const fallback = { ok: false, event, results: [], error: null }

  if (!event?.id || !relayUrls.length || typeof WebSocket === 'undefined') {
    return { ...fallback, error: 'Cannot publish event in this environment' }
  }

  const results = await Promise.all(
    relayUrls.map(
      (relayUrl) =>
        new Promise((resolve) => {
          let socket
          let settled = false
          const finish = (result) => {
            if (settled) return
            settled = true
            clearTimeout(timer)
            closeSocket(socket)
            resolve(result)
          }
          const timer = setTimeout(
            () => finish({ relay: relayUrl, ok: false, message: 'Publish timed out' }),
            timeoutMs,
          )

          try {
            socket = new WebSocket(relayUrl)
          } catch (error) {
            finish({ relay: relayUrl, ok: false, message: error?.message || 'Could not open relay' })
            return
          }

          socket.onopen = () => socket.send(JSON.stringify(['EVENT', event]))
          socket.onmessage = (message) => {
            try {
              const data = JSON.parse(message.data)
              if (Array.isArray(data) && data[0] === 'OK' && data[1] === event.id) {
                finish({ relay: relayUrl, ok: Boolean(data[2]), message: data[3] || '' })
              }
            } catch {
              // Ignore malformed relay messages.
            }
          }
          socket.onerror = () => finish({ relay: relayUrl, ok: false, message: 'Relay connection failed' })
          socket.onclose = () => finish({ relay: relayUrl, ok: false, message: 'Relay closed before OK' })
        }),
    ),
  )

  return { ok: results.some((result) => result.ok), event, results, error: null }
}

export async function signAndPublish(unsignedEvent, options = {}) {
  const signer = options.signer || globalThis.window?.nostr
  const fallback = { ok: false, event: null, results: [], error: null }

  if (!signer?.signEvent) return { ...fallback, error: 'No NIP-07 signer available' }

  try {
    const event = await signer.signEvent({
      ...unsignedEvent,
      created_at: unsignedEvent.created_at || nowSeconds(),
    })
    const publishResult = await publishEvent(event, options)
    return { ...publishResult, event }
  } catch (error) {
    return { ...fallback, error: error?.message || 'Signing failed' }
  }
}

export async function publishReaction(rootEvent, options = {}) {
  return signAndPublish(buildReactionEvent(rootEvent), options)
}

export async function publishReply(rootEvent, content, options = {}) {
  return signAndPublish(buildReplyEvent(rootEvent, content), options)
}

export async function publishMediaPost({ caption, mediaUrl, media } = {}, options = {}) {
  return signAndPublish(buildMediaPostEvent({ caption, mediaUrl, media }), options)
}

export function buildReactionFilter(eventIds, options = {}) {
  return {
    kinds: [7],
    '#e': uniqueStrings(eventIds).filter((eventId) => HEX64_PATTERN.test(eventId)),
    limit: options.limit || 200,
  }
}

export function buildReplyFilter(eventIds, options = {}) {
  return {
    kinds: [1],
    '#e': uniqueStrings(eventIds).filter((eventId) => HEX64_PATTERN.test(eventId)),
    limit: options.limit || 200,
  }
}

export function extractReactionSummary(events, eventId, viewerPubkey = '') {
  const reactions = (events || []).filter(
    (event) => event?.kind === 7 && eventReferencesId(event, eventId) && isPositiveReaction(event),
  )

  return {
    count: reactions.length,
    likedByMe: Boolean(viewerPubkey && reactions.some((event) => event.pubkey === viewerPubkey)),
    reactions,
  }
}

export function mapReplyEvents(events, eventId) {
  return (events || [])
    .filter((event) => event?.kind === 1 && eventReferencesId(event, eventId))
    .sort((a, b) => (a.created_at || 0) - (b.created_at || 0))
    .map((event) => ({
      id: event.id,
      eventId,
      pubkey: event.pubkey,
      content: event.content || '',
      createdAt: new Date((event.created_at || nowSeconds()) * 1000).toISOString(),
      tags: event.tags || [],
      event,
    }))
}

export async function fetchInteractions(eventIds, options = {}) {
  const ids = uniqueStrings(eventIds).filter((eventId) => HEX64_PATTERN.test(eventId))
  const fallback = { ok: false, interactions: {}, error: null }

  if (!ids.length) return { ...fallback, error: 'No valid event ids' }

  try {
    const [reactionEvents, replyEvents] = await Promise.all([
      requestEvents({
        relays: relaysForOptions(options),
        timeoutMs: options.timeoutMs || DEFAULT_TIMEOUT_MS,
        filters: [buildReactionFilter(ids, { limit: options.reactionLimit || 300 })],
      }),
      requestEvents({
        relays: relaysForOptions(options),
        timeoutMs: options.timeoutMs || DEFAULT_TIMEOUT_MS,
        filters: [buildReplyFilter(ids, { limit: options.replyLimit || 300 })],
      }),
    ])

    const interactions = Object.fromEntries(
      ids.map((eventId) => {
        const reactionSummary = extractReactionSummary(reactionEvents, eventId, options.viewerPubkey)
        return [
          eventId,
          {
            ...reactionSummary,
            replies: mapReplyEvents(replyEvents, eventId),
          },
        ]
      }),
    )

    return { ok: true, interactions, error: null }
  } catch (error) {
    return { ...fallback, error: error?.message || 'Interaction fetch failed' }
  }
}
