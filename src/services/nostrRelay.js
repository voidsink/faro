import { SimplePool } from 'nostr-tools/pool'
import { validateEvent, verifyEvent } from 'nostr-tools/pure'

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
const VIDEO_EXTENSIONS = '(?:mp4|webm|ogv|mov|m4v|mkv)'
const URL_PATTERN = /https?:\/\/[^\s<>'"`]+/gi
const HEX64_PATTERN = /^[0-9a-f]{64}$/i
const pool = new SimplePool()

function uniqueStrings(values) {
  return [...new Set((values || []).filter(Boolean))]
}

export function normalizeRelays(relays = DEFAULT_RELAYS) {
  const normalized = uniqueStrings(relays)
    .map((relay) =>
      String(relay || '')
        .trim()
        .replace(/\/+$/, ''),
    )
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
  const configured = loadRelays()
  const hinted = options.relays ? normalizeRelays(options.relays) : []
  return normalizeRelays([...configured, ...hinted, ...DEFAULT_RELAYS])
}

function isValidPubkey(pubkey) {
  return typeof pubkey === 'string' && HEX64_PATTERN.test(pubkey)
}

function isValidNostrEvent(event) {
  try {
    return Boolean(event?.id && validateEvent(event) && verifyEvent(event))
  } catch {
    return false
  }
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000)
}

function eventReferencesId(event, eventId) {
  return (event?.tags || []).some(
    (tag) => Array.isArray(tag) && tag[0] === 'e' && tag[1] === eventId,
  )
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

function isVideoUrl(url) {
  try {
    const parsed = new URL(cleanUrl(url))
    return new RegExp(`\\.${VIDEO_EXTENSIONS}$`, 'i').test(parsed.pathname)
  } catch {
    return false
  }
}

function isVisualUrl(url) {
  return isImageUrl(url) || isVideoUrl(url)
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
  return extractVisualUrls(event).images
}

export function extractVisualUrls(event) {
  const images = []
  const videos = []
  const content = typeof event?.content === 'string' ? event.content : ''

  for (const match of content.matchAll(URL_PATTERN)) {
    const url = cleanUrl(match[0])
    if (isImageUrl(url)) images.push(url)
    else if (isVideoUrl(url)) videos.push(url)
  }

  for (const tag of event?.tags || []) {
    const value = readTagValue(tag)
    if (!value) continue

    for (const match of value.matchAll(URL_PATTERN)) {
      const url = cleanUrl(match[0])
      if (isImageUrl(url)) images.push(url)
      else if (isVideoUrl(url)) videos.push(url)
    }

    if (/^https?:\/\//i.test(value)) {
      if (isImageUrl(value)) images.push(cleanUrl(value))
      else if (isVideoUrl(value)) videos.push(cleanUrl(value))
    }
  }

  return { images: uniqueStrings(images), videos: uniqueStrings(videos) }
}

export function requestEvents({
  relays = DEFAULT_RELAYS,
  filters = [],
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const relayUrls = normalizeRelays(relays)
  const safeFilters = Array.isArray(filters) ? filters.filter(Boolean) : []

  if (!relayUrls.length || !safeFilters.length) {
    return Promise.resolve([])
  }

  return Promise.all(
    safeFilters.map((filter) => pool.querySync(relayUrls, filter, { maxWait: timeoutMs })),
  ).then((results) => {
    const eventsById = new Map()
    for (const event of results.flat()) {
      if (isValidNostrEvent(event)) eventsById.set(event.id, event)
    }
    return [...eventsById.values()].sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
  })
}

export function subscribeVisualFeed(authors, options = {}) {
  const authorList = uniqueStrings(authors).filter(isValidPubkey)
  const relayUrls = relaysForOptions(options)
  const onEvent = typeof options.onEvent === 'function' ? options.onEvent : () => {}

  if (!authorList.length || !relayUrls.length) return { close() {} }

  const subscriptions = []
  const chunkSize = options.authorChunkSize || 20
  for (let index = 0; index < authorList.length; index += chunkSize) {
    const chunk = authorList.slice(index, index + chunkSize)
    subscriptions.push(
      pool.subscribe(
        relayUrls,
        {
          kinds: [1],
          authors: chunk,
          since: options.since || nowSeconds(),
        },
        {
          onevent(event) {
            if (!isValidNostrEvent(event)) return
            const { images, videos } = extractVisualUrls(event)
            if (images.length || videos.length) {
              onEvent({ ...event, imageUrls: images, videoUrls: videos })
            }
          },
        },
      ),
    )
  }

  return {
    close() {
      for (const subscription of subscriptions) subscription.close?.()
    },
  }
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
    (event?.tags || []).filter((tag) => tag[0] === 'p' && tag[2]).map((tag) => tag[2]),
  )
}

export function buildVisualFeedFilters(authors, options = {}) {
  const authorList = uniqueStrings(authors).filter(isValidPubkey)
  const chunkSize = options.authorChunkSize || 20
  const authorChunks = []
  for (let index = 0; index < authorList.length; index += chunkSize) {
    authorChunks.push(authorList.slice(index, index + chunkSize))
  }
  if (!authorChunks.length) authorChunks.push([])

  const requestedVisualLimit = options.limit || MAX_VISUAL_EVENTS
  const perChunkLimit = Math.max(options.filterLimit || requestedVisualLimit * 4, 20)
  return authorChunks.map((chunk) => {
    const filter = {
      kinds: [1],
      limit: perChunkLimit,
      since: options.since,
      until: options.until || nowSeconds(),
    }
    if (chunk.length) filter.authors = chunk
    return filter
  })
}

export async function fetchVisualFeed(authors, options = {}) {
  const authorList = uniqueStrings(authors).filter(isValidPubkey)
  const fallback = { ok: false, authors: authorList, events: [], error: null }

  try {
    const relayEvents = await Promise.all(
      buildVisualFeedFilters(authorList, options).map((filter) =>
        requestEvents({
          relays: relaysForOptions(options),
          timeoutMs: options.timeoutMs || DEFAULT_TIMEOUT_MS,
          filters: [filter],
        }),
      ),
    )
    const eventsById = new Map()
    for (const event of relayEvents.flat()) {
      eventsById.set(event.id, event)
    }

    return {
      ...fallback,
      ok: true,
      events: [...eventsById.values()]
        .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
        .map((event) => {
          const { images, videos } = extractVisualUrls(event)
          return { ...event, imageUrls: images, videoUrls: videos }
        })
        .filter((event) => event.imageUrls.length || event.videoUrls.length)
        .slice(0, options.limit || MAX_VISUAL_EVENTS),
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
    tags: [
      ['e', rootEvent.id],
      ['p', rootEvent.pubkey],
    ],
  }
}

export function buildReplyEvent(rootEvent, content) {
  return {
    kind: 1,
    content: String(content || '').trim(),
    tags: [
      ['e', rootEvent.id, '', 'root'],
      ['p', rootEvent.pubkey],
    ],
  }
}

export async function publishEvent(event, options = {}) {
  const relayUrls = relaysForOptions(options)
  const fallback = { ok: false, event, results: [], error: null }

  if (!event?.id || !relayUrls.length) {
    return { ...fallback, error: 'Cannot publish event in this environment' }
  }

  const results = await Promise.allSettled(pool.publish(relayUrls, event)).then((settled) =>
    settled.map((result, index) => ({
      relay: relayUrls[index],
      ok: result.status === 'fulfilled',
      message: result.status === 'fulfilled' ? '' : String(result.reason || 'Publish failed'),
    })),
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

export function buildZapFilter(eventIds, options = {}) {
  return {
    kinds: [9735],
    '#e': uniqueStrings(eventIds).filter((eventId) => HEX64_PATTERN.test(eventId)),
    limit: options.limit || 200,
  }
}

function parseZapRequestAmount(descriptionTag) {
  if (!descriptionTag) return 0
  try {
    const parsed = JSON.parse(descriptionTag)
    const amountTag = parsed.tags?.find((tag) => Array.isArray(tag) && tag[0] === 'amount')
    const amount = Number(amountTag?.[1])
    return Number.isFinite(amount) && amount > 0 ? amount : 0
  } catch {
    return 0
  }
}

function parseBolt11Amount(invoice) {
  const match = String(invoice).match(/^lnbc(\d+)([munp]?)/i)
  if (!match) return 0
  const amount = Number(match[1])
  const multiplier = match[2] || ''
  const satsPerBtc = 100_000_000
  const multipliers = {
    m: satsPerBtc / 1_000,
    u: satsPerBtc / 1_000_000,
    n: satsPerBtc / 1_000_000_000,
    p: satsPerBtc / 1_000_000_000_000,
  }
  const sats = multiplier ? amount * (multipliers[multiplier] || 0) : amount * satsPerBtc
  return Math.floor(sats)
}

export function extractZapSummary(events, eventId) {
  const zaps = (events || []).filter(
    (event) => event?.kind === 9735 && eventReferencesId(event, eventId),
  )

  let sats = 0
  let msats = 0
  for (const event of zaps) {
    const description = event.tags?.find((tag) => Array.isArray(tag) && tag[0] === 'description')?.[1]
    const descriptionMsats = parseZapRequestAmount(description)
    if (descriptionMsats) {
      msats += descriptionMsats
      sats += Math.floor(descriptionMsats / 1000)
      continue
    }

    const bolt11 = event.tags?.find((tag) => Array.isArray(tag) && tag[0] === 'bolt11')?.[1]
    const eventSats = parseBolt11Amount(bolt11)
    sats += eventSats
    msats += eventSats * 1000
  }

  return { zapCount: zaps.length, sats, msats }
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
    const [reactionEvents, replyEvents, zapEvents] = await Promise.all([
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
      requestEvents({
        relays: relaysForOptions(options),
        timeoutMs: options.timeoutMs || DEFAULT_TIMEOUT_MS,
        filters: [buildZapFilter(ids, { limit: options.zapLimit || 300 })],
      }),
    ])

    const interactions = Object.fromEntries(
      ids.map((eventId) => {
        const reactionSummary = extractReactionSummary(
          reactionEvents,
          eventId,
          options.viewerPubkey,
        )
        const zapSummary = extractZapSummary(zapEvents, eventId)
        return [
          eventId,
          {
            ...reactionSummary,
            zapCount: zapSummary.zapCount,
            sats: zapSummary.sats,
            msats: zapSummary.msats,
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
