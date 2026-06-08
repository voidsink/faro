<template>
  <q-page class="page">
    <main class="content">
      <section class="topbar card">
        <div>
          <p class="eyebrow">Faro development build</p>
          <h1>Nostr visual posting, locally testable.</h1>
          <p class="muted">
            Reads Nostr profile/follows/feed from relays. Publishing is still local while the
            Blossom upload + signed kind 1 publish path is built.
          </p>
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

      <section class="profile card" data-testid="profile-card">
        <q-avatar size="72px" class="profile-avatar" :color="identity ? 'deep-orange-4' : 'grey-5'" text-color="white">
          <img v-if="activeProfile.picture" :src="activeProfile.picture" alt="Profile avatar" />
          <span v-else>{{ avatarInitial }}</span>
        </q-avatar>

        <div class="profile-body">
          <div class="profile-row">
            <div>
              <h2>{{ identity ? displayName : 'Not logged in' }}</h2>
              <p class="key">{{ identity ? shortKey(identity.pubkey) : 'Connect a signer or create a local development identity.' }}</p>
            </div>
            <q-badge class="source-badge" :label="authLabel" />
          </div>

          <p class="about">
            {{ identity ? activeProfile.about || 'Profile loaded locally. Use refresh to fetch kind 0 metadata from relays.' : 'You need an identity before posting.' }}
          </p>

          <div class="stats">
            <span><strong>{{ following.length }}</strong> following</span>
            <span><strong>{{ relayPosts.length }}</strong> relay visuals</span>
            <span><strong>{{ posts.length }}</strong> local posts</span>
          </div>

          <div v-if="!identity" class="login-actions">
            <q-btn
              unelevated
              color="deep-purple-6"
              :disable="!hasNip07"
              :label="hasNip07 ? 'Login with NIP-07' : 'NIP-07 signer not detected'"
              data-testid="nip07-login"
              @click="loginWithNip07"
            />
            <q-btn outline color="deep-purple-6" label="Create local dev identity" data-testid="generate-identity" @click="generateIdentity" />
          </div>
        </div>
      </section>

      <section class="composer card" data-testid="composer-card">
        <div class="section-title">
          <div>
            <span>Create visual note</span>
            <p>Images are cropped/resized before local storage.</p>
          </div>
          <q-btn flat dense color="negative" icon="delete_sweep" label="Clear local posts" @click="clearPostCache" />
        </div>

        <q-banner v-if="!identity" rounded dense class="inline-warning">
          Login or create a local development identity to enable posting.
        </q-banner>

        <div class="composer-grid">
          <label class="image-picker" :style="previewStyle" :class="{ 'has-preview': imagePreview }" data-testid="image-picker">
            <input ref="imageInput" type="file" accept="image/*" data-testid="image-input" @change="selectImage" />
            <img v-if="imagePreview" :src="imagePreview" alt="Selected cropped preview" />
            <div v-else class="picker-empty">
              <q-icon name="add_photo_alternate" size="32px" />
              <strong>Add image</strong>
              <span>Choose a photo; crop ratio below.</span>
            </div>
          </label>

          <div class="composer-fields">
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
            <q-input v-model="caption" type="textarea" autogrow outlined placeholder="Caption for your visual note…" data-testid="caption-input" />
            <q-btn unelevated color="deep-purple-6" class="post-btn" :disable="!canPost" label="Post locally" data-testid="post-button" @click="publishPost" />
          </div>
        </div>
      </section>

      <section class="feed">
        <div class="feed-heading">
          <h2>Visual feed</h2>
          <q-btn flat dense icon="refresh" label="Fetch Nostr" :loading="refreshing" @click="refreshFromNostr" />
        </div>

        <div v-if="combinedFeed.length" class="feed-grid" data-testid="feed-grid">
          <article v-for="post in combinedFeed" :key="post.id" class="post card" data-testid="feed-post">
            <div class="post-author">
              <q-avatar size="34px" color="deep-orange-4" text-color="white">{{ post.author.name.slice(0, 1) }}</q-avatar>
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
const avatarInitial = computed(() => (identity.value ? displayName.value.slice(0, 1) : '?'))
const authLabel = computed(() => {
  if (!identity.value) return 'logged out'
  if (identity.value.source === 'nip07') return 'NIP-07'
  return 'local dev'
})
const canPost = computed(() => Boolean(identity.value && imagePreview.value))
const previewStyle = computed(() => ({ aspectRatio: cssRatio(selectedRatio.value) }))
const combinedFeed = computed(() => [...posts.value, ...relayPosts.value].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))

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

    relayPosts.value = events.flatMap((event) =>
      event.imageUrls.map((image, imageIndex) => ({
        id: `${event.id}-${imageIndex}`,
        author: { name: shortKey(event.pubkey), pubkey: event.pubkey },
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

function cssRatio(ratio) {
  return ASPECT_RATIOS[ratio] ? ratio.replace(':', ' / ') : '1 / 1'
}

function formatDate(date) {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }).format(new Date(date))
}
</script>

<style scoped>
.page { min-height: 100vh; }
.content { width: min(100%, 920px); margin: 0 auto; padding: 16px 12px 40px; }
.card { border: 1px solid rgba(84, 49, 37, 0.1); border-radius: 24px; background: rgba(255, 253, 248, 0.94); box-shadow: 0 16px 36px rgba(104, 69, 48, 0.09); }
.topbar, .profile, .composer, .empty { padding: 18px; }
.topbar { display: flex; justify-content: space-between; gap: 14px; }
.top-actions { display: flex; align-items: flex-start; gap: 4px; }
.eyebrow { margin: 0 0 8px; color: #b6572d; font-size: 0.72rem; font-weight: 900; letter-spacing: 0.1em; text-transform: uppercase; }
h1, h2, p { margin: 0; }
h1 { max-width: 13em; font-size: clamp(1.6rem, 6vw, 3rem); line-height: 0.98; letter-spacing: -0.06em; }
h2 { font-size: 1.2rem; letter-spacing: -0.04em; }
.muted, .about, .section-title p, .key, .post-author div div { color: #7c6b62; line-height: 1.5; }
.message { margin: 12px 0; background: #fff2df; color: #754219; }
.inline-warning { background: #fff7e8; color: #704923; }
.profile { display: flex; gap: 16px; margin-top: 12px; }
.profile-avatar { flex: 0 0 auto; box-shadow: 0 10px 22px rgba(177, 87, 45, 0.2); }
.profile-body { min-width: 0; flex: 1; }
.profile-row, .section-title, .feed-heading, .post-author { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.source-badge { border-radius: 999px; background: #f5ddc6; color: #733e24; }
.about { margin-top: 8px; }
.stats, .login-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.stats span { padding: 7px 10px; border-radius: 999px; background: #fff0e5; color: #6f4635; font-size: 0.82rem; }
.composer { display: grid; gap: 14px; margin-top: 14px; }
.composer-grid { display: grid; grid-template-columns: minmax(136px, 0.44fr) 1fr; gap: 14px; align-items: start; }
.image-picker { display: grid; min-height: 136px; overflow: hidden; place-items: center; border: 1.5px dashed rgba(170, 91, 54, 0.34); border-radius: 22px; background: #fff6ed; color: #9b5c3b; cursor: pointer; }
.image-picker input { display: none; }
.image-picker img, .post-image { display: block; width: 100%; height: 100%; object-fit: cover; }
.picker-empty { display: grid; gap: 4px; place-items: center; padding: 14px; text-align: center; }
.picker-empty span { color: #92786c; font-size: 0.82rem; }
.composer-fields { display: grid; gap: 10px; }
.ratio-row { display: flex; flex-wrap: wrap; gap: 8px; }
.ratio-row .q-btn { background: #f8eadc; color: #6f4635; font-weight: 800; }
.ratio-row .q-btn.active { background: linear-gradient(135deg, #7f44ff, #ff805c); color: white; }
.post-btn { border-radius: 16px; font-weight: 900; }
.feed { display: grid; gap: 14px; margin-top: 22px; }
.feed-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.post { overflow: hidden; }
.post-author { justify-content: flex-start; padding: 12px; }
.post-caption { padding: 12px 14px 16px; line-height: 1.45; white-space: pre-wrap; }
.empty { display: grid; gap: 8px; place-items: center; color: #7e6c62; text-align: center; }
@media (max-width: 640px) {
  .topbar, .profile { flex-direction: column; }
  .composer-grid, .feed-grid { grid-template-columns: 1fr; }
  .image-picker { min-height: 180px; }
  .section-title, .feed-heading { align-items: flex-start; flex-direction: column; }
}
</style>
