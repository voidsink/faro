<template>
  <q-page class="faro-page">
    <div class="faro-page-inner index-content">
      <app-top-bar
        :identity="identity"
        :active-profile="activeProfile"
        :display-name="displayName"
        :refreshing="refreshing"
        @refresh="session.refreshFromNostr"
      />

      <q-banner v-if="message" rounded class="faro-warning q-my-md" dense>{{ message }}</q-banner>

      <div class="row items-start justify-center q-col-gutter-md">
        <section class="col-12 col-md column q-gutter-y-md overflow-hidden">
          <!-- <stories-strip
            :identity="identity"
            :active-profile="activeProfile"
            :display-name="displayName"
            :profiles="storyProfiles"
          /> -->

          <post-composer
            v-model:caption="caption"
            v-model:selected-ratio="selectedRatio"
            :identity="identity"
            :active-profile="activeProfile"
            :display-name="displayName"
            :image-preview="imagePreview"
            :ratios="ratios"
            :can-post="canPost"
            :ratio-to-number="ratioToNumber"
            @select-image="selectImage"
            @publish-post="publishPost"
            @clear-post-cache="clearPostCache"
          />

          <visual-feed
            v-model:two-column-feed="twoColumnFeed"
            :posts="combinedFeed"
            :refreshing="refreshing"
            :has-more="hasMoreRelayPosts"
            :format-date="formatDate"
            @load-more="loadMoreFeed"
            @refresh="session.refreshFromNostr"
          />
        </section>

        <aside class="right-rail gt-sm col-auto column q-gutter-md">
          <profile-panel
            :identity="identity"
            :active-profile="activeProfile"
            :display-name="displayName"
            :profile-subtitle="profileSubtitle"
            :auth-label="authLabel"
            :has-nip07="hasNip07"
            @login-nip07="session.loginWithNip07"
            @generate-identity="session.generateIdentity"
            @logout="session.logout"
          />

          <insights-panel
            :following-count="following.length"
            :relay-posts-count="relayPosts.length"
            :local-posts-count="localPosts.length"
            :suggested-profiles="suggestedProfiles"
            :short-key="session.shortKey"
          />
        </aside>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import AppTopBar from 'components/AppTopBar.vue'
import InsightsPanel from 'components/InsightsPanel.vue'
import PostComposer from 'components/PostComposer.vue'
import ProfilePanel from 'components/ProfilePanel.vue'
//import StoriesStrip from 'components/StoriesStrip.vue'
import VisualFeed from 'components/VisualFeed.vue'
import { ASPECT_RATIOS, processImageFile } from 'src/services/localMedia'
import { useSessionStore } from 'src/stores/session-store'

const session = useSessionStore()
const {
  identity,
  activeProfile,
  displayName,
  profileSubtitle,
  authLabel,
  hasNip07,
  message,
  refreshing,
  hasMoreRelayPosts,
  following,
  localPosts,
  relayPosts,
  combinedFeed,
  suggestedProfiles,
} = storeToRefs(session)

const caption = ref('')
const imagePreview = ref('')
const selectedRatio = ref('1:1')
const twoColumnFeed = ref(false)

const ratios = Object.keys(ASPECT_RATIOS)

const canPost = computed(() => Boolean(identity.value && imagePreview.value))

onMounted(() => {
  session.init()
})

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
    session.addLocalPost(nextPost)
    caption.value = ''
    imagePreview.value = ''
    message.value = 'Posted locally.'
  } catch {
    message.value = 'Could not save locally. Try a smaller image or clear local posts.'
  }
}

function clearPostCache() {
  session.clearPostCache()
}

async function loadMoreFeed(done) {
  try {
    await session.loadMoreVisualPosts()
  } finally {
    done?.()
  }
}

function ratioToNumber(ratio) {
  const value = ASPECT_RATIOS[ratio] || ASPECT_RATIOS['1:1']
  return value.width / value.height
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
.right-rail {
  position: sticky;
  top: 16px;
  width: 320px;
}

@media (max-width: 1020px) {
  .right-rail {
    width: 280px;
  }
}

@media (max-width: 700px) {
  .index-content {
    padding: 10px 8px 34px;
  }
}
</style>
