<template>
  <q-page class="faro-page">
    <div class="faro-page-inner">
      <q-card flat bordered class="faro-surface tag-card overflow-hidden">
        <div class="row items-start justify-between q-gutter-md">
          <div>
            <p class="q-ma-none text-blue-grey-6 text-weight-bold text-uppercase">Hashtag</p>
            <h1 class="q-ma-none">#{{ tag }}</h1>
            <p class="q-mt-sm q-mb-none text-blue-grey-6">
              Visual Nostr posts tagged with <span class="text-weight-medium">#{{ tag }}</span
              >.
            </p>
          </div>
          <div class="row q-gutter-sm">
            <q-btn flat round icon="home" aria-label="Home" to="/" />
            <q-btn
              unelevated
              color="dark"
              no-caps
              :outline="isFollowing"
              :disable="!identity || !tag"
              :label="followLabel"
              @click="toggleFollow"
            >
              <q-tooltip v-if="!identity">Sign in to follow hashtags</q-tooltip>
            </q-btn>
          </div>
        </div>
      </q-card>

      <div class="row items-center justify-between q-mt-lg q-mb-sm">
        <h2 class="section-heading q-ma-none">Posts</h2>
        <q-spinner-dots v-if="loading" color="primary" size="28px" />
      </div>

      <div v-if="posts.length" class="photo-grid">
        <button
          v-for="post in posts"
          :key="post.id"
          type="button"
          class="photo-tile"
          :aria-label="post.caption || `#${tag} post`"
          @click="$router.push(`/post/${post.id}`)"
        >
          <q-img
            v-if="post.image && !post.contentWarning"
            :src="post.image"
            :alt="post.caption || `#${tag} photo`"
            fit="cover"
            ratio="1"
          />
          <video
            v-else-if="post.video && !post.contentWarning"
            :src="post.video"
            muted
            playsinline
            preload="metadata"
            class="tile-video"
          />
          <div v-else class="column flex-center full-height q-pa-sm">
            <q-icon name="visibility_off" size="28px" /><span class="text-caption"
              >Sensitive content</span
            >
          </div>
          <div v-if="post.images?.length > 1" class="multi-badge row items-center q-gutter-xs">
            <q-icon name="collections" size="16px" />
            <span>{{ post.images.length }}</span>
          </div>
        </button>
      </div>

      <p v-if="error && posts.length" class="text-caption text-negative q-mt-sm q-mb-none">
        {{ error }}
      </p>

      <q-card
        v-if="!posts.length"
        flat
        bordered
        class="faro-surface column flex-center text-blue-grey-6 q-gutter-sm q-pa-xl q-mt-md"
      >
        <q-icon name="tag" size="36px" />
        <p class="q-ma-none">
          {{
            loading ? `Fetching #${tag} posts from Nostr…` : `No visual #${tag} posts found yet.`
          }}
        </p>
        <p v-if="error" class="q-ma-none text-caption text-negative">{{ error }}</p>
      </q-card>
    </div>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useSessionStore } from 'src/stores/session-store'
import { fetchVisualFeed, normalizeHashtags } from 'src/services/nostrRelay'

const session = useSessionStore()
const route = useRoute()
const { identity, followedHashtags } = storeToRefs(session)

const loading = ref(false)
const error = ref('')
const posts = ref([])
let tagRequest = 0

const tag = computed(() => normalizeHashtags([route.params.tag || ''])[0] || '')
const isFollowing = computed(() => followedHashtags.value.includes(tag.value))
const followLabel = computed(() => {
  if (!identity.value) return 'Sign in to follow'
  return isFollowing.value ? `Following #${tag.value}` : `Follow #${tag.value}`
})

onMounted(async () => {
  session.init()
  await fetchTagPosts()
})

watch(tag, async () => {
  await fetchTagPosts()
})

async function fetchTagPosts() {
  const current = ++tagRequest
  posts.value = []
  if (!tag.value) {
    loading.value = false
    return
  }

  loading.value = true
  error.value = ''
  try {
    const visualResult = await fetchVisualFeed([], {
      tags: [tag.value],
      limit: 60,
      timeoutMs: 7500,
      anonymous: !identity.value?.pubkey,
    })

    if (current !== tagRequest) return

    if (!visualResult.ok) {
      posts.value = []
      error.value = visualResult.error || `Could not fetch #${tag.value} posts from relays.`
      return
    }

    const pubkeys = [...new Set(visualResult.events.map((event) => event.pubkey).filter(Boolean))]
    await session.hydrateAuthorProfiles(pubkeys)
    if (current !== tagRequest) return
    posts.value = session.postsFromVisualEvents(visualResult.events)
  } catch (fetchError) {
    if (current !== tagRequest) return
    posts.value = []
    error.value = fetchError?.message || `Could not fetch #${tag.value} posts from relays.`
  } finally {
    if (current === tagRequest) loading.value = false
  }
}

function toggleFollow() {
  if (!identity.value || !tag.value) return
  const nextTags = isFollowing.value
    ? followedHashtags.value.filter((item) => item !== tag.value)
    : [...followedHashtags.value, tag.value]
  session.updateFollowedHashtags(nextTags)
  session.refreshFromNostr({ silent: true })
}
</script>

<style scoped>
h1 {
  font-size: 1.9rem;
  font-weight: 900;
}

.tag-card {
  padding: 24px;
}

.section-heading {
  font-size: 1.2rem;
  font-weight: 900;
}

.photo-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.photo-tile {
  position: relative;
  aspect-ratio: 1;
  padding: 0;
  border: 0;
  border-radius: 14px;
  overflow: hidden;
  background: #eef2f5;
  cursor: pointer;
}

.photo-tile :deep(.q-img),
.tile-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.multi-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 3px 7px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.62);
  color: white;
  font-size: 0.75rem;
}

@media (max-width: 640px) {
  .photo-grid {
    gap: 3px;
  }

  .tag-card {
    padding: 18px;
  }
}
</style>
