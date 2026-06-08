export const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
]

const DEFAULT_TIMEOUT_MS = 8000
const MAX_VISUAL_EVENTS = 80
const IMAGE_EXTENSIONS = '(?:jpe?g|png|webp|gif)'
const URL_PATTERN = /https?:\/\/[^\s<>'"`]+/gi
const HEX64_PATTERN = /^[0-9a-f]{64}$/i

function uniqueStrings(values) {
  return [...new Set((values || []).filter(Boolean))]
}

function normalizeRelays(relays = DEFAULT_RELAYS) {
  return uniqueStrings(relays).filter((relay) => /^wss?:\/\//i.test(relay))
}

function isValidPubkey(pubkey) {
  return typeof pubkey === 'string' && HEX64_PATTERN.test(pubkey)
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000)
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
      relays: options.relays || DEFAULT_RELAYS,
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
      relays: options.relays || DEFAULT_RELAYS,
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
      event,
    }
  } catch (error) {
    return { ...fallback, error: error?.message || 'Following fetch failed' }
  }
}

export async function fetchVisualFeed(authors, options = {}) {
  const authorList = uniqueStrings(authors).filter(isValidPubkey)
  const fallback = { ok: false, authors: authorList, events: [], error: null }

  if (!authorList.length) return { ...fallback, error: 'No valid authors' }

  try {
    const events = await requestEvents({
      relays: options.relays || DEFAULT_RELAYS,
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
