<template>
  <q-page class="faro-page">
    <div class="faro-page-inner">
      <app-top-bar
        v-if="identity || !anonymousNoticeOpen"
        :identity="identity"
        :active-profile="activeProfile"
        :display-name="displayName"
        :refreshing="refreshing"
        class="q-mb-md"
        @refresh="refreshFeed"
        @open-login="loginDialogOpen = true"
        @logout="logout"
      />

      <login-dialog
        v-model="loginDialogOpen"
        :has-nip07="hasNip07"
        :bunker-loading="session.bunkerLoading"
        @login-google="session.loginWithGoogle"
        @login-nip07="loginWithNip07"
        @login-bunker="session.loginWithBunker"
        @create-key="createLocalKey"
        @import-nsec="importNsec"
      />

      <anonymous-feed-dialog
        v-if="!identity"
        v-model="anonymousNoticeOpen"
        @follow-people="followPeopleInstead"
        @show-feed="showAnonymousFeed"
      />

      <div class="row items-start justify-center q-col-gutter-md">
        <section class="col-12 col-md column q-gutter-y-md overflow-hidden">
          <visual-feed
            v-if="identity || anonymousFeedAllowed"
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
            @zap-post="session.zapPost"
            @load-more="loadMoreFeed"
            @refresh="refreshFeed"
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
            :following-count="following.length"
            :posts-count="localPosts.length + relayPosts.length"
            :relays-count="3"
            :hashtags-count="followedHashtags.length"
            @open-login="loginDialogOpen = true"
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

      <!-- Desktop only, and only once there is actually something to scroll back from. -->
      <q-page-sticky v-if="showScrollTop" class="gt-sm" position="bottom-right" :offset="[18, 18]">
        <q-btn
          fab-mini
          color="dark"
          icon="keyboard_arrow_up"
          aria-label="Back to top"
          @click="scrollToTop"
        />
      </q-page-sticky>
    </div>
  </q-page>
</template>

<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import AppTopBar from 'components/AppTopBar.vue'
import AnonymousFeedDialog from 'components/AnonymousFeedDialog.vue'
import LoginDialog from 'components/auth/LoginDialog.vue'
import InsightsPanel from 'components/InsightsPanel.vue'
import ProfilePanel from 'components/ProfilePanel.vue'
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
  refreshing,
  hasMoreRelayPosts,
  following,
  followedHashtags,
  localPosts,
  relayPosts,
  pendingRelayEvents,
  combinedFeed,
  suggestedProfiles,
} = storeToRefs(session)

const twoColumnFeed = ref(false)
const loginDialogOpen = ref(false)
const anonymousNoticeOpen = ref(true)
const anonymousFeedAllowed = ref(false)
const showScrollTop = ref(false)

onMounted(() => {
  session.init()
  window.addEventListener('scroll', trackScroll, { passive: true })
  trackScroll()
})

onUnmounted(() => {
  window.removeEventListener('scroll', trackScroll)
})

function trackScroll() {
  showScrollTop.value = window.scrollY > 480
}

watch(identity, (nextIdentity) => {
  if (nextIdentity?.pubkey) {
    loginDialogOpen.value = false
    anonymousNoticeOpen.value = false
    anonymousFeedAllowed.value = true
  } else {
    anonymousNoticeOpen.value = true
    anonymousFeedAllowed.value = false
  }
})

function showAnonymousFeed() {
  anonymousFeedAllowed.value = true
  anonymousNoticeOpen.value = false
}

function followPeopleInstead() {
  anonymousNoticeOpen.value = false
  loginDialogOpen.value = true
}

function logout() {
  session.logout()
}

async function loginWithNip07() {
  await session.loginWithNip07()
  if (identity.value) loginDialogOpen.value = false
}

function createLocalKey() {
  session.createLocalKey()
  loginDialogOpen.value = false
}

function importNsec(value) {
  session.importNsec(value)
  if (session.identity?.source === 'nsec') loginDialogOpen.value = false
}

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

async function refreshFeed(done) {
  try {
    await session.refreshFromNostr()
  } finally {
    done?.()
  }
}

// Instagram-shaped timestamps: "now", "12m", "3h", "5d", then a date. A visual feed does
// not need wall-clock times, and the old two-part format wrapped on narrow cards.
function formatDate(date) {
  const timestamp = new Date(date).getTime()
  if (!Number.isFinite(timestamp)) return ''

  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000))
  if (seconds < 45) return 'now'

  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h`

  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d`

  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(
    new Date(timestamp),
  )
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
</style>
