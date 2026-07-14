import { acceptHMRUpdate, defineStore } from 'pinia'
import { decode, npubEncode } from 'nostr-tools/nip19'
import { authLabelForSource, safeIdentityForStorage } from 'src/services/auth/identity'
import {
  loginWithNip07 as requestNip07Login,
  getNip07Pubkey,
  hasNip07Signer,
  nip07Signer,
} from 'src/services/auth/nip07'
import { createRemoteSigner, secretKeyFromHex } from 'src/services/auth/nip46'
import { loginWithPomegranate } from 'src/services/auth/pomegranate'
import {
  createKeypair,
  keypairFromSecretKey,
  makeLocalSigner,
  parseSecretKey,
} from 'src/services/auth/secretKey'
import { clearLocalPosts, loadLocalPosts, saveLocalPostsWithPruning } from 'src/services/localMedia'
import {
  fetchFollowing,
  fetchInteractions,
  fetchProfile,
  fetchProfiles,
  fetchVisualFeed,
  loadFollowedHashtags,
  publishReaction,
  publishReply,
  saveFollowedHashtags,
  subscribeVisualFeed,
} from 'src/services/nostrRelay'

const identityKey = 'faro-identity'
const legacyIdentityKey = 'nostr-visual-demo-identity'
const relayCacheKey = 'faro-relay-cache'
const genericNames = new Set(['Nostr user', 'NIP-07 user', 'Faro user'])
const FEED_PAGE_SIZE = 50
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
  try {
    const npub = npubEncode(pubkey)
    return `${npub.slice(0, 12)}…${npub.slice(-6)}`
  } catch {
    return pubkey.length > 14 ? `${pubkey.slice(0, 8)}…${pubkey.slice(-6)}` : pubkey
  }
}

function normalizeProfile(profile = {}) {
  return {
    name: profile.name || '',
    display_name: profile.display_name || '',
    picture: profile.picture || '',
    banner: profile.banner || '',
    about: profile.about || '',
    nip05: profile.nip05 || '',
    website: profile.website || '',
    lud16: profile.lud16 || '',
    lud06: profile.lud06 || '',
    location: profile.location || '',
  }
}

function newestFirst(a, b) {
  return new Date(b.createdAt) - new Date(a.createdAt)
}

function postCreatedAtSeconds(post) {
  const nostrCreatedAt = Number(post?.nostr?.created_at)
  if (Number.isFinite(nostrCreatedAt)) return nostrCreatedAt
  const parsed = Math.floor(Date.parse(post?.createdAt || '') / 1000)
  return Number.isFinite(parsed) ? parsed : 0
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
    followedHashtags: [],
    followers: [],
    localPosts: [],
    relayPosts: [],
    interactionsByEventId: {},
    relayCursor: null,
    hasMoreRelayPosts: false,
    loadingMoreRelayPosts: false,
    pendingRelayEvents: [],
    liveFeedSubscription: null,
    publishingInteractions: {},
    secretKey: null,
    remoteSigner: null,
    bunkerLoading: false,
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
      return authLabelForSource(state.identity.source)
    },

    canSignNostrEvents(state) {
      if (!state.identity?.pubkey) return false
      if (state.identity.source === 'nip07')
        return Boolean(typeof window !== 'undefined' && window.nostr?.signEvent)
      if (state.identity.source === 'local-key' || state.identity.source === 'nsec')
        return Boolean(state.secretKey)
      if (state.identity.source === 'bunker' || state.identity.source === 'pomegranate')
        return Boolean(
          state.remoteSigner?.pubkey && state.remoteSigner.pubkey === state.identity.pubkey,
        )
      return false
    },

    combinedFeed(state) {
      return this.dedupePostsById([...state.localPosts, ...state.relayPosts])
    },

    userPosts(state) {
      const pubkey = state.identity?.pubkey
      if (!pubkey) return [...state.localPosts]
      return [...state.localPosts, ...state.relayPosts].filter(
        (post) => post.author?.pubkey === pubkey,
      )
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
      this.followedHashtags = this.identity?.pubkey
        ? loadFollowedHashtags(this.identity.pubkey)
        : []
      this.localPosts = loadLocalPosts()
      this.loadRelayCache()
      this.initialized = true

      this.reconnectRemoteSigner({ silent: true })
      this.refreshFromNostr({ silent: true })
    },

    loadIdentity() {
      const current = safeIdentityForStorage(readJson(identityKey, null))
      if (current?.sessionOnly) {
        localStorage.removeItem(identityKey)
      } else if (current?.pubkey) {
        return current
      }

      const legacy = safeIdentityForStorage(readJson(legacyIdentityKey, null))
      if (legacy?.pubkey) {
        localStorage.removeItem(legacyIdentityKey)
      }

      return null
    },

    saveIdentity(nextIdentity) {
      const safeIdentity = safeIdentityForStorage(nextIdentity)
      if (safeIdentity?.sessionOnly) {
        localStorage.removeItem(identityKey)
      } else {
        localStorage.setItem(identityKey, JSON.stringify(safeIdentity))
      }
      this.identity = nextIdentity
      this.relayProfile = {}
      this.following = []
      this.followedHashtags = loadFollowedHashtags(nextIdentity.pubkey)
      this.followers = []
      this.relayPosts = []
      this.interactionsByEventId = {}
      this.pendingRelayEvents = []
      this.closeLiveFeedSubscription()
      this.relayCursor = null
      this.hasMoreRelayPosts = false
      this.loadingMoreRelayPosts = false
      this.authorProfiles = {}
      localStorage.removeItem(relayCacheKey)
      this.message = `Logged in as ${shortKey(nextIdentity.pubkey)}.`
    },

    clearAuthState(message = 'Logged out. Local posts were kept.') {
      this.closeRemoteSigner()
      localStorage.removeItem(identityKey)
      localStorage.removeItem(legacyIdentityKey)
      localStorage.removeItem(relayCacheKey)
      this.identity = null
      this.secretKey = null
      this.relayProfile = {}
      this.authorProfiles = {}
      this.following = []
      this.followedHashtags = []
      this.followers = []
      this.relayPosts = []
      this.interactionsByEventId = {}
      this.pendingRelayEvents = []
      this.closeLiveFeedSubscription()
      this.relayCursor = null
      this.hasMoreRelayPosts = false
      this.loadingMoreRelayPosts = false
      this.message = message
    },

    async loginWithNip07() {
      try {
        this.closeRemoteSigner()
        const identity = await requestNip07Login(window)
        const previousPubkey = this.identity?.pubkey
        this.secretKey = null
        if (previousPubkey && previousPubkey !== identity.pubkey) {
          this.message = 'Browser signer identity changed. Resetting Faro session.'
        }
        this.saveIdentity(identity)
        await this.refreshFromNostr()
      } catch {
        this.message = 'NIP-07 login was cancelled or failed.'
      }
    },

    async loginWithGoogle() {
      const centralUrl = this.settings?.pomegranateCentral || 'https://promenade.fiatjaf.com'
      this.bunkerLoading = true
      this.message = 'Connecting to Pomegranate...'
      try {
        this.closeRemoteSigner()
        const { auth, profile, bunkerUrl } = await loginWithPomegranate({
          centralUrl,
        })
        const signer = await createRemoteSigner(bunkerUrl, { timeoutMs: 30000 })
        this.remoteSigner = signer
        this.secretKey = null
        this.saveIdentity({
          source: 'pomegranate',
          pubkey: signer.pubkey,
          signerPubkey: signer.signerPubkey,
          relays: signer.relays,
          type: 'bunker',
          bunkerUrl: signer.bunkerUrl,
          clientSecretKeyHex: signer.clientSecretKeyHex,
          encryption: signer.encryption,
          pomegranateCentral: auth.centralUrl,
          pomegranateEmail: auth.email || profile.email,
          pomegranateProfile: profile.name,
        })
        this.message = `Connected via Pomegranate for ${shortKey(signer.pubkey)}.`
        await this.refreshFromNostr()
      } catch (error) {
        this.remoteSigner = null
        this.message = error?.message || 'Pomegranate login failed.'
        throw error
      } finally {
        this.bunkerLoading = false
      }
    },

    async loginWithBunker(bunkerUrl) {
      const remoteSignerInput =
        typeof bunkerUrl === 'object' && bunkerUrl !== null
          ? bunkerUrl
          : { uri: bunkerUrl, clientSecretKey: null }
      this.bunkerLoading = true
      this.message = 'Connecting to remote signer…'
      try {
        this.closeRemoteSigner()
        const signer = await createRemoteSigner(remoteSignerInput.uri, {
          timeoutMs: 60000,
          clientSecretKey: remoteSignerInput.clientSecretKey,
          abortSignal: remoteSignerInput.abortSignal,
        })
        this.remoteSigner = signer
        this.secretKey = null
        this.saveIdentity({
          source: 'bunker',
          pubkey: signer.pubkey,
          signerPubkey: signer.signerPubkey,
          relays: signer.relays,
          type: 'bunker',
          bunkerUrl: signer.bunkerUrl,
          clientSecretKeyHex: signer.clientSecretKeyHex,
          encryption: signer.encryption,
        })
        this.message = `Connected to remote signer for ${shortKey(signer.pubkey)}.`
        await this.refreshFromNostr()
      } catch (error) {
        this.remoteSigner = null
        this.message = error?.message || 'Could not connect to remote signer.'
      } finally {
        this.bunkerLoading = false
      }
    },

    async createLocalKey() {
      this.closeRemoteSigner()
      const keypair = createKeypair()
      this.secretKey = keypair.secretKey
      this.saveIdentity({ pubkey: keypair.pubkey, source: 'local-key', sessionOnly: true })
      this.message = `New key created for this session. Back it up now: ${keypair.nsec}`
    },

    async importNsec(input) {
      try {
        this.closeRemoteSigner()
        const keypair = keypairFromSecretKey(parseSecretKey(input))
        this.secretKey = keypair.secretKey
        this.saveIdentity({ pubkey: keypair.pubkey, source: 'nsec', sessionOnly: true })
        this.message = 'Private key imported for this session only.'
      } catch (error) {
        this.message = error?.message || 'Could not import private key.'
      }
    },

    async reconnectRemoteSigner({ silent = false } = {}) {
      if (!(this.identity?.source === 'bunker' || this.identity?.source === 'pomegranate'))
        return false
      if (this.remoteSigner?.pubkey === this.identity.pubkey) return true
      if (!this.identity.bunkerUrl || !this.identity.clientSecretKeyHex) {
        if (!silent) this.message = 'Remote signer session needs a fresh sign-in.'
        return false
      }

      this.bunkerLoading = true
      if (!silent) this.message = 'Reconnecting remote signer…'
      try {
        this.closeRemoteSigner()
        const signer = await createRemoteSigner(this.identity.bunkerUrl, {
          clientSecretKey: secretKeyFromHex(this.identity.clientSecretKeyHex),
          encryption: this.identity.encryption,
          isReconnect: true,
          accountPubkey: this.identity.pubkey,
          timeoutMs: 15000,
        })
        if (signer.pubkey !== this.identity.pubkey) {
          await signer.close?.()
          throw new Error('Remote signer returned a different account.')
        }
        this.remoteSigner = signer
        this.secretKey = null
        this.saveIdentity({
          ...this.identity,
          source: this.identity.source,
          pubkey: signer.pubkey,
          signerPubkey: signer.signerPubkey,
          relays: signer.relays,
          type: 'bunker',
          bunkerUrl: signer.bunkerUrl,
          clientSecretKeyHex: signer.clientSecretKeyHex,
          encryption: signer.encryption,
        })
        if (!silent) this.message = `Reconnected remote signer for ${shortKey(signer.pubkey)}.`
        return true
      } catch (error) {
        this.remoteSigner = null
        if (!silent) this.message = error?.message || 'Could not reconnect remote signer.'
        return false
      } finally {
        this.bunkerLoading = false
      }
    },

    async activeSigner(action = 'publishing to Nostr') {
      let signer = await this.currentSigner()
      if (signer) return signer

      await this.reconnectRemoteSigner({ silent: true })
      signer = await this.currentSigner()
      if (!signer) {
        if (this.identity || !this.message) {
          this.message = this.requireSignerMessage(action)
        }
      }
      return signer
    },

    async currentSigner() {
      if (this.identity?.source === 'nip07') {
        if (!hasNip07Signer(window)) {
          this.clearAuthState('Browser signer is no longer available. Please log in again.')
          return null
        }
        const livePubkey = await getNip07Pubkey(window).catch(() => '')
        if (!livePubkey) {
          return null
        }
        if (livePubkey !== this.identity.pubkey) {
          this.clearAuthState(
            'Browser signer switched accounts. Please log in again with the new account.',
          )
          return null
        }
        return nip07Signer(window)
      }
      if (
        (this.identity?.source === 'local-key' || this.identity?.source === 'nsec') &&
        this.secretKey
      ) {
        return makeLocalSigner(this.secretKey)
      }
      if (
        (this.identity?.source === 'bunker' || this.identity?.source === 'pomegranate') &&
        this.remoteSigner?.pubkey === this.identity?.pubkey
      ) {
        return this.remoteSigner
      }
      return null
    },

    closeRemoteSigner() {
      const signer = this.remoteSigner
      this.remoteSigner = null
      Promise.resolve(signer?.close?.()).catch(() => {
        // Ignore cleanup errors.
      })
    },

    generateIdentity() {
      this.createLocalKey()
    },

    requireSignerMessage(action = 'publishing to Nostr') {
      if (!this.identity?.pubkey) {
        return `Sign in before ${action}.`
      }
      if (this.identity.source === 'nip07') {
        return 'Browser signer is not available. Please log in again.'
      }
      if (this.identity.source === 'local-key' || this.identity.source === 'nsec') {
        return 'This session key is no longer available. Sign in or import it again.'
      }
      if (this.identity.source === 'bunker' || this.identity.source === 'pomegranate') {
        return this.remoteSigner
          ? 'Remote signer is connected but could not sign. Try reconnecting.'
          : 'Remote signer connection is not active. Sign in again with your bunker link.'
      }
      return 'No signer available.'
    },

    logout() {
      this.clearAuthState('Logged out. Local posts were kept.')
      this.refreshFromNostr({ silent: true })
    },

    loadRelayCache() {
      const cache = readJson(relayCacheKey, null)
      if (!cache) return
      // Reject anonymous cache when logged in, account cache when logged out,
      // and any cache that belongs to a different account.
      if (!this.identity?.pubkey || !cache.pubkey || cache.pubkey !== this.identity.pubkey) {
        localStorage.removeItem(relayCacheKey)
        return
      }
      this.relayProfile = normalizeProfile(cache.relayProfile || {})
      this.following = Array.isArray(cache.following) ? cache.following : []
      this.followers = Array.isArray(cache.followers) ? cache.followers : []
      this.relayPosts = this.dedupePostsById(
        Array.isArray(cache.relayPosts) ? cache.relayPosts : [],
      )
      this.interactionsByEventId = cache.interactionsByEventId || {}
      this.relayCursor = cache.relayCursor || this.cursorFromPosts(this.relayPosts)
      this.hasMoreRelayPosts = Boolean(cache.hasMoreRelayPosts)
      this.authorProfiles = cache.authorProfiles || {}
    },

    saveRelayCache() {
      // Never persist relay cache without an authenticated pubkey; logged-out
      // global feed data must not become reusable account cache.
      if (!this.identity?.pubkey) return
      localStorage.setItem(
        relayCacheKey,
        JSON.stringify({
          relayProfile: normalizeProfile(this.relayProfile),
          pubkey: this.identity.pubkey,
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
      const isVideo = /^video\//.test(media?.mimeType || '')
      const post = {
        id: event.id,
        author: this.authorForPubkey(event.pubkey || this.identity?.pubkey || ''),
        caption: String(caption || '').trim(),
        image: isVideo ? '' : mediaUrl,
        images: isVideo ? [] : [mediaUrl],
        video: isVideo ? mediaUrl : '',
        videos: isVideo ? [mediaUrl] : [],
        isVideo,
        ratio: media?.ratioKey || '1:1',
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
      this.relayPosts = [post, ...this.relayPosts.filter((item) => item.id !== post.id)].sort(
        newestFirst,
      )
      this.saveRelayCache()
      return post
    },

    clearPostCache() {
      clearLocalPosts()
      this.localPosts = []
      this.message = 'Local posts cleared. Login state kept.'
    },

    updateFollowedHashtags(tags) {
      this.followedHashtags = saveFollowedHashtags(tags, this.identity?.pubkey)
      this.relayPosts = []
      this.pendingRelayEvents = []
      this.relayCursor = null
      this.hasMoreRelayPosts = false
      this.closeLiveFeedSubscription()
      localStorage.removeItem(relayCacheKey)
      this.message = this.followedHashtags.length
        ? `Following ${this.followedHashtags.length} hashtag${this.followedHashtags.length === 1 ? '' : 's'}.`
        : 'Hashtag follows cleared.'
      return this.followedHashtags
    },

    async refreshFromNostr({ silent = false } = {}) {
      this.refreshing = true
      if (!silent) this.message = ''

      try {
        const [profileResult, followingResult] = this.identity?.pubkey
          ? await Promise.all([
              fetchProfile(this.identity.pubkey),
              fetchFollowing(this.identity.pubkey),
            ])
          : [
              { ok: false, profile: {} },
              { ok: false, pubkeys: [], relayHints: [] },
            ]

        let refreshed = false

        if (profileResult.ok) {
          this.relayProfile = normalizeProfile(profileResult.profile)
          refreshed = true
        }

        if (followingResult.ok) {
          this.following = followingResult.pubkeys
          refreshed = true
        }

        const authors = this.feedAuthors()
        const latest = this.latestRelayPostTimestamp()
        const anonymous = !this.identity?.pubkey
        const visualResult = await fetchVisualFeed(authors, {
          limit: silent && !this.relayPosts.length ? INITIAL_FEED_LIMIT : FEED_PAGE_SIZE,
          relays: followingResult.relayHints,
          tags: this.followedHashtags,
          anonymous,
          since: !silent && latest ? latest + 1 : daysAgoSeconds(INITIAL_LOOKBACK_DAYS),
        })

        if (visualResult.ok) {
          const events = visualResult.events
          const pubkeys = [...new Set(events.map((event) => event.pubkey).filter(Boolean))]
          await this.hydrateAuthorProfiles(pubkeys, { anonymous })

          const nextPosts = this.postsFromVisualEvents(events)
          this.relayPosts = silent ? nextPosts : this.mergeRelayPosts(nextPosts)
          await this.refreshInteractionsForPosts(this.relayPosts)
          this.relayCursor = this.cursorFromEvents(events) || this.cursorFromPosts(this.relayPosts)
          this.hasMoreRelayPosts = true
          refreshed = true
        }

        if (refreshed) {
          this.saveRelayCache()
          this.startLiveFeedSubscription()
        }

        if (!silent) {
          this.message =
            refreshed || this.following.length || this.relayPosts.length
              ? `Nostr refresh complete: ${this.following.length} follows, ${this.followedHashtags.length} hashtags, ${this.relayPosts.length} visual posts.`
              : 'Relay data was unavailable. Showing cached data if available.'
        }
      } catch {
        if (!silent) this.message = 'Relay fetch failed or timed out. Local posting is available.'
      } finally {
        this.refreshing = false
      }
    },

    async loadMoreVisualPosts() {
      if (this.loadingMoreRelayPosts || !this.hasMoreRelayPosts) return

      const until = this.relayCursor || this.cursorFromPosts(this.relayPosts)
      if (!until) {
        this.hasMoreRelayPosts = false
        return
      }

      this.loadingMoreRelayPosts = true
      try {
        const authors = this.feedAuthors()
        const anonymous = !this.identity?.pubkey
        const visualResult = await fetchVisualFeed(authors, {
          limit: FEED_PAGE_SIZE,
          until,
          tags: this.followedHashtags,
          anonymous,
          timeoutMs: 6500,
        })

        if (!visualResult.ok) return

        const events = visualResult.events
        const pubkeys = [...new Set(events.map((event) => event.pubkey).filter(Boolean))]
        await this.hydrateAuthorProfiles(pubkeys, { anonymous })

        const existing = new Set(this.relayPosts.map((post) => post.id))
        const nextPosts = this.postsFromVisualEvents(events).filter(
          (post) => !existing.has(post.id),
        )
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
      return this.dedupePostsById([...this.relayPosts, ...(posts || [])]).slice(
        0,
        RELAY_CACHE_LIMIT,
      )
    },

    dedupePostsById(posts) {
      const postsById = new Map()
      for (const post of posts || []) {
        if (!post?.id) continue
        const current = postsById.get(post.id)
        if (!current || postCreatedAtSeconds(post) >= postCreatedAtSeconds(current)) {
          postsById.set(post.id, post)
        }
      }
      return [...postsById.values()].sort(newestFirst)
    },

    latestRelayPostTimestamp() {
      return this.relayPosts.reduce((value, post) => {
        const createdAt = Math.floor(Date.parse(post.createdAt) / 1000)
        if (!Number.isFinite(createdAt)) return value
        return Math.max(value, createdAt)
      }, 0)
    },

    feedAuthors() {
      return this.identity?.pubkey
        ? [
            this.identity.pubkey,
            ...this.following.filter((pubkey) => pubkey !== this.identity.pubkey),
          ].slice(0, 100)
        : []
    },

    startLiveFeedSubscription() {
      this.closeLiveFeedSubscription()
      const authors = [this.identity?.pubkey, ...this.following].filter(Boolean).slice(0, 100)
      if (!authors.length && !this.followedHashtags.length) return

      const existing = new Set([
        ...this.relayPosts.map((post) => post.nostr?.id).filter(Boolean),
        ...this.pendingRelayEvents.map((event) => event.id),
      ])
      this.liveFeedSubscription = subscribeVisualFeed(authors, {
        since: this.latestRelayPostTimestamp() || Math.floor(Date.now() / 1000),
        tags: this.followedHashtags,
        onEvent: (event) => {
          if (existing.has(event.id)) return
          existing.add(event.id)
          this.pendingRelayEvents = [event, ...this.pendingRelayEvents]
            .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
            .slice(0, 50)
        },
      })
    },

    closeLiveFeedSubscription() {
      this.liveFeedSubscription?.close?.()
      this.liveFeedSubscription = null
    },

    async mergePendingRelayPosts() {
      const events = this.pendingRelayEvents
      if (!events.length) return
      this.pendingRelayEvents = []
      const pubkeys = [...new Set(events.map((event) => event.pubkey).filter(Boolean))]
      await this.hydrateAuthorProfiles(pubkeys)
      const nextPosts = this.postsFromVisualEvents(events)
      this.relayPosts = this.mergeRelayPosts(nextPosts)
      await this.refreshInteractionsForPosts(nextPosts)
      this.saveRelayCache()
    },

    async hydrateAuthorProfiles(pubkeys, options = {}) {
      const missing = pubkeys
        .filter((pubkey) => pubkey && !this.authorProfiles[pubkey])
        .slice(0, 20)
      if (!missing.length) return
      const profiles = await fetchProfiles(missing, { ...options, timeoutMs: 4500 })
      this.authorProfiles = {
        ...this.authorProfiles,
        ...Object.fromEntries(
          missing.map((pubkey) => [pubkey, normalizeProfile(profiles[pubkey] || {})]),
        ),
      }
    },

    async fetchProfileByPubkey(pubkey) {
      if (!pubkey || this.authorProfiles[pubkey]?.__fetched) return
      const hexPubkey = this.resolvePubkey(pubkey)
      if (!hexPubkey) return
      try {
        const result = await fetchProfile(hexPubkey, {
          anonymous: !this.identity?.pubkey,
          timeoutMs: 4500,
        })
        this.authorProfiles = {
          ...this.authorProfiles,
          [hexPubkey]: { ...(result.ok ? normalizeProfile(result.profile) : {}), __fetched: true },
        }
      } catch {
        this.authorProfiles = {
          ...this.authorProfiles,
          [hexPubkey]: {
            ...normalizeProfile(this.authorProfiles[hexPubkey] || {}),
            __fetched: true,
          },
        }
      }
    },

    resolvePubkey(pubkey) {
      if (!pubkey) return ''
      if (pubkey.startsWith('npub')) {
        try {
          const { data } = decode(pubkey)
          return data
        } catch {
          return ''
        }
      }
      return pubkey
    },

    authorForPubkey(pubkey) {
      const profile = normalizeProfile(this.authorProfiles[pubkey] || {})
      const name = profile.display_name || profile.name || shortKey(pubkey)
      return { name, pubkey, picture: profile.picture || '' }
    },

    postsFromVisualEvents(events) {
      return events
        .filter((event) => event.imageUrls?.length || event.videoUrls?.length)
        .map((event) => {
          const firstImage = event.imageUrls?.[0]
          const firstVideo = event.videoUrls?.[0]
          const mediaUrls = [...(event.imageUrls || []), ...(event.videoUrls || [])]
          const caption = mediaUrls
            .reduce((content, url) => content.replace(url, ''), event.content || '')
            .trim()
          return {
            id: event.id,
            author: this.authorForPubkey(event.pubkey),
            caption,
            image: firstImage || '',
            images: event.imageUrls || [],
            video: firstVideo || '',
            videos: event.videoUrls || [],
            isVideo: Boolean(firstVideo && !firstImage),
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
          }
        })
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
        ...(this.interactionsByEventId[eventId] || {
          count: 0,
          likedByMe: false,
          replies: [],
          zapCount: 0,
          sats: 0,
          msats: 0,
        }),
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
      const signer = await this.activeSigner('publishing Nostr likes')
      if (!signer) {
        return
      }
      if (this.interactionsByEventId[rootEvent.id]?.likedByMe) return

      const current = this.interactionsByEventId[rootEvent.id] || {
        count: 0,
        likedByMe: false,
        replies: [],
        zapCount: 0,
        sats: 0,
        msats: 0,
      }
      this.interactionsByEventId = {
        ...this.interactionsByEventId,
        [rootEvent.id]: { ...current, count: current.count + 1, likedByMe: true },
      }
      this.publishingInteractions = { ...this.publishingInteractions, [rootEvent.id]: true }

      const result = await publishReaction(rootEvent, { timeoutMs: 7000, signer })
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
      const signer = await this.activeSigner('publishing Nostr comments')
      if (!signer) {
        return false
      }

      this.publishingInteractions = { ...this.publishingInteractions, [rootEvent.id]: true }
      const result = await publishReply(rootEvent, text, { timeoutMs: 7000, signer })
      this.publishingInteractions = { ...this.publishingInteractions, [rootEvent.id]: false }

      if (!result.ok) {
        this.message = result.error || 'Comment could not be published to any relay.'
        return false
      }

      const current = this.interactionsByEventId[rootEvent.id] || {
        count: 0,
        likedByMe: false,
        replies: [],
        zapCount: 0,
        sats: 0,
        msats: 0,
      }
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

    async zapPost(post) {
      const rootEvent = this.rootEventForPost(post)
      if (!rootEvent) {
        this.message = 'Only relay posts can be zapped on Nostr.'
        return
      }

      const authorProfile = normalizeProfile(this.authorProfiles[rootEvent.pubkey] || {})
      const lightningAddress = authorProfile.lud16 || authorProfile.lud06
      if (!lightningAddress) {
        this.message = 'This author has no lightning address, so this post cannot be zapped yet.'
        return
      }

      const signer = await this.activeSigner('zapping Nostr posts')
      if (!signer) return

      // Minimal real path: a full LNURL/NIP-57 flow needs an invoice fetch step.
      // Without WebLN we cannot pay, so we explain instead of faking a success.
      if (typeof window === 'undefined' || !window.webln?.sendPayment) {
        this.message =
          'Zapping requires a WebLN-enabled wallet (e.g. Alby) connected to your browser.'
        return
      }

      // TODO: fetch LNURL callback for the lightning address, post a zap request,
      // receive a bolt11 invoice, then pay it via window.webln.sendPayment.
      this.message = `Zap flow is not fully wired yet. Author lightning address: ${lightningAddress}`
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
