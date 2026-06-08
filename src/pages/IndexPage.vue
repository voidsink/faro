<template>
  <q-page class="page">
    <main class="content">
      <section class="intro card">
        <div>
          <p class="eyebrow">Faro visual social demo</p>
          <h1>Local-first visual notes, shaped for Nostr.</h1>
          <p class="muted">
            This demo uses NIP-01 kind 0 profiles, NIP-02/kind 3 follows, and NIP-01 kind 1
            visual notes when relay data is available. Publishing stays local for now; a real app
            would upload media to Blossom and publish URLs/hashes instead of browser data.
          </p>
        </div>
        <div class="intro-actions">
          <q-btn flat round icon="refresh" :loading="refreshing" @click="refreshFromNostr">
            <q-tooltip>Fetch profile, following and visual feed from relays</q-tooltip>
          </q-btn>
          <q-btn v-if="identity" flat round icon="logout" @click="logout">
            <q-tooltip>Logout; local posts stay cached</q-tooltip>
          </q-btn>
        </div>
      </section>

      <q-banner v-if="message" rounded class="message" dense>{{ message }}</q-banner>

      <section v-if="identity" class="profile card">
        <q-avatar size="72px" class="profile-avatar" color="deep-orange-4" text-color="white">
          <img v-if="profile.picture" :src="profile.picture" alt="Profile avatar" />
          <span v-else>{{ displayName.slice(0, 1) }}</span>
        </q-avatar>
        <div class="profile-body">
          <div class="profile-row">
            <div>
              <h2>{{ displayName }}</h2>
              <p class="key">{{ shortKey(identity.pubkey) }}</p>
            </div>
            <q-badge class="source-badge" :label="identity.source || profile.source || 'local'" />
          </div>
          <p class="about">{{ profile.about || 'No relay profile yet. Demo identity is ready for local posting.' }}</p>
          <div class="stats">
            <span><strong>{{ following.length }}</strong> following</span>
            <span><strong>{{ relayPosts.length }}</strong> relay visuals</span>
            <span><strong>{{ posts.length }}</strong> local</span>
          </div>
        </div>
      </section>

      <section v-else class="login card">
        <h2>Start posting</h2>
        <p class="muted">Use a NIP-07 signer if available, or generate a disposable demo pubkey.</p>
        <div class="login-actions">
          <q-btn v-if="hasNip07" unelevated color="deep-purple-6" label="Login with NIP-07" @click="loginWithNip07" />
          <q-btn outline color="deep-purple-6" label="Generate demo identity" @click="generateIdentity" />
        </div>
      </section>

      <section class="composer card">
        <div class="section-title">
          <div>
            <span>Create visual note</span>
            <p>Mock publish · bounded local image cache</p>
          </div>
          <q-btn flat dense color="negative" icon="delete_sweep" label="Clear demo cache" @click="clearDemoCache" />
        </div>

        <div class="composer-grid">
          <label class="image-picker" :style="previewStyle" :class="{ 'has-preview': imagePreview }">
            <input ref="imageInput" type="file" accept="image/*" @change="selectImage" />
            <img v-if="imagePreview" :src="imagePreview" alt="Selected cropped preview" />
            <div v-else class="picker-empty">
              <q-icon name="add_photo_alternate" size="32px" />
              <strong>Add image</strong>
              <span>We crop/resize before storing locally.</span>
            </div>
          </label>

          <div class="composer-fields">
            <div class="ratio-row">
              <q-btn
                v-for="ratio in ratios"
                :key="ratio"
                rounded
                dense
                unelevated
                :class="{ active: selectedRatio === ratio }"
                :label="ratio"
                @click="setRatio(ratio)"
              />
            </div>
            <q-input v-model="caption" type="textarea" autogrow outlined placeholder="Caption for your visual note…" />
            <q-btn unelevated color="deep-purple-6" class="post-btn" :disable="!canPost" label="Post locally" @click="publishPost" />
          </div>
        </div>
      </section>

      <section class="feed">
        <div class="feed-heading">
          <h2>Visual feed</h2>
          <q-btn flat dense icon="refresh" label="Fetch Nostr" :loading="refreshing" @click="refreshFromNostr" />
        </div>

        <div class="feed-grid">
          <article v-for="post in combinedFeed" :key="post.id" class="post card">
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

        <div v-if="combinedFeed.length === 0" class="empty card">
          <q-icon name="auto_awesome" size="32px" />
          <p>Your first local visual note or fetched relay image will appear here.</p>
        </div>
      </section>
    </main>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  clearLocalPosts,
  loadLocalPosts,
  processImageFile,
  saveLocalPostsWithPruning,
} from 'src/services/localMedia'
import { fetchFollowing, fetchProfile, fetchVisualFeed } from 'src/services/nostrRelay'

const identity = ref(null)
const profile = ref({})
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

const ratios = ['1:1', '4:3', '16:9', '9:16']
const identityKey = 'nostr-visual-demo-identity'

const displayName = computed(() => profile.value.display_name || profile.value.name || identity.value?.name || 'Faro user')
const canPost = computed(() => Boolean(identity.value && imagePreview.value))
const previewStyle = computed(() => ({ aspectRatio: cssRatio(selectedRatio.value) }))
const combinedFeed = computed(() => [...posts.value, ...relayPosts.value].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))

onMounted(() => {
  hasNip07.value = typeof window !== 'undefined' && Boolean(window.nostr)
  identity.value = readJson(identityKey, null)
  profile.value = identity.value || {}
  posts.value = loadLocalPosts()
})

function readJson(key, fallback) {
  try {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : fallback
  } catch {
    return fallback
  }
}

function saveIdentity(nextIdentity) {
  message.value = ''
  localStorage.setItem(identityKey, JSON.stringify(nextIdentity))
  identity.value = nextIdentity
  profile.value = nextIdentity
}

async function loginWithNip07() {
  message.value = ''
  if (!window.nostr) {
    message.value = 'NIP-07 extension unavailable.'
    return
  }
  try {
    const pubkey = await window.nostr.getPublicKey()
    saveIdentity({ name: 'NIP-07 user', pubkey, source: 'nip07' })
    await refreshFromNostr()
  } catch {
    message.value = 'Could not sign in with NIP-07.'
  }
}

function generateIdentity() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const pubkey = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  saveIdentity({ name: `Demo ${pubkey.slice(0, 4)}`, pubkey, source: 'generated-demo' })
}

function logout() {
  localStorage.removeItem(identityKey)
  identity.value = null
  profile.value = {}
  following.value = []
  relayPosts.value = []
  message.value = 'Logged out. Local demo posts were kept.'
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
  if (!canPost.value) return
  const nextPost = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    author: { name: displayName.value, pubkey: identity.value.pubkey },
    caption: caption.value.trim(),
    image: imagePreview.value,
    ratio: selectedRatio.value,
    createdAt: new Date().toISOString(),
    source: 'local mock kind 1',
  }
  try {
    posts.value = saveLocalPostsWithPruning([nextPost, ...posts.value])
    caption.value = ''
    imagePreview.value = ''
    if (imageInput.value) imageInput.value.value = ''
    message.value = 'Posted locally. Real publishing will use Blossom media plus Nostr kind 1.'
  } catch {
    message.value = 'Could not save post locally. Try clearing demo cache.'
  }
}

function clearDemoCache() {
  clearLocalPosts()
  posts.value = []
  message.value = 'Local demo post cache cleared. Identity remains signed in.'
}

async function refreshFromNostr() {
  if (!identity.value?.pubkey) {
    message.value = 'Sign in before fetching relay data.'
    return
  }
  refreshing.value = true
  message.value = ''
  try {
    const [relayProfile, relayFollowing] = await Promise.all([fetchProfile(identity.value.pubkey), fetchFollowing(identity.value.pubkey)])
    if (relayProfile.ok) profile.value = { ...identity.value, ...relayProfile.profile, source: 'relay kind 0' }

    following.value = relayFollowing.ok ? relayFollowing.pubkeys : []
    const authors = [identity.value.pubkey, ...following.value].slice(0, 20)
    const visuals = await fetchVisualFeed(authors)
    const visualEvents = visuals.ok ? visuals.events : []
    relayPosts.value = visualEvents.flatMap((event) =>
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
    message.value = relayProfile.ok || relayPosts.value.length ? 'Relay refresh complete.' : 'No relay profile or visual posts found; local demo still works.'
  } catch {
    message.value = 'Relay fetch unavailable or timed out; local demo still works.'
  } finally {
    refreshing.value = false
  }
}

function shortKey(pubkey = '') {
  return pubkey.length > 14 ? `${pubkey.slice(0, 8)}…${pubkey.slice(-6)}` : pubkey
}

function cssRatio(ratio) {
  return ratio.replace(':', ' / ')
}

function formatDate(date) {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }).format(new Date(date))
}
</script>

<style scoped>
.page { min-height: 100vh; }
.content { width: min(100%, 920px); margin: 0 auto; padding: 16px 12px 40px; }
.card { border: 1px solid rgba(84, 49, 37, 0.1); border-radius: 26px; background: rgba(255, 253, 248, 0.9); box-shadow: 0 18px 45px rgba(104, 69, 48, 0.1); }
.intro, .profile, .login, .composer, .empty { padding: 18px; }
.intro { display: flex; justify-content: space-between; gap: 14px; background: radial-gradient(circle at top left, rgba(255, 137, 91, 0.22), transparent 36%), rgba(255, 253, 248, 0.94); }
.intro-actions { display: flex; align-items: flex-start; gap: 4px; }
.eyebrow { margin: 0 0 8px; color: #b6572d; font-size: 0.72rem; font-weight: 900; letter-spacing: 0.1em; text-transform: uppercase; }
h1, h2, p { margin: 0; }
h1 { max-width: 13em; font-size: clamp(1.8rem, 7vw, 3.5rem); line-height: 0.95; letter-spacing: -0.07em; }
h2 { font-size: 1.2rem; letter-spacing: -0.04em; }
.muted, .about, .section-title p, .key, .post-author div div { color: #7c6b62; line-height: 1.5; }
.message { margin: 12px 0; background: #fff2df; color: #754219; }
.profile { display: flex; gap: 16px; margin-top: 12px; }
.profile-avatar { flex: 0 0 auto; box-shadow: 0 10px 22px rgba(177, 87, 45, 0.24); }
.profile-body { min-width: 0; flex: 1; }
.profile-row, .section-title, .feed-heading, .post-author { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.source-badge { border-radius: 999px; background: #f5ddc6; color: #733e24; }
.about { margin-top: 8px; }
.stats { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.stats span { padding: 7px 10px; border-radius: 999px; background: #fff0e5; color: #6f4635; font-size: 0.82rem; }
.login { display: grid; gap: 12px; margin-top: 12px; }
.login-actions { display: flex; flex-wrap: wrap; gap: 10px; }
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
  .intro, .profile { flex-direction: column; }
  .composer-grid, .feed-grid { grid-template-columns: 1fr; }
  .image-picker { min-height: 180px; }
  .section-title, .feed-heading { align-items: flex-start; flex-direction: column; }
}
</style>
