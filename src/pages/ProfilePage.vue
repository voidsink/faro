<template>
  <q-page class="faro-page">
    <div class="faro-page-inner">
      <q-card flat bordered class="faro-surface profile-card overflow-hidden">
        <div
          v-if="profile.banner"
          class="profile-banner"
          :style="{ backgroundImage: `url(${profile.banner})` }"
        />
        <div class="row items-start justify-between q-gutter-md">
          <div class="row items-center q-gutter-md">
            <user-avatar
              size="82px"
              :name="displayName"
              :pubkey="pubkey"
              :picture="profile.picture"
            />
            <div>
              <h1 class="q-ma-none">{{ displayName }}</h1>
              <p class="q-ma-none text-blue-grey-6">
                {{ profile.nip05 || shortKey(pubkey) || 'Sign in to view your profile' }}
              </p>
              <p v-if="profile.about" class="bio q-mt-sm q-mb-none text-blue-grey-6">
                {{ profile.about }}
              </p>
              <div v-if="profileLinks.length" class="row q-gutter-xs q-mt-sm">
                <q-chip
                  v-for="item in profileLinks"
                  :key="item.label"
                  dense
                  outline
                  color="blue-grey-6"
                  class="profile-chip"
                  :icon="item.icon"
                  :label="item.label"
                />
              </div>
            </div>
          </div>
          <div class="row q-gutter-sm">
            <q-btn flat round icon="home" aria-label="Home" to="/" />
            <q-btn
              v-if="isOwnProfile"
              outline
              color="dark"
              no-caps
              icon="logout"
              label="Logout"
              @click="logout"
            />
            <q-btn v-else-if="!pubkey" unelevated color="dark" no-caps label="Sign in" to="/" />
            <q-btn
              v-else
              unelevated
              color="dark"
              no-caps
              :label="following ? 'Following' : 'Follow'"
              @click="following = !following"
            />
          </div>
        </div>
      </q-card>

      <div class="row items-center justify-between q-mt-lg q-mb-sm">
        <h2 class="section-heading q-ma-none">Posts</h2>
        <q-spinner-dots v-if="profileLoading" color="primary" size="28px" />
      </div>

      <div v-if="posts.length" class="photo-grid">
        <button
          v-for="post in posts"
          :key="post.id"
          type="button"
          class="photo-tile"
          :aria-label="post.caption || 'Profile post image'"
        >
          <q-img :src="post.image" :alt="post.caption || 'Posted photo'" fit="cover" ratio="1" />
          <div v-if="post.images?.length > 1" class="multi-badge row items-center q-gutter-xs">
            <q-icon name="collections" size="16px" />
            <span>{{ post.images.length }}</span>
          </div>
        </button>
      </div>

      <p v-if="profileError && posts.length" class="text-caption text-negative q-mt-sm q-mb-none">
        {{ profileError }}
      </p>

      <q-card
        v-else
        flat
        bordered
        class="faro-surface column flex-center text-blue-grey-6 q-gutter-sm q-pa-xl q-mt-md"
      >
        <q-icon name="photo_camera" size="36px" />
        <p class="q-ma-none">
          {{
            profileLoading ? 'Fetching profile photos from Nostr…' : 'No posted photos found yet.'
          }}
        </p>
        <p v-if="profileError" class="q-ma-none text-caption text-negative">{{ profileError }}</p>
      </q-card>
    </div>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { decode } from 'nostr-tools/nip19'
import { storeToRefs } from 'pinia'
import UserAvatar from 'components/UserAvatar.vue'
import { useSessionStore } from 'src/stores/session-store'
import { fetchVisualFeed } from 'src/services/nostrRelay'

const session = useSessionStore()
const { identity, localPosts, relayProfile, authorProfiles } = storeToRefs(session)
const route = useRoute()

const following = ref(false)
const profileLoading = ref(false)
const profileError = ref('')
const profileRelayPosts = ref([])
const pubkey = computed(() => {
  const param = route.params.pubkey
  if (!param) return identity.value?.pubkey || ''
  if (param.startsWith('npub')) {
    try {
      const { data } = decode(param)
      return data
    } catch {
      return ''
    }
  }
  return param
})
const profile = computed(() => {
  const cached = normalizeProfile(authorProfiles.value[pubkey.value])
  if (pubkey.value && pubkey.value === identity.value?.pubkey) {
    return { ...normalizeProfile(relayProfile.value), ...cached, ...identity.value }
  }
  return cached
})
const displayName = computed(() => {
  if (!pubkey.value) return 'Not logged in'
  const name = profile.value.display_name || profile.value.name
  if (name) return name
  return session.shortKey(pubkey.value) || 'Faro user'
})
const isOwnProfile = computed(() =>
  Boolean(pubkey.value && pubkey.value === identity.value?.pubkey),
)
const localProfilePosts = computed(() =>
  pubkey.value === identity.value?.pubkey
    ? localPosts.value.filter((post) => post.author?.pubkey === pubkey.value)
    : [],
)
const posts = computed(() =>
  session.dedupePostsById([...localProfilePosts.value, ...profileRelayPosts.value]),
)
const profileLinks = computed(() => {
  const items = []
  if (profile.value.location) items.push({ icon: 'place', label: profile.value.location })
  if (profile.value.website) items.push({ icon: 'link', label: profile.value.website })
  if (profile.value.lud16 || profile.value.lud06) {
    items.push({ icon: 'bolt', label: profile.value.lud16 || 'Lightning address' })
  }
  return items.slice(0, 3)
})

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

onMounted(async () => {
  session.init()
  await fetchProfileContent(pubkey.value)
})

watch(pubkey, async (next) => {
  await fetchProfileContent(next)
})

async function fetchProfileContent(nextPubkey) {
  if (!nextPubkey) return

  profileLoading.value = true
  profileError.value = ''
  try {
    await session.fetchProfileByPubkey(nextPubkey)
    const visualResult = await fetchVisualFeed([nextPubkey], {
      limit: 60,
      timeoutMs: 7500,
      anonymous: !session.identity?.pubkey,
    })

    if (!visualResult.ok) {
      profileRelayPosts.value = []
      profileError.value = visualResult.error || 'Could not fetch profile posts from relays.'
      return
    }

    await session.hydrateAuthorProfiles([nextPubkey])
    profileRelayPosts.value = session.postsFromVisualEvents(visualResult.events)
  } catch (error) {
    profileRelayPosts.value = []
    profileError.value = error?.message || 'Could not fetch profile posts from relays.'
  } finally {
    profileLoading.value = false
  }
}

function shortKey(pubkey = '') {
  return session.shortKey(pubkey)
}

function logout() {
  session.logout()
}
</script>

<style scoped>
h1 {
  font-size: 1.7rem;
  font-weight: 900;
}

.profile-card {
  padding: 24px;
}

.profile-banner {
  height: 150px;
  margin: -24px -24px 18px;
  background-position: center;
  background-size: cover;
}

.section-heading {
  font-size: 1rem;
  font-weight: 900;
}

.bio {
  max-width: 520px;
  line-height: 1.45;
}

.profile-chip {
  max-width: 220px;
}

.profile-chip :deep(.q-chip__content) {
  min-width: 0;
}

.profile-chip :deep(.q-chip__label) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.photo-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.photo-tile {
  position: relative;
  display: block;
  padding: 0;
  overflow: hidden;
  background: white;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 18px;
  cursor: pointer;
}

.photo-tile:focus-visible {
  outline: 2px solid var(--q-primary);
  outline-offset: 2px;
}

.multi-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 3px 7px;
  color: white;
  font-size: 0.75rem;
  font-weight: 800;
  background: rgba(15, 23, 42, 0.58);
  border-radius: 999px;
}

@media (max-width: 700px) {
  .photo-grid {
    gap: 4px;
  }

  .photo-tile {
    border-radius: 10px;
  }
}
</style>
