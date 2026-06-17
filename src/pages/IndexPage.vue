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

          <visual-feed
            v-model:two-column-feed="twoColumnFeed"
            :posts="combinedFeed"
            :refreshing="refreshing"
            :has-more="hasMoreRelayPosts"
            :pending-count="pendingRelayEvents.length"
            :format-date="formatDate"
            :interaction-for-post="session.interactionForPost"
            :reply-author="session.replyAuthor"
            @like-post="session.likePost"
            @comment-post="session.commentOnPost"
            @load-more="loadMoreFeed"
            @refresh="session.refreshFromNostr"
            @show-pending="session.mergePendingRelayPosts"
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

      <q-page-sticky position="bottom-right" :offset="[18, 18]">
        <q-btn fab-mini color="dark" icon="keyboard_arrow_up" aria-label="Back to top" @click="scrollToTop" />
      </q-page-sticky>
    </div>
  </q-page>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import AppTopBar from 'components/AppTopBar.vue'
import InsightsPanel from 'components/InsightsPanel.vue'
import ProfilePanel from 'components/ProfilePanel.vue'
//import StoriesStrip from 'components/StoriesStrip.vue'
import VisualFeed from 'components/VisualFeed.vue'
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
  pendingRelayEvents,
  combinedFeed,
  suggestedProfiles,
} = storeToRefs(session)

const twoColumnFeed = ref(false)

onMounted(() => {
  session.init()
})

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function loadMoreFeed(done) {
  try {
    await session.loadMoreVisualPosts()
  } finally {
    done?.()
  }
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
