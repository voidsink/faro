import { acceptHMRUpdate, defineStore } from 'pinia'
import {
  clearLocalPosts,
  loadLocalPosts,
  saveLocalPostsWithPruning,
} from 'src/services/localMedia'
import {
  fetchFollowing,
  fetchInteractions,
  fetchProfile,
  fetchVisualFeed,
  publishReaction,
  publishReply,
} from 'src/services/nostrRelay'

const identityKey = 'faro-identity'
const legacyIdentityKey = 'nostr-visual-demo-identity'
const relayCacheKey = 'faro-relay-cache'
const genericNames = new Set(['Nostr user', 'NIP-07 user', 'Faro user'])
const FEED_PAGE_SIZE = 24
const INITIAL_FEED_LIMIT = 120
const RELAY_CACHE_LIMIT = 300
const INITIAL_LOOKBACK_DAYS = 30

function readJson(key, fallback) {
  try {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : fallback
  } catch {
    return fallback
  }
}

function shortKey(pubkey = '') {
  return pubkey.length > 14 ? `${pubkey.slice(0, 8)}…${pubkey.slice(-6)}` : pubkey
}

function normalizeProfile(profile = {}) {
  return {
    name: profile.name || '',
    display_name: profile.display_name || '',
    picture: profile.picture || '',
    banner: profile.banner || '',
    about: profile.about || '',
    nip05: profile.nip05 || '',
  }
}

function newestFirst(a, b) {
  return new Date(b.createdAt) - new Date(a.createdAt)
}

function daysAgoSeconds(days) {
  return Math.floor(Date.now() / 1000) - days * 24 * 60 * 60
}

export const useSessionStore = defineStore('session', {
  state: () => ({
    initialized: false,
    hasNip07: false,
    identity: null,
    relayProfile: {},
    authorProfiles: {},
    following: [],
    followers: [],
    localPosts: [],
    relayPosts: [],
    interactionsByEventId: {},
    relayCursor: null,
    hasMoreRelayPosts: false,
    loadingMoreRelayPosts: false,
    publishingInteractions: {},
    message: '',
    refreshing: false,
  }),

  getters: {
    activeProfile(state) {
      return {
        ...(state.identity || {}),
        ...normalizeProfile(state.relayProfile),
      }
    },

    displayName() {
      const profileName = this.activeProfile.display_name || this.activeProfile.name
      if (profileName && !genericNames.has(profileName)) return profileName

      const identityName = this.identity?.name || ''
      if (identityName && !genericNames.has(identityName)) return identityName

      return shortKey(this.identity?.pubkey || '') || 'Faro user'
    },

    profileSubtitle() {
      return this.activeProfile.nip05 || shortKey(this.identity?.pubkey || '')
    },

    authLabel(state) {
      if (!state.identity) return 'logged out'
      if (state.identity.source === 'nip07') return 'NIP-07'
      return 'local dev'
    },

    combinedFeed(state) {
      return [...state.localPosts, ...state.relayPosts].sort(newestFirst)
    },

    userPosts(state) {
      const pubkey = state.identity?.pubkey
      if (!pubkey) return [...state.localPosts]
      return [...state.localPosts, ...state.relayPosts].filter((post) => post.author?.pubkey === pubkey)
    },

    namedPeople(state) {
      const people = new Map()
      for (const post of state.relayPosts) {
        if (!post.author?.pubkey || people.has(post.author.pubkey)) continue
        people.set(post.author.pubkey, post.author)
      }
      return [...people.values()].filter((person) => person.name && !person.name.includes('…'))
    },

    suggestedProfiles(state) {
      const excluded = new Set([state.identity?.pubkey, ...state.following].filter(Boolean))
      return this.namedPeople.filter((person) => !excluded.has(person.pubkey)).slice(0, 5)
    },

    storyProfiles() {
      return this.namedPeople.slice(0, 6)
    },
  },

  actions: {
    init() {
      if (this.initialized) return

      this.hasNip07 = typeof window !== 'undefined' && Boolean(window.nostr?.getPublicKey)
      this.identity = this.loadIdentity()
      this.localPosts = loadLocalPosts()
      this.loadRelayCache()
      this.initialized = true

      if (this.identity?.pubkey) {
        this.refreshFromNostr({ silent: true })
      }
    },

    loadIdentity() {
      const current = readJson(identityKey, null)
      if (current?.pubkey) return current

      const legacy = readJson(legacyIdentityKey, null)
      if (legacy?.pubkey) {
        localStorage.setItem(identityKey, JSON.stringify(legacy))
        localStorage.removeItem(legacyIdentityKey)
        return legacy
      }

      return null
    },

    saveIdentity(nextIdentity) {
      localStorage.setItem(identityKey, JSON.stringify(nextIdentity))
      this.identity = nextIdentity
      this.relayProfile = {}
      this.following = []
      this.followers = []
      this.relayPosts = []
      this.interactionsByEventId = {}
      this.relayCursor = null
      this.hasMoreRelayPosts = false
      this.loadingMoreRelayPosts = false
      this.authorProfiles = {}
      localStorage.removeItem(relayCacheKey)
      this.message = `Logged in as ${shortKey(nextIdentity.pubkey)}.`
    },

    async loginWithNip07() {
      if (!window.nostr?.getPublicKey) {
        this.message = 'No NIP-07 signer detected in this browser.'
        return
      }
      try {
        const pubkey = await window.nostr.getPublicKey()
        this.saveIdentity({ pubkey, source: 'nip07' })
        await this.refreshFromNostr()
      } catch {
        this.message = 'NIP-07 login was cancelled or failed.'
      }
    },

    generateIdentity() {
      const bytes = new Uint8Array(32)
      crypto.getRandomValues(bytes)
      const pubkey = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
      this.saveIdentity({ name: `Local ${pubkey.slice(0, 4)}`, pubkey, source: 'local-dev' })
    },

    logout() {
      localStorage.removeItem(identityKey)
      localStorage.removeItem(legacyIdentityKey)
      localStorage.removeItem(relayCacheKey)
      this.identity = null
      this.relayProfile = {}
      this.authorProfiles = {}
      this.following = []
      this.followers = []
      this.relayPosts = []
      this.interactionsByEventId = {}
      this.relayCursor = null
      this.hasMoreRelayPosts = false
      this.loadingMoreRelayPosts = false
      this.message = 'Logged out. Local posts were kept.'
    },

    loadRelayCache() {
      const cache = readJson(relayCacheKey, null)
      if (!cache) return
      if (cache.pubkey && cache.pubkey !== this.identity?.pubkey) {
        localStorage.removeItem(relayCacheKey)
        return
      }
      this.relayProfile = normalizeProfile(cache.relayProfile || {})
      this.following = Array.isArray(cache.following) ? cache.following : []
      this.followers = Array.isArray(cache.followers) ? cache.followers : []
      this.relayPosts = Array.isArray(cache.relayPosts) ? cache.relayPosts : []
      this.interactionsByEventId = cache.interactionsByEventId || {}
      this.relayCursor = cache.relayCursor || this.cursorFromPosts(this.relayPosts)
      this.hasMoreRelayPosts = Boolean(cache.hasMoreRelayPosts)
      this.authorProfiles = cache.authorProfiles || {}
    },

    saveRelayCache() {
      localStorage.setItem(
        relayCacheKey,
        JSON.stringify({
          relayProfile: normalizeProfile(this.relayProfile),
          pubkey: this.identity?.pubkey || '',
          following: this.following,
          followers: this.followers,
          relayPosts: this.relayPosts.slice(0, RELAY_CACHE_LIMIT),
          interactionsByEventId: this.interactionsByEventId,
          relayCursor: this.relayCursor,
          hasMoreRelayPosts: this.hasMoreRelayPosts,
          authorProfiles: this.authorProfiles,
          cachedAt: new Date().toISOString(),
        }),
      )
    },

    addLocalPost(post) {
      this.localPosts = saveLocalPostsWithPruning([post, ...this.localPosts])
      return this.localPosts
    },

    addPublishedRelayPost({ event, mediaUrl, media, caption }) {
      if (!event?.id || !mediaUrl) return null
      const post = {
        id: `${event.id}-0`,
        author: this.authorForPubkey(event.pubkey || this.identity?.pubkey || ''),
        caption: String(caption || '').trim(),
        image: mediaUrl,
        media: media || null,
        ratio: '1:1',
        createdAt: new Date((event.created_at || Date.now() / 1000) * 1000).toISOString(),
        source: 'relay kind 1',
        nostr: {
          id: event.id,
          pubkey: event.pubkey || this.identity?.pubkey || '',
          kind: event.kind,
          tags: event.tags || [],
          created_at: event.created_at,
        },
      }
      this.relayPosts = [post, ...this.relayPosts.filter((item) => item.id !== post.id)].sort(newestFirst)
      this.saveRelayCache()
      return post
    },

    clearPostCache() {
      clearLocalPosts()
      this.localPosts = []
      this.message = 'Local posts cleared. Login state kept.'
    },

    async refreshFromNostr({ silent = false } = {}) {
      if (!this.identity?.pubkey) {
        if (!silent) this.message = 'Login before fetching Nostr data.'
        return
      }

      this.refreshing = true
      if (!silent) this.message = ''

      try {
        const [profileResult, followingResult] = await Promise.all([
          fetchProfile(this.identity.pubkey),
          fetchFollowing(this.identity.pubkey),
        ])

        let refreshed = false

        if (profileResult.ok) {
          this.relayProfile = normalizeProfile(profileResult.profile)
          refreshed = true
        }

        if (followingResult.ok) {
          this.following = followingResult.pubkeys
          refreshed = true
        }

        const authors = [this.identity.pubkey, ...this.following].slice(0, 100)
        const latest = this.latestRelayPostTimestamp()
        const visualResult = await fetchVisualFeed(authors, {
          limit: silent && !this.relayPosts.length ? INITIAL_FEED_LIMIT : FEED_PAGE_SIZE,
          relays: followingResult.relayHints,
          since: !silent && latest ? latest + 1 : daysAgoSeconds(INITIAL_LOOKBACK_DAYS),
        })

        if (visualResult.ok) {
          const events = visualResult.events
          const pubkeys = [...new Set(events.map((event) => event.pubkey).filter(Boolean))]
          await this.hydrateAuthorProfiles(pubkeys)

          const nextPosts = this.postsFromVisualEvents(events)
          this.relayPosts = silent
            ? nextPosts
            : this.mergeRelayPosts(nextPosts)
          await this.refreshInteractionsForPosts(this.relayPosts)
          this.relayCursor = this.cursorFromEvents(events)
            || this.cursorFromPosts(this.relayPosts)
          this.hasMoreRelayPosts = true
          refreshed = true
        }

        if (refreshed) {
          this.saveRelayCache()
        }

        if (!silent) {
          this.message =
            refreshed || this.following.length || this.relayPosts.length
              ? `Nostr refresh complete: ${this.following.length} follows, ${this.relayPosts.length} visual posts.`
              : 'Relay data was unavailable. Showing cached data if available.'
        }
      } catch {
        if (!silent) this.message = 'Relay fetch failed or timed out. Local posting is available.'
      } finally {
        this.refreshing = false
      }
    },

    async loadMoreVisualPosts() {
      if (this.loadingMoreRelayPosts || !this.hasMoreRelayPosts || !this.identity?.pubkey) return

      const until = this.relayCursor || this.cursorFromPosts(this.relayPosts)
      if (!until) {
        this.hasMoreRelayPosts = false
        return
      }

      this.loadingMoreRelayPosts = true
      try {
        const authors = [this.identity.pubkey, ...this.following].slice(0, 100)
        const visualResult = await fetchVisualFeed(authors, {
          limit: FEED_PAGE_SIZE,
          until,
          timeoutMs: 6500,
        })

        if (!visualResult.ok) return

        const events = visualResult.events
        const pubkeys = [...new Set(events.map((event) => event.pubkey).filter(Boolean))]
        await this.hydrateAuthorProfiles(pubkeys)

        const existing = new Set(this.relayPosts.map((post) => post.id))
        const nextPosts = this.postsFromVisualEvents(events).filter((post) => !existing.has(post.id))
        this.relayPosts = this.mergeRelayPosts(nextPosts)
        await this.refreshInteractionsForPosts(nextPosts)
        this.relayCursor = this.cursorFromEvents(events) || this.cursorFromPosts(this.relayPosts)
        this.hasMoreRelayPosts = events.length > 0 && nextPosts.length > 0
        this.saveRelayCache()
      } finally {
        this.loadingMoreRelayPosts = false
      }
    },

    mergeRelayPosts(posts) {
      const postsById = new Map()
      for (const post of [...this.relayPosts, ...(posts || [])]) {
        postsById.set(post.id, post)
      }
      return [...postsById.values()].sort(newestFirst).slice(0, RELAY_CACHE_LIMIT)
    },

    latestRelayPostTimestamp() {
      return this.relayPosts.reduce((value, post) => {
        const createdAt = Math.floor(Date.parse(post.createdAt) / 1000)
        if (!Number.isFinite(createdAt)) return value
        return Math.max(value, createdAt)
      }, 0)
    },

    async hydrateAuthorProfiles(pubkeys) {
      const missing = pubkeys.filter((pubkey) => pubkey && !this.authorProfiles[pubkey]).slice(0, 20)
      if (!missing.length) return

      const entries = await Promise.all(
        missing.map(async (pubkey) => {
          const result = await fetchProfile(pubkey, { timeoutMs: 4500 })
          const profile = result.ok ? normalizeProfile(result.profile) : {}
          return [pubkey, profile]
        }),
      )

      this.authorProfiles = {
        ...this.authorProfiles,
        ...Object.fromEntries(entries),
      }
    },

    authorForPubkey(pubkey) {
      const profile = normalizeProfile(this.authorProfiles[pubkey] || {})
      const name = profile.display_name || profile.name || shortKey(pubkey)
      return { name, pubkey, picture: profile.picture || '' }
    },

    postsFromVisualEvents(events) {
      return events.flatMap((event) =>
        event.imageUrls.map((image, imageIndex) => ({
          id: `${event.id}-${imageIndex}`,
          author: this.authorForPubkey(event.pubkey),
          caption: event.content.replace(image, '').trim(),
          image,
          ratio: '1:1',
          createdAt: new Date((event.created_at || Date.now() / 1000) * 1000).toISOString(),
          source: 'relay kind 1',
          nostr: {
            id: event.id,
            pubkey: event.pubkey,
            kind: event.kind,
            tags: event.tags || [],
            created_at: event.created_at,
          },
        })),
      )
    },

    async refreshInteractionsForPosts(posts) {
      const eventIds = [...new Set((posts || []).map((post) => post.nostr?.id).filter(Boolean))]
      if (!eventIds.length) return

      const result = await fetchInteractions(eventIds, {
        viewerPubkey: this.identity?.pubkey || '',
        timeoutMs: 6500,
      })

      if (!result.ok) return

      const replyPubkeys = Object.values(result.interactions)
        .flatMap((interaction) => interaction.replies || [])
        .map((reply) => reply.pubkey)
        .filter(Boolean)

      await this.hydrateAuthorProfiles([...new Set(replyPubkeys)])

      this.interactionsByEventId = {
        ...this.interactionsByEventId,
        ...result.interactions,
      }
    },

    interactionForPost(post) {
      const eventId = post?.nostr?.id
      if (!eventId) return null
      return {
        ...(this.interactionsByEventId[eventId] || { count: 0, likedByMe: false, replies: [] }),
        publishing: Boolean(this.publishingInteractions[eventId]),
      }
    },

    rootEventForPost(post) {
      return post?.nostr?.id && post?.nostr?.pubkey
        ? { id: post.nostr.id, pubkey: post.nostr.pubkey }
        : null
    },

    async likePost(post) {
      const rootEvent = this.rootEventForPost(post)
      if (!rootEvent) {
        this.message = 'Only relay posts can be liked on Nostr.'
        return
      }
      if (!this.identity?.pubkey || this.identity.source !== 'nip07') {
        this.message = 'Login with NIP-07 before publishing Nostr likes.'
        return
      }
      if (this.interactionsByEventId[rootEvent.id]?.likedByMe) return

      const current = this.interactionsByEventId[rootEvent.id] || { count: 0, likedByMe: false, replies: [] }
      this.interactionsByEventId = {
        ...this.interactionsByEventId,
        [rootEvent.id]: { ...current, count: current.count + 1, likedByMe: true },
      }
      this.publishingInteractions = { ...this.publishingInteractions, [rootEvent.id]: true }

      const result = await publishReaction(rootEvent, { timeoutMs: 7000 })
      this.publishingInteractions = { ...this.publishingInteractions, [rootEvent.id]: false }

      if (result.ok) {
        this.message = 'Like published to Nostr.'
        await this.refreshInteractionsForPosts([post])
        this.saveRelayCache()
        return
      }

      this.interactionsByEventId = { ...this.interactionsByEventId, [rootEvent.id]: current }
      this.message = result.error || 'Like could not be published to any relay.'
    },

    async commentOnPost(post, content) {
      const rootEvent = this.rootEventForPost(post)
      const text = String(content || '').trim()
      if (!rootEvent) {
        this.message = 'Only relay posts can be commented on Nostr.'
        return false
      }
      if (!text) return false
      if (!this.identity?.pubkey || this.identity.source !== 'nip07') {
        this.message = 'Login with NIP-07 before publishing Nostr comments.'
        return false
      }

      this.publishingInteractions = { ...this.publishingInteractions, [rootEvent.id]: true }
      const result = await publishReply(rootEvent, text, { timeoutMs: 7000 })
      this.publishingInteractions = { ...this.publishingInteractions, [rootEvent.id]: false }

      if (!result.ok) {
        this.message = result.error || 'Comment could not be published to any relay.'
        return false
      }

      const current = this.interactionsByEventId[rootEvent.id] || { count: 0, likedByMe: false, replies: [] }
      const reply = {
        id: result.event.id,
        eventId: rootEvent.id,
        pubkey: this.identity.pubkey,
        content: text,
        createdAt: new Date((result.event.created_at || Date.now() / 1000) * 1000).toISOString(),
        tags: result.event.tags || [],
        event: result.event,
      }
      this.interactionsByEventId = {
        ...this.interactionsByEventId,
        [rootEvent.id]: { ...current, replies: [...(current.replies || []), reply] },
      }
      this.message = 'Comment published to Nostr.'
      await this.refreshInteractionsForPosts([post])
      this.saveRelayCache()
      return true
    },

    replyAuthor(reply) {
      return this.authorForPubkey(reply?.pubkey || '')
    },

    cursorFromEvents(events) {
      const oldest = events.reduce((value, event) => {
        const createdAt = Number(event.created_at)
        if (!Number.isFinite(createdAt)) return value
        return value ? Math.min(value, createdAt) : createdAt
      }, 0)
      return oldest ? oldest - 1 : null
    },

    cursorFromPosts(posts) {
      const oldest = posts.reduce((value, post) => {
        const createdAt = Math.floor(Date.parse(post.createdAt) / 1000)
        if (!Number.isFinite(createdAt)) return value
        return value ? Math.min(value, createdAt) : createdAt
      }, 0)
      return oldest ? oldest - 1 : null
    },

    shortKey,
  },
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSessionStore, import.meta.hot))
}
