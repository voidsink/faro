import { SimplePool } from 'nostr-tools/pool'
import { validateEvent, verifyEvent } from 'nostr-tools/pure'

export const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://relay.nostr.com',
]
export const RELAYS_STORAGE_KEY = 'faro-relays'
export const FOLLOWED_HASHTAGS_STORAGE_KEY = 'faro-followed-hashtags'

const DEFAULT_TIMEOUT_MS = 8000
const MAX_VISUAL_EVENTS = 80
// Feed reads stay wide: 1 = short text, 20 = NIP-68 picture, 21/22 = NIP-71 video.
const VISUAL_KINDS = [1, 20, 21, 22]
const IMAGE_EXTENSIONS = '(?:jpe?g|png|webp|gif|avif|apng)'
const VIDEO_EXTENSIONS = '(?:mp4|webm|ogv|mov|m4v|mkv)'
const URL_PATTERN = /https?:\/\/[^\s<>'"`]+/gi
const HEX64_PATTERN = /^[0-9a-f]{64}$/i
const pool = new SimplePool()

function uniqueStrings(values) {
  return [...new Set((values || []).filter(Boolean))]
}

function validRelayUrls(relays) {
  return uniqueStrings(relays)
    .map((relay) =>
      String(relay || '')
        .trim()
        .replace(/\/+$/, ''),
    )
    .filter((relay) => /^wss?:\/\//i.test(relay))
}

export function normalizeRelays(relays = DEFAULT_RELAYS) {
  const normalized = validRelayUrls(relays)
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

export function normalizeHashtags(tags = []) {
  return uniqueStrings(
    (Array.isArray(tags) ? tags : String(tags || '').split(/[\n, ]+/))
      .map((tag) =>
        String(tag || '')
          .trim()
          .replace(/^#+/, '')
          .toLowerCase(),
      )
      .filter((tag) => /^[\p{L}\p{N}_-]+$/u.test(tag)),
  )
}

export function parseHashtagList(value) {
  return normalizeHashtags(value)
}

function followedHashtagsStorageKey(pubkey = '') {
  const cleanPubkey = String(pubkey || '').trim()
  return cleanPubkey
    ? `${FOLLOWED_HASHTAGS_STORAGE_KEY}-${cleanPubkey}`
    : FOLLOWED_HASHTAGS_STORAGE_KEY
}

export function loadFollowedHashtags(pubkey = '') {
  try {
    const stored = localStorage.getItem(followedHashtagsStorageKey(pubkey))
    return stored ? parseHashtagList(JSON.parse(stored)) : []
  } catch {
    return []
  }
}

export function saveFollowedHashtags(tags, pubkey = '') {
  const normalized = parseHashtagList(tags)
  try {
    localStorage.setItem(followedHashtagsStorageKey(pubkey), JSON.stringify(normalized))
  } catch {
    // Ignore storage failures; caller can still use returned tags in memory.
  }
  return normalized
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
  const temporaryRelays = validRelayUrls(options.temporaryRelays)
  if (temporaryRelays.length) return temporaryRelays

  if (options.anonymous) return [...DEFAULT_RELAYS]
  return loadRelays()
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

    const mime =
      tag[0] === 'imeta'
        ? tag.find((part) => typeof part === 'string' && part.startsWith('m '))?.slice(2)
        : event.tags.find((part) => part[0] === 'm')?.[1]
    if (/^https?:\/\//i.test(value)) {
      if (/^image\//i.test(mime || '')) images.push(value)
      else if (/^video\//i.test(mime || '')) videos.push(value)
      else if (event.kind === 20 && tag[0] === 'imeta') images.push(value)
    }

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
  temporaryRelays = [],
} = {}) {
  const relayUrls = normalizeRelays(relays)
  const safeFilters = Array.isArray(filters) ? filters.filter(Boolean) : []
  const useTemporaryPool = validRelayUrls(temporaryRelays).length > 0
  const requestPool = useTemporaryPool ? new SimplePool() : pool

  if (!relayUrls.length || !safeFilters.length) {
    return Promise.resolve([])
  }

  return Promise.all(
    safeFilters.map(async (filter) => {
      const results = await Promise.allSettled(
        relayUrls.map(async (url) => {
          const relay = await requestPool.ensureRelay(url, { connectionTimeout: timeoutMs })
          return new Promise((resolve, reject) => {
            const events = []
            let settled = false
            let subscription
            // Use our own deadline: the library also calls oneose on its timeout.
            const timer = setTimeout(() => finish(new Error('Relay request timed out.')), timeoutMs)
            try {
              subscription = relay.subscribe([filter], {
                eoseTimeout: timeoutMs + 1000,
                onevent: (event) => events.push(event),
                oneose: () => finish(),
                onclose: (reason) => finish(new Error(reason || 'Relay closed the request.')),
              })
            } catch (error) {
              finish(error)
            }
            function finish(error) {
              if (settled) return
              settled = true
              clearTimeout(timer)
              subscription?.close()
              if (error) reject(error)
              else resolve(events)
            }
          })
        }),
      )
      if (!results.some((result) => result.status === 'fulfilled')) {
        throw new Error(
          'Could not reach your Nostr relays. Check your connection or relay settings.',
        )
      }
      return results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
    }),
  )
    .then((results) => {
      const eventsById = new Map()
      for (const event of results.flat()) {
        if (isValidNostrEvent(event)) eventsById.set(event.id, event)
      }
      return [...eventsById.values()].sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
    })
    .finally(() => {
      if (useTemporaryPool) requestPool.close(relayUrls)
    })
}

export function subscribeVisualFeed(authors, options = {}) {
  const authorList = uniqueStrings(authors).filter(isValidPubkey)
  const tagList = normalizeHashtags(options.tags)
  const relayUrls = relaysForOptions(options)
  const onEvent = typeof options.onEvent === 'function' ? options.onEvent : () => {}

  if ((!authorList.length && !tagList.length) || !relayUrls.length) return { close() {} }

  const subscriptions = []
  const chunkSize = options.authorChunkSize || 20
  const filters = []
  for (let index = 0; index < authorList.length; index += chunkSize) {
    const chunk = authorList.slice(index, index + chunkSize)
    filters.push({ authors: chunk })
  }
  filters.push(...tagList.map((tag) => ({ '#t': [tag] })))

  for (const filter of filters) {
    subscriptions.push(
      pool.subscribe(
        relayUrls,
        {
          kinds: VISUAL_KINDS,
          ...filter,
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
    if (!event) return { ...fallback, ok: true }

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

export async function fetchProfiles(pubkeys, options = {}) {
  const authors = uniqueStrings(pubkeys).filter(isValidPubkey)
  if (!authors.length) return {}

  try {
    const events = await requestEvents({
      relays: relaysForOptions(options),
      timeoutMs: options.timeoutMs || DEFAULT_TIMEOUT_MS,
      filters: [{ kinds: [0], authors, limit: authors.length }],
    })
    const profiles = {}
    for (const event of events) {
      if (!(event.pubkey in profiles)) profiles[event.pubkey] = JSON.parse(event.content || '{}')
    }
    return profiles
  } catch {
    return {}
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
    if (!event) return { ...fallback, ok: true }

    return {
      ...fallback,
      ok: true,
      pubkeys: uniqueStrings(
        (event.tags || [])
          .filter((tag) => tag[0] === 'p' && isValidPubkey(tag[1]))
          .map((tag) => tag[1]),
      ),
      event,
    }
  } catch (error) {
    return { ...fallback, error: error?.message || 'Following fetch failed' }
  }
}

export function buildFollowEvent(previousEvent, pubkey, follow) {
  if (!isValidPubkey(pubkey)) throw new Error('Invalid public key.')
  const tags = (previousEvent?.tags || []).filter(
    (tag) => follow || tag[0] !== 'p' || tag[1] !== pubkey,
  )
  if (follow && !tags.some((tag) => tag[0] === 'p' && tag[1] === pubkey)) tags.push(['p', pubkey])
  return {
    kind: 3,
    created_at: Math.max(nowSeconds(), (previousEvent?.created_at || 0) + 1),
    content: previousEvent?.content || '',
    tags,
  }
}

export async function fetchVisualPost(eventId, options = {}) {
  if (!HEX64_PATTERN.test(eventId || '')) return { ok: false, error: 'Invalid post ID.' }
  try {
    const events = await requestEvents({
      relays: relaysForOptions(options),
      temporaryRelays: options.temporaryRelays,
      filters: [{ kinds: VISUAL_KINDS, ids: [eventId], limit: 1 }],
      timeoutMs: options.timeoutMs || DEFAULT_TIMEOUT_MS,
    })
    const event = events[0]
    if (!event) return { ok: false, error: 'Post not found on these relays.' }
    const { images, videos } = extractVisualUrls(event)
    if (!images.length && !videos.length)
      return { ok: false, error: 'This post has no supported media.' }
    return { ok: true, event: { ...event, imageUrls: images, videoUrls: videos } }
  } catch (error) {
    return { ok: false, error: error.message }
  }
}

export function buildVisualFeedFilters(authors, options = {}) {
  const authorList = uniqueStrings(authors).filter(isValidPubkey)
  const tagList = normalizeHashtags(options.tags)
  const chunkSize = options.authorChunkSize || 20
  const authorChunks = []
  for (let index = 0; index < authorList.length; index += chunkSize) {
    authorChunks.push(authorList.slice(index, index + chunkSize))
  }
  if (!authorChunks.length && !tagList.length) authorChunks.push([])

  const requestedVisualLimit = options.limit || MAX_VISUAL_EVENTS
  const perChunkLimit = Math.max(options.filterLimit || requestedVisualLimit * 4, 20)
  const baseFilter = () => ({
    kinds: VISUAL_KINDS,
    limit: perChunkLimit,
    since: options.since,
    until: options.until || nowSeconds(),
  })
  const filters = authorChunks.map((chunk) => {
    const filter = {
      ...baseFilter(),
    }
    if (chunk.length) filter.authors = chunk
    return filter
  })
  filters.push(
    ...tagList.map((tag) => ({
      ...baseFilter(),
      '#t': [tag],
    })),
  )
  return filters
}

export async function fetchVisualFeed(authors, options = {}) {
  const authorList = uniqueStrings(authors).filter(isValidPubkey)
  const tags = normalizeHashtags(options.tags)
  const fallback = { ok: false, authors: authorList, tags, events: [], error: null }

  try {
    const relayEvents = await Promise.all(
      buildVisualFeedFilters(authorList, options).map((filter) =>
        requestEvents({
          relays: relaysForOptions(options),
          temporaryRelays: options.temporaryRelays,
          timeoutMs: options.timeoutMs || DEFAULT_TIMEOUT_MS,
          filters: [filter],
        }),
      ),
    )
    const eventsById = new Map()
    for (const event of relayEvents.flat()) {
      eventsById.set(event.id, event)
    }

    const sortedEvents = [...eventsById.values()].sort(
      (a, b) => (b.created_at || 0) - (a.created_at || 0),
    )
    const visualEvents = sortedEvents
      .map((event) => {
        const { images, videos } = extractVisualUrls(event)
        return { ...event, imageUrls: images, videoUrls: videos }
      })
      .filter((event) => event.imageUrls.length || event.videoUrls.length)
      .slice(0, options.limit || MAX_VISUAL_EVENTS)
    const cursorEvents =
      visualEvents.length >= (options.limit || MAX_VISUAL_EVENTS) ? visualEvents : sortedEvents
    return {
      ...fallback,
      ok: true,
      events: visualEvents,
      cursor: cursorEvents.length
        ? Math.min(...cursorEvents.map((event) => event.created_at)) - 1
        : null,
      hasMore: sortedEvents.length > 0,
    }
  } catch (error) {
    return { ...fallback, error: error?.message || 'Visual feed fetch failed' }
  }
}

// NIP-68 kind 20: picture-first post. The image lives in an `imeta` tag (NIP-92);
// `.content` carries only the description, never the URL.
export function buildPictureEvent({ caption = '', mediaUrl, media = {} } = {}) {
  if (!/^https?:\/\//i.test(mediaUrl || '')) throw new Error('A public image URL is required.')
  if (media.mimeType && !/^image\/(apng|avif|gif|jpeg|png|webp)$/.test(media.mimeType)) {
    throw new Error('NIP-68 requires a supported image type.')
  }
  const content = String(caption || '').trim()
  const imeta = ['imeta']
  if (mediaUrl) imeta.push(`url ${String(mediaUrl).trim()}`)
  if (media.mimeType) imeta.push(`m ${media.mimeType}`)
  if (media.dimensions) imeta.push(`dim ${media.dimensions}`)
  if (media.sha256) imeta.push(`x ${media.sha256}`)
  const tags = imeta.length > 1 ? [imeta] : []
  tags.push(['title', content.split('\n')[0].slice(0, 80) || 'Photo'])
  if (media.mimeType) tags.push(['m', media.mimeType])
  if (media.sha256) tags.push(['x', media.sha256])
  for (const hashtag of hashtagsFromText(content)) {
    tags.push(['t', hashtag])
  }

  return {
    kind: 20,
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

  const results = await Promise.allSettled(
    pool.publish(relayUrls, event, { maxWait: options.timeoutMs || DEFAULT_TIMEOUT_MS }),
  ).then((settled) =>
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
  return signAndPublish(buildPictureEvent({ caption, mediaUrl, media }), options)
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
    const description = event.tags?.find(
      (tag) => Array.isArray(tag) && tag[0] === 'description',
    )?.[1]
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
