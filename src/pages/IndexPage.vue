<template>
  <q-page class="page">
    <main class="content">
      <section class="appbar card">
        <div class="brand">Faro</div>
        <div class="search-pill">
          <q-icon name="search" size="16px" />
          <span>Search visuals</span>
        </div>
        <div class="top-actions">
          <q-btn flat round icon="refresh" :loading="refreshing" @click="refreshFromNostr">
            <q-tooltip>Refresh Nostr profile, follows and images</q-tooltip>
          </q-btn>
          <q-btn v-if="identity" flat round icon="logout" @click="logout">
            <q-tooltip>Logout</q-tooltip>
          </q-btn>
        </div>
      </section>

      <q-banner v-if="message" rounded class="message" dense>{{ message }}</q-banner>

      <div class="dashboard">
        <aside class="profile-panel card" data-testid="profile-card">
          <div class="profile-mini">
            <q-avatar size="54px" class="profile-avatar" :color="identity ? 'black' : 'grey-5'" text-color="white">
              <img v-if="activeProfile.picture" :src="activeProfile.picture" alt="Profile avatar" />
              <span v-else>{{ avatarInitial }}</span>
            </q-avatar>
            <div>
              <h2>{{ identity ? displayName : 'Not logged in' }}</h2>
              <p>{{ identity ? profileSubtitle : 'Connect a signer to post.' }}</p>
            </div>
          </div>

          <nav class="side-menu">
            <span class="active"><q-icon name="home" /> News Feed</span>
            <span><q-icon name="explore" /> Explore</span>
            <span><q-icon name="image" /> Visuals</span>
            <span><q-icon name="bookmark_border" /> Saved</span>
            <span><q-icon name="settings" /> Settings</span>
          </nav>

          <div class="profile-actions">
            <q-badge class="source-badge" :label="authLabel" />
            <q-btn
              v-if="!identity"
              unelevated
              color="dark"
              :disable="!hasNip07"
              :label="hasNip07 ? 'Login with NIP-07' : 'No signer'"
              data-testid="nip07-login"
              @click="loginWithNip07"
            />
            <q-btn v-if="!identity" outline color="dark" label="Local identity" data-testid="generate-identity" @click="generateIdentity" />
            <q-btn v-else flat color="dark" icon="logout" label="Logout" @click="logout" />
          </div>
        </aside>

        <section class="main-column">
          <section class="stories card">
            <div class="story your-story">
              <q-avatar size="58px" color="black" text-color="white">{{ avatarInitial }}</q-avatar>
              <span>Your story</span>
            </div>
            <div v-for="person in storyProfiles" :key="person.pubkey" class="story">
              <q-avatar size="58px" color="deep-orange-4" text-color="white">
                <img v-if="person.picture" :src="person.picture" :alt="person.name" />
                <span v-else>{{ person.name.slice(0, 1) }}</span>
              </q-avatar>
              <span>{{ person.name }}</span>
            </div>
          </section>

          <section class="composer card" data-testid="composer-card">
            <div class="composer-header">
              <q-avatar size="44px" color="black" text-color="white">
                <img v-if="activeProfile.picture" :src="activeProfile.picture" alt="Profile avatar" />
                <span v-else>{{ avatarInitial }}</span>
              </q-avatar>
              <div class="composer-title">
                <strong>Add post</strong>
                <span>{{ identity ? displayName : 'Login to unlock posting' }}</span>
              </div>
              <q-btn flat dense color="negative" icon="delete_sweep" @click="clearPostCache">
                <q-tooltip>Clear local posts</q-tooltip>
              </q-btn>
            </div>

            <q-banner v-if="!identity" rounded dense class="inline-warning">
              Login or create a local identity to enable posting.
            </q-banner>

            <label class="image-picker" :style="previewStyle" :class="{ 'has-preview': imagePreview }" data-testid="image-picker">
              <input ref="imageInput" type="file" accept="image/*" data-testid="image-input" @change="selectImage" />
              <img v-if="imagePreview" :src="imagePreview" alt="Selected preview" />
              <div v-else class="picker-empty">
                <q-icon name="add_photo_alternate" size="30px" />
                <strong>Add image</strong>
                <span>Pick a ratio, then choose a photo.</span>
              </div>
            </label>

            <div class="ratio-row" aria-label="Image aspect ratio">
              <q-btn
                v-for="ratio in ratios"
                :key="ratio"
                rounded
                dense
                unelevated
                :class="{ active: selectedRatio === ratio }"
                :label="ratio"
                :data-testid="`ratio-${ratio}`"
                @click="setRatio(ratio)"
              />
            </div>
            <q-input v-model="caption" type="textarea" autogrow outlined placeholder="Caption…" data-testid="caption-input" />
            <q-btn unelevated color="dark" class="post-btn" :disable="!canPost" label="Post locally" data-testid="post-button" @click="publishPost" />
          </section>
        </section>

        <aside class="insights card">
          <div class="section-title compact">
            <strong>Insights</strong>
            <span>See More</span>
          </div>
          <p class="muted">{{ following.length }} follows · {{ relayPosts.length }} relay visuals · {{ posts.length }} local</p>
          <div class="bars" aria-hidden="true">
            <i v-for="height in [42, 74, 28, 55, 82, 12, 50]" :key="height" :style="{ height: `${height}%` }" />
          </div>
          <strong>Suggestions For You</strong>
          <div v-for="person in suggestedProfiles" :key="person.pubkey" class="suggestion">
            <q-avatar size="34px" color="black" text-color="white">
              <img v-if="person.picture" :src="person.picture" :alt="person.name" />
              <span v-else>{{ person.name.slice(0, 1) }}</span>
            </q-avatar>
            <div>
              <strong>{{ person.name }}</strong>
              <span>{{ shortKey(person.pubkey) }}</span>
            </div>
            <q-btn flat dense color="primary" label="Follow" />
          </div>
        </aside>
      </div>

      <section class="feed">
        <div class="feed-heading">
          <h2>Visual feed</h2>
          <q-btn flat dense icon="refresh" label="Fetch Nostr" :loading="refreshing" @click="refreshFromNostr" />
        </div>

        <div v-if="combinedFeed.length" class="feed-grid" data-testid="feed-grid">
          <article v-for="post in combinedFeed" :key="post.id" class="post card" data-testid="feed-post">
            <div class="post-author">
              <q-avatar size="34px" color="deep-orange-4" text-color="white">
                <img v-if="post.author.picture" :src="post.author.picture" :alt="post.author.name" />
                <span v-else>{{ post.author.name.slice(0, 1) }}</span>
              </q-avatar>
              <div>
                <strong>{{ post.author.name }}</strong>
                <div>{{ formatDate(post.createdAt) }} · {{ post.source }}</div>
              </div>
            </div>
            <img :src="post.image" :alt="post.caption || 'Visual post image'" class="post-image" :style="{ aspectRatio: cssRatio(post.ratio) }" />
            <p v-if="post.caption" class="post-caption">{{ post.caption }}</p>
          </article>
        </div>

        <div v-else class="empty card" data-testid="empty-feed">
          <q-icon name="auto_awesome" size="32px" />
          <p>No images yet. Post locally or fetch Nostr visuals from followed pubkeys.</p>
        </div>
      </section>
    </main>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  ASPECT_RATIOS,
  clearLocalPosts,
  loadLocalPosts,
  processImageFile,
  saveLocalPostsWithPruning,
} from 'src/services/localMedia'
import { fetchFollowing, fetchProfile, fetchVisualFeed } from 'src/services/nostrRelay'

const identityKey = 'faro-identity'
const legacyIdentityKey = 'nostr-visual-demo-identity'

const identity = ref(null)
const relayProfile = ref({})
const authorProfiles = ref({})
const following = ref([])
const posts = ref([])
const relayPosts = ref([])
const caption = ref('')
const imagePreview = ref('')
const selectedRatio = ref('1:1')
const imageInput = ref(null)
const hasNip07 = ref(false)
const message = ref('')
const refreshing = ref(false)

const ratios = Object.keys(ASPECT_RATIOS)

const activeProfile = computed(() => ({ ...(identity.value || {}), ...relayProfile.value }))
const displayName = computed(() => activeProfile.value.display_name || activeProfile.value.name || 'Faro user')
const profileSubtitle = computed(() => activeProfile.value.nip05 || shortKey(identity.value?.pubkey || ''))
const avatarInitial = computed(() => (identity.value ? displayName.value.slice(0, 1) : '?'))
const authLabel = computed(() => {
  if (!identity.value) return 'logged out'
  if (identity.value.source === 'nip07') return 'NIP-07'
  return 'local dev'
})
const canPost = computed(() => Boolean(identity.value && imagePreview.value))
const previewStyle = computed(() => ({ aspectRatio: cssRatio(selectedRatio.value) }))
const combinedFeed = computed(() => [...posts.value, ...relayPosts.value].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
const namedPeople = computed(() => {
  const people = new Map()
  for (const post of relayPosts.value) {
    if (!post.author?.pubkey || people.has(post.author.pubkey)) continue
    people.set(post.author.pubkey, post.author)
  }
  return [...people.values()].filter((person) => person.name && !person.name.includes('…'))
})
const storyProfiles = computed(() => namedPeople.value.slice(0, 6))
const suggestedProfiles = computed(() => namedPeople.value.slice(0, 5))

onMounted(() => {
  hasNip07.value = typeof window !== 'undefined' && Boolean(window.nostr?.getPublicKey)
  identity.value = loadIdentity()
  posts.value = loadLocalPosts()
  if (identity.value?.pubkey) {
    message.value = `Logged in as ${shortKey(identity.value.pubkey)}.`
  }
})

function readJson(key, fallback) {
  try {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : fallback
  } catch {
    return fallback
  }
}

function loadIdentity() {
  const current = readJson(identityKey, null)
  if (current?.pubkey) return current

  const legacy = readJson(legacyIdentityKey, null)
  if (legacy?.pubkey) {
    localStorage.setItem(identityKey, JSON.stringify(legacy))
    localStorage.removeItem(legacyIdentityKey)
    return legacy
  }

  return null
}

function saveIdentity(nextIdentity) {
  localStorage.setItem(identityKey, JSON.stringify(nextIdentity))
  identity.value = nextIdentity
  relayProfile.value = {}
  message.value = `Logged in as ${shortKey(nextIdentity.pubkey)}.`
}

async function loginWithNip07() {
  if (!window.nostr?.getPublicKey) {
    message.value = 'No NIP-07 signer detected in this browser.'
    return
  }
  try {
    const pubkey = await window.nostr.getPublicKey()
    saveIdentity({ name: 'Nostr user', pubkey, source: 'nip07' })
    await refreshFromNostr()
  } catch {
    message.value = 'NIP-07 login was cancelled or failed.'
  }
}

function generateIdentity() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const pubkey = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  saveIdentity({ name: `Local ${pubkey.slice(0, 4)}`, pubkey, source: 'local-dev' })
}

function logout() {
  localStorage.removeItem(identityKey)
  localStorage.removeItem(legacyIdentityKey)
  identity.value = null
  relayProfile.value = {}
  following.value = []
  relayPosts.value = []
  caption.value = ''
  imagePreview.value = ''
  if (imageInput.value) imageInput.value.value = ''
  message.value = 'Logged out. Local posts were kept.'
}

async function selectImage(event) {
  message.value = ''
  const file = event.target.files?.[0]
  if (!file) return
  try {
    const processed = await processImageFile(file, selectedRatio.value)
    imagePreview.value = processed.dataUrl
  } catch {
    message.value = 'Could not process that image.'
  }
}

async function setRatio(ratio) {
  selectedRatio.value = ratio
  const file = imageInput.value?.files?.[0]
  if (file) await selectImage({ target: { files: [file] } })
}

function publishPost() {
  if (!identity.value) {
    message.value = 'Login or create a local development identity before posting.'
    return
  }
  if (!imagePreview.value) {
    message.value = 'Choose an image before posting.'
    return
  }

  const nextPost = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    author: { name: displayName.value, pubkey: identity.value.pubkey },
    caption: caption.value.trim(),
    image: imagePreview.value,
    ratio: selectedRatio.value,
    createdAt: new Date().toISOString(),
    source: 'local kind 1 draft',
  }

  try {
    posts.value = saveLocalPostsWithPruning([nextPost, ...posts.value])
    caption.value = ''
    imagePreview.value = ''
    if (imageInput.value) imageInput.value.value = ''
    message.value = 'Posted locally.'
  } catch {
    message.value = 'Could not save locally. Try a smaller image or clear local posts.'
  }
}

function clearPostCache() {
  clearLocalPosts()
  posts.value = []
  message.value = 'Local posts cleared. Login state kept.'
}

async function refreshFromNostr() {
  if (!identity.value?.pubkey) {
    message.value = 'Login before fetching Nostr data.'
    return
  }

  refreshing.value = true
  message.value = ''
  try {
    const [profileResult, followingResult] = await Promise.all([
      fetchProfile(identity.value.pubkey),
      fetchFollowing(identity.value.pubkey),
    ])

    relayProfile.value = profileResult.ok ? profileResult.profile : {}
    following.value = followingResult.ok ? followingResult.pubkeys : []

    const authors = [identity.value.pubkey, ...following.value].slice(0, 20)
    const visualResult = await fetchVisualFeed(authors)
    const events = visualResult.ok ? visualResult.events : []

    const pubkeys = [...new Set(events.map((event) => event.pubkey).filter(Boolean))]
    await hydrateAuthorProfiles(pubkeys)

    relayPosts.value = events.flatMap((event) =>
      event.imageUrls.map((image, imageIndex) => ({
        id: `${event.id}-${imageIndex}`,
        author: authorForPubkey(event.pubkey),
        caption: event.content.replace(image, '').trim(),
        image,
        ratio: '1:1',
        createdAt: new Date((event.created_at || Date.now() / 1000) * 1000).toISOString(),
        source: 'relay kind 1',
      })),
    )

    message.value = profileResult.ok || following.value.length || relayPosts.value.length
      ? 'Nostr refresh complete.'
      : 'No relay profile/follows/images found yet. Local posting is available.'
  } catch {
    message.value = 'Relay fetch failed or timed out. Local posting is available.'
  } finally {
    refreshing.value = false
  }
}

function shortKey(pubkey = '') {
  return pubkey.length > 14 ? `${pubkey.slice(0, 8)}…${pubkey.slice(-6)}` : pubkey
}

async function hydrateAuthorProfiles(pubkeys) {
  const missing = pubkeys.filter((pubkey) => pubkey && !authorProfiles.value[pubkey]).slice(0, 20)
  if (!missing.length) return

  const entries = await Promise.all(
    missing.map(async (pubkey) => {
      const result = await fetchProfile(pubkey, { timeoutMs: 4500 })
      const profile = result.ok ? result.profile : {}
      return [pubkey, profile]
    }),
  )

  authorProfiles.value = {
    ...authorProfiles.value,
    ...Object.fromEntries(entries),
  }
}

function authorForPubkey(pubkey) {
  const profile = authorProfiles.value[pubkey] || {}
  const name = profile.display_name || profile.name || shortKey(pubkey)
  return { name, pubkey, picture: profile.picture || '' }
}

function cssRatio(ratio) {
  return ASPECT_RATIOS[ratio] ? ratio.replace(':', ' / ') : '1 / 1'
}

function formatDate(date) {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }).format(new Date(date))
}
</script>

<style scoped>
.page { min-height: 100vh; background: #eef3f6; }
.content { width: min(100%, 1180px); margin: 0 auto; padding: 18px 12px 42px; }
.card { border: 1px solid rgba(20, 24, 28, 0.05); border-radius: 24px; background: rgba(255, 255, 255, 0.96); box-shadow: 0 20px 50px rgba(34, 47, 62, 0.08); }
h1, h2, p { margin: 0; }
h2 { font-size: 1rem; letter-spacing: -0.03em; }
.appbar { display: grid; grid-template-columns: 220px minmax(180px, 1fr) auto; align-items: center; gap: 18px; padding: 12px 24px; }
.brand { font-size: 1.55rem; font-weight: 900; letter-spacing: -0.08em; }
.search-pill { display: flex; align-items: center; justify-content: center; gap: 8px; width: min(100%, 280px); justify-self: center; padding: 9px 16px; border-radius: 14px; background: #f4f4f4; color: #777; font-size: 0.8rem; }
.top-actions { display: flex; align-items: center; gap: 4px; }
.message { margin: 12px 0; background: #fff2df; color: #754219; }
.dashboard { display: grid; grid-template-columns: 230px minmax(0, 1fr) 300px; gap: 22px; align-items: start; margin-top: 12px; }
.profile-panel, .composer, .stories, .insights, .empty { padding: 18px; }
.profile-panel { position: sticky; top: 16px; min-height: 520px; display: flex; flex-direction: column; gap: 20px; }
.profile-mini { display: flex; align-items: center; gap: 12px; }
.profile-mini p, .muted, .post-author div div, .composer-title span, .suggestion span, .story span { color: #7d848b; font-size: 0.78rem; line-height: 1.4; }
.profile-avatar { flex: 0 0 auto; box-shadow: 0 10px 22px rgba(0, 0, 0, 0.12); }
.side-menu { display: grid; gap: 8px; }
.side-menu span { display: flex; align-items: center; gap: 12px; padding: 11px 12px; border-radius: 14px; color: #525960; font-weight: 650; }
.side-menu .active { background: #f3f3f3; color: #151515; }
.profile-actions { display: grid; gap: 10px; margin-top: auto; }
.source-badge { width: max-content; border-radius: 999px; background: #f0f0f0; color: #333; }
.main-column { display: grid; gap: 16px; }
.stories { display: flex; gap: 16px; overflow-x: auto; }
.story { display: grid; min-width: 68px; gap: 7px; justify-items: center; text-align: center; }
.story .q-avatar { padding: 2px; border: 2px solid #f04b79; box-shadow: inset 0 0 0 3px #fff; }
.your-story .q-avatar { border-color: #111; }
.composer { display: grid; gap: 12px; }
.composer-header, .section-title, .feed-heading, .post-author, .suggestion { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.composer-title { display: grid; flex: 1; }
.inline-warning { background: #fff7e8; color: #704923; }
.image-picker { display: grid; min-height: 230px; overflow: hidden; place-items: center; border: 1.5px dashed rgba(0, 0, 0, 0.18); border-radius: 22px; background: #f8f8f8; color: #555; cursor: pointer; }
.image-picker input { display: none; }
.image-picker img { display: block; width: 100%; height: 100%; object-fit: cover; }
.picker-empty { display: grid; gap: 4px; place-items: center; padding: 14px; text-align: center; }
.picker-empty span { color: #888; font-size: 0.82rem; }
.ratio-row { display: flex; flex-wrap: wrap; gap: 8px; }
.ratio-row .q-btn { background: #f1f1f1; color: #333; font-weight: 800; }
.ratio-row .q-btn.active { background: #111; color: white; }
.post-btn { border-radius: 16px; font-weight: 900; }
.insights { display: grid; gap: 14px; }
.section-title.compact span { color: #444; font-size: 0.78rem; font-weight: 700; }
.bars { height: 170px; display: flex; align-items: end; gap: 12px; padding: 16px 0 4px; }
.bars i { flex: 1; min-width: 18px; border-radius: 8px 8px 0 0; background: #1299e8; }
.suggestion { justify-content: flex-start; }
.suggestion > div { display: grid; flex: 1; min-width: 0; }
.feed { display: grid; gap: 14px; margin-top: 22px; }
.feed-grid { column-count: 3; column-gap: 14px; }
.post { display: inline-block; width: 100%; overflow: hidden; margin: 0 0 14px; break-inside: avoid; }
.post-author { justify-content: flex-start; padding: 12px; }
.post-image { display: block; width: 100%; height: auto; object-fit: contain; }
.post-caption { padding: 12px 14px 16px; line-height: 1.45; white-space: pre-wrap; }
.empty { display: grid; gap: 8px; place-items: center; color: #7e6c62; text-align: center; }
@media (max-width: 1020px) {
  .dashboard { grid-template-columns: 220px minmax(0, 1fr); }
  .insights { display: none; }
  .feed-grid { column-count: 2; }
}
@media (max-width: 700px) {
  .content { padding: 10px 8px 34px; }
  .appbar { grid-template-columns: 1fr auto; padding: 10px 14px; }
  .search-pill { display: none; }
  .dashboard { grid-template-columns: 1fr; gap: 12px; }
  .profile-panel { position: static; min-height: auto; }
  .side-menu { display: none; }
  .profile-actions { margin-top: 0; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .feed-grid { column-count: 1; }
  .image-picker { min-height: 190px; }
  .section-title, .feed-heading { align-items: flex-start; flex-direction: column; }
}
</style>
