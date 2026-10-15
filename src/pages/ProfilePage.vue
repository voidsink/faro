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
              <p class="q-ma-none faro-muted">
                {{ profile.nip05 || shortKey(pubkey) || 'Sign in to view your profile' }}
              </p>
              <p v-if="profile.about" class="bio q-mt-sm q-mb-none faro-muted">
                {{ profile.about }}
              </p>
              <div v-if="profileLinks.length" class="row q-gutter-xs q-mt-sm">
                <q-chip
                  class="faro-muted profile-chip"
                  v-for="item in profileLinks"
                  :key="item.label"
                  dense
                  outline
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
              unelevated
              color="primary"
              no-caps
              label="Edit profile"
              @click="openProfileEditor"
            />
            <q-btn
              v-if="isOwnProfile"
              outline
              color="accent"
              no-caps
              icon="logout"
              label="Logout"
              @click="logout"
            />
            <q-btn
              v-if="isOwnProfile"
              flat
              no-caps
              icon="settings"
              label="Settings"
              to="/settings"
            />
            <q-btn
              v-else-if="!identity"
              unelevated
              color="primary"
              no-caps
              label="Sign in"
              to="/?signin=1"
            />
            <q-btn
              v-else
              unelevated
              no-caps
              :label="isFollowing ? 'Unfollow' : 'Follow on Nostr'"
              :color="isFollowing ? 'accent' : 'primary'"
              :outline="isFollowing"
              :loading="session.publishingFollow"
              :disable="!identity || !pubkey"
              @click="session.setFollowing(pubkey, !isFollowing)"
            />
          </div>
        </div>
      </q-card>

      <q-dialog v-model="editingProfile" :persistent="session.savingProfile">
        <q-card class="faro-surface q-pa-lg" style="width: min(92vw, 520px)">
          <q-form class="column q-gutter-md" @submit="saveProfile">
            <h2 class="text-h6 q-ma-none">Edit your public profile</h2>
            <q-input
              class="faro-input"
              color="accent"
              v-model="profileDraft.display_name"
              outlined
              label="Display name"
              maxlength="80"
            />
            <q-input
              class="faro-input"
              color="accent"
              v-model="profileDraft.about"
              outlined
              type="textarea"
              autogrow
              label="About you"
              maxlength="1000"
            />
            <q-input
              class="faro-input"
              color="accent"
              v-model="profileDraft.picture"
              outlined
              type="url"
              label="Avatar image URL"
            />
            <q-input
              class="faro-input"
              color="accent"
              v-model="profileDraft.banner"
              outlined
              type="url"
              label="Cover image URL"
            />
            <p class="text-caption faro-muted q-ma-none">
              These details are public and shared with other Nostr apps.
            </p>
            <div class="row justify-end q-gutter-sm">
              <q-btn flat no-caps label="Cancel" :disable="session.savingProfile" v-close-popup />
              <q-btn
                unelevated
                no-caps
                color="primary"
                label="Save profile"
                type="submit"
                :loading="session.savingProfile"
              />
            </div>
          </q-form>
        </q-card>
      </q-dialog>

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
          @click="$router.push(`/post/${post.id}`)"
        >
          <q-img
            v-if="post.image && !post.contentWarning"
            :src="post.image"
            :alt="post.caption || 'Posted photo'"
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
          <div v-else class="column flex-center full-height q-pa-md">
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

      <p v-if="profileError && posts.length" class="text-caption faro-danger q-mt-sm q-mb-none">
        {{ profileError }}
      </p>

      <q-card
        v-if="!posts.length"
        flat
        bordered
        class="faro-surface column flex-center faro-muted q-gutter-sm q-pa-xl q-mt-md"
      >
        <q-icon name="photo_camera" size="36px" />
        <p class="q-ma-none">
          {{
            profileLoading ? 'Fetching profile photos from Nostr…' : 'No posted photos found yet.'
          }}
        </p>
        <p v-if="profileError" class="q-ma-none text-caption faro-danger">{{ profileError }}</p>
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

const isFollowing = computed(() => session.following.includes(pubkey.value))
const profileLoading = ref(false)
const profileError = ref('')
const profileRelayPosts = ref([])
const editingProfile = ref(false)
const profileDraft = ref({})
let profileRequest = 0
const profileReference = computed(() => {
  const param = route.params.pubkey
  if (!param) return { pubkey: identity.value?.pubkey || '', relays: [] }

  try {
    const { type, data } = decode(param)
    if (type === 'npub') return { pubkey: data, relays: [] }
    if (type === 'nprofile') return { pubkey: data.pubkey || '', relays: data.relays || [] }
  } catch {
    // Plain hex pubkeys are not NIP-19 encoded.
  }

  return { pubkey: /^[0-9a-f]{64}$/i.test(param) ? param : '', relays: [] }
})
const pubkey = computed(() => profileReference.value.pubkey)
const profileRelays = computed(() => profileReference.value.relays)
const profile = computed(() => {
  const cached = normalizeProfile(authorProfiles.value[pubkey.value])
  if (pubkey.value && pubkey.value === identity.value?.pubkey) {
    return normalizeProfile(relayProfile.value)
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

function openProfileEditor() {
  profileDraft.value = Object.fromEntries(
    ['display_name', 'about', 'picture', 'banner'].map((key) => [key, profile.value[key] || '']),
  )
  editingProfile.value = true
}

async function saveProfile() {
  if (await session.updateProfile(profileDraft.value)) editingProfile.value = false
}

onMounted(async () => {
  session.init()
  await fetchProfileContent(pubkey.value)
})

watch(pubkey, async (next) => {
  await fetchProfileContent(next)
})

async function fetchProfileContent(nextPubkey) {
  const current = ++profileRequest
  profileRelayPosts.value = []
  profileError.value = ''
  if (!nextPubkey) {
    profileLoading.value = false
    return
  }

  profileLoading.value = true
  profileError.value = ''
  try {
    await session.fetchProfileByPubkey(nextPubkey)
    if (current !== profileRequest) return
    const visualResult = await fetchVisualFeed([nextPubkey], {
      limit: 60,
      timeoutMs: 7500,
      anonymous: !session.identity?.pubkey,
      temporaryRelays: profileRelays.value,
    })

    if (current !== profileRequest) return

    if (!visualResult.ok) {
      profileRelayPosts.value = []
      profileError.value = visualResult.error || 'Could not fetch profile posts from relays.'
      return
    }

    await session.hydrateAuthorProfiles([nextPubkey])
    if (current !== profileRequest) return
    profileRelayPosts.value = session.postsFromVisualEvents(visualResult.events)
  } catch (error) {
    if (current !== profileRequest) return
    profileRelayPosts.value = []
    profileError.value = error?.message || 'Could not fetch profile posts from relays.'
  } finally {
    if (current === profileRequest) profileLoading.value = false
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
  overflow-wrap: anywhere;
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
  aspect-ratio: 1;
  position: relative;
  display: block;
  padding: 0;
  overflow: hidden;
  background: var(--faro-surface-bg);
  border: 1px solid var(--faro-surface-border);
  border-radius: var(--faro-radius-md);
  cursor: pointer;
}

.tile-video {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
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
  color: var(--faro-media-badge-ink);
  font-size: 0.75rem;
  font-weight: 800;
  background: var(--faro-media-badge-bg);
  border-radius: var(--faro-radius-sm);
}

@media (max-width: 700px) {
  .photo-grid {
    gap: 4px;
  }

  .photo-tile {
    border-radius: var(--faro-radius-sm);
  }
}
</style>
