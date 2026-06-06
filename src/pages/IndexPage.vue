<template>
  <q-page class="page">
    <main class="content">
      <section class="hero card">
        <div>
          <p class="eyebrow">Happy-flow prototype</p>
          <h1>Post visual notes to a simulated Nostr feed.</h1>
          <p class="muted">
            No relay or Blossom upload yet. Identity, images and posts are stored locally in this
            browser for the demo.
          </p>
        </div>

        <div v-if="identity" class="identity-pill">
          <q-avatar size="38px" color="deep-purple-5" text-color="white">
            {{ identity.name.slice(0, 1) }}
          </q-avatar>
          <div>
            <div class="identity-name">{{ identity.name }}</div>
            <div class="identity-key">{{ shortKey(identity.pubkey) }}</div>
          </div>
        </div>

        <div v-else class="identity-actions">
          <q-btn
            v-if="hasNip07"
            unelevated
            color="deep-purple-6"
            label="Login with NIP-07"
            @click="loginWithNip07"
          />
          <q-btn
            outline
            color="deep-purple-6"
            label="Generate demo identity"
            @click="generateIdentity"
          />
          <p class="tiny-note">NIP-07 appears only when a browser extension exposes window.nostr.</p>
        </div>
      </section>

      <q-banner v-if="message" rounded class="message" dense>
        {{ message }}
      </q-banner>

      <section class="composer card">
        <div class="section-title">
          <span>Create post</span>
          <q-badge color="amber-7" text-color="brown-10">simulated publish</q-badge>
        </div>

        <label class="image-picker" :class="{ 'has-preview': imagePreview }">
          <input ref="imageInput" type="file" accept="image/*" @change="selectImage" />
          <img v-if="imagePreview" :src="imagePreview" alt="Selected visual preview" />
          <div v-else class="picker-empty">
            <q-icon name="add_photo_alternate" size="42px" />
            <strong>Choose an image</strong>
            <span>Stored as a browser-local data URL for now.</span>
          </div>
        </label>

        <q-input
          v-model="caption"
          type="textarea"
          autogrow
          outlined
          placeholder="Write a caption..."
          class="caption-input"
        />

        <q-btn
          unelevated
          color="deep-purple-6"
          size="lg"
          class="full-width post-btn"
          :disable="!canPost"
          label="Post to local feed"
          @click="publishPost"
        />
      </section>

      <section class="feed">
        <div class="feed-heading">
          <h2>Feed</h2>
          <span>{{ posts.length }} local post{{ posts.length === 1 ? '' : 's' }}</span>
        </div>

        <article v-for="post in posts" :key="post.id" class="post card">
          <div class="post-author">
            <q-avatar size="36px" color="deep-purple-5" text-color="white">
              {{ post.author.name.slice(0, 1) }}
            </q-avatar>
            <div>
              <strong>{{ post.author.name }}</strong>
              <div>{{ formatDate(post.createdAt) }} · local Nostr event mock</div>
            </div>
          </div>
          <img :src="post.image" :alt="post.caption || 'Local demo post image'" class="post-image" />
          <p v-if="post.caption" class="post-caption">{{ post.caption }}</p>
        </article>

        <div v-if="posts.length === 0" class="empty card">
          <q-icon name="auto_awesome" size="32px" />
          <p>Your first local visual note will appear here immediately after posting.</p>
        </div>
      </section>
    </main>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'

const identity = ref(null)
const posts = ref([])
const caption = ref('')
const imagePreview = ref('')
const imageInput = ref(null)
const hasNip07 = ref(false)
const message = ref('')

const identityKey = 'nostr-visual-demo-identity'
const postsKey = 'nostr-visual-demo-posts'

const canPost = computed(() => Boolean(identity.value && imagePreview.value))

onMounted(() => {
  hasNip07.value = typeof window !== 'undefined' && Boolean(window.nostr)
  identity.value = readJson(identityKey, null)
  posts.value = readJson(postsKey, [])
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
}

async function loginWithNip07() {
  message.value = ''
  if (!window.nostr) {
    message.value = 'NIP-07 extension unavailable.'
    return
  }

  let pubkey
  try {
    pubkey = await window.nostr.getPublicKey()
  } catch {
    message.value = 'Could not sign in with NIP-07.'
    return
  }

  try {
    saveIdentity({
      name: 'NIP-07 user',
      pubkey,
      source: 'nip07',
    })
  } catch {
    message.value = 'Could not save identity locally.'
  }
}

function generateIdentity() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const pubkey = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')

  try {
    saveIdentity({
      name: `Demo ${pubkey.slice(0, 4)}`,
      pubkey,
      source: 'generated-demo',
    })
  } catch {
    message.value = 'Could not save identity locally.'
  }
}

function selectImage(event) {
  message.value = ''
  const file = event.target.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = () => {
    imagePreview.value = reader.result
  }
  reader.readAsDataURL(file)
}

function publishPost() {
  if (!canPost.value) return

  const nextPost = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    author: identity.value,
    caption: caption.value.trim(),
    image: imagePreview.value,
    createdAt: new Date().toISOString(),
  }

  const nextPosts = [nextPost, ...posts.value]

  try {
    localStorage.setItem(postsKey, JSON.stringify(nextPosts))
  } catch {
    message.value = 'Could not save post locally.'
    return
  }

  posts.value = nextPosts
  caption.value = ''
  imagePreview.value = ''
  if (imageInput.value) imageInput.value.value = ''
}

function shortKey(pubkey) {
  return `${pubkey.slice(0, 8)}…${pubkey.slice(-6)}`
}

function formatDate(date) {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date))
}
</script>

<style scoped>
.page {
  min-height: 100vh;
}

.content {
  width: min(100%, 760px);
  margin: 0 auto;
  padding: 18px 14px 36px;
}

.card {
  border: 1px solid rgba(75, 48, 86, 0.12);
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 18px 50px rgba(72, 45, 86, 0.09);
}

.hero,
.composer,
.empty {
  padding: 22px;
}

.hero {
  display: grid;
  gap: 20px;
  margin-bottom: 16px;
  background:
    radial-gradient(circle at top left, rgba(127, 68, 255, 0.16), transparent 34%),
    rgba(255, 255, 255, 0.9);
}

.eyebrow,
.tiny-note {
  color: #8053be;
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

h1,
h2,
p {
  margin: 0;
}

h1 {
  max-width: 11em;
  font-size: clamp(2.1rem, 9vw, 4.2rem);
  line-height: 0.9;
  letter-spacing: -0.08em;
}

.muted {
  max-width: 36rem;
  margin-top: 14px;
  color: #716672;
  line-height: 1.55;
}

.identity-actions {
  display: grid;
  gap: 10px;
}

.identity-pill,
.post-author,
.section-title,
.feed-heading {
  display: flex;
  align-items: center;
}

.identity-pill {
  gap: 11px;
  width: fit-content;
  padding: 10px 14px 10px 10px;
  border-radius: 999px;
  background: #f1e9ff;
}

.identity-name {
  font-weight: 800;
}

.identity-key,
.post-author div div,
.feed-heading span {
  color: #807481;
  font-size: 0.82rem;
}

.composer {
  display: grid;
  gap: 14px;
}

.message {
  margin-bottom: 16px;
  background: #fff3e0;
  color: #7a4d00;
}

.section-title,
.feed-heading {
  justify-content: space-between;
  gap: 12px;
}

.section-title span,
h2 {
  font-size: 1.2rem;
  font-weight: 850;
  letter-spacing: -0.04em;
}

.image-picker {
  display: grid;
  min-height: 300px;
  overflow: hidden;
  place-items: center;
  border: 2px dashed rgba(127, 68, 255, 0.26);
  border-radius: 24px;
  background: #fbf8ff;
  color: #7b62a5;
  cursor: pointer;
}

.image-picker input {
  display: none;
}

.image-picker img,
.post-image {
  display: block;
  width: 100%;
  object-fit: cover;
}

.image-picker img {
  max-height: 560px;
}

.picker-empty {
  display: grid;
  gap: 6px;
  place-items: center;
  padding: 24px;
  text-align: center;
}

.picker-empty span {
  color: #8c8190;
  font-size: 0.9rem;
}

.post-btn {
  border-radius: 16px;
  font-weight: 800;
}

.feed {
  display: grid;
  gap: 14px;
  margin-top: 22px;
}

.post {
  overflow: hidden;
}

.post-author {
  gap: 10px;
  padding: 14px;
}

.post-image {
  max-height: 720px;
}

.post-caption {
  padding: 14px 16px 18px;
  line-height: 1.5;
  white-space: pre-wrap;
}

.empty {
  display: grid;
  gap: 8px;
  place-items: center;
  color: #7e7280;
  text-align: center;
}

@media (min-width: 720px) {
  .content {
    padding-top: 28px;
  }

  .hero {
    grid-template-columns: 1fr auto;
    align-items: end;
  }
}
</style>
