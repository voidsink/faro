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

      <q-form class="q-mb-md" @submit="search">
        <q-input
          color="accent"
          v-model="searchTerm"
          outlined
          dense
          label="Find a person or topic"
          placeholder="npub1… or #photography"
          class="faro-input faro-surface feed-search"
        >
          <template #append>
            <q-btn flat round icon="search" type="submit" aria-label="Search people or hashtags" />
          </template>
        </q-input>
      </q-form>
      <div class="row items-center q-gutter-sm q-mb-lg">
        <span class="text-caption faro-muted">Explore topics</span>
        <q-btn
          v-for="tag in ['photography', 'nostr', 'art']"
          :key="tag"
          flat
          dense
          class="topic-chip"
          no-caps
          color="accent"
          :label="`#${tag}`"
          :to="`/tag/${tag}`"
        />
      </div>

      <q-banner v-if="!identity && !anonymousFeedAllowed" rounded class="faro-surface q-mb-md">
        Your photos. Your people. Your Nostr account.
        <template #action>
          <q-btn flat no-caps label="Sign in" @click="loginDialogOpen = true" />
          <q-btn flat no-caps label="Browse global feed" @click="anonymousNoticeOpen = true" />
        </template>
      </q-banner>

      <div class="row items-start justify-center q-col-gutter-md">
        <section class="col-12 col-md column q-gutter-y-md overflow-hidden">
          <visual-feed
            v-if="identity || anonymousFeedAllowed"
            v-model:two-column-feed="twoColumnFeed"
            :posts="combinedFeed"
            :refreshing="refreshing"
            :title="identity ? 'Following' : 'Global feed'"
            :error="session.feedError"
            :comment-on-post="session.commentOnPost"
            :has-more="hasMoreRelayPosts"
            :pending-count="pendingRelayEvents.length"
            :format-date="formatDate"
            :interaction-for-post="session.interactionForPost"
            :reply-author="session.replyAuthor"
            @like-post="session.likePost"
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
            :posts-count="session.userPosts.length"
            :relays-count="relayCount"
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
            :can-follow="Boolean(identity)"
            :publishing-follow="session.publishingFollow"
            @follow="(pubkey) => session.setFollowing(pubkey, true)"
          />
        </aside>
      </div>

      <!-- Desktop only, and only once there is actually something to scroll back from. -->
      <q-page-sticky v-if="showScrollTop" class="gt-sm" position="bottom-right" :offset="[18, 18]">
        <q-btn
          fab-mini
          color="primary"
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
import { useRoute, useRouter } from 'vue-router'
import { decode } from 'nostr-tools/nip19'
import AppTopBar from 'components/AppTopBar.vue'
import AnonymousFeedDialog from 'components/AnonymousFeedDialog.vue'
import LoginDialog from 'components/auth/LoginDialog.vue'
import InsightsPanel from 'components/InsightsPanel.vue'
import ProfilePanel from 'components/ProfilePanel.vue'
import VisualFeed from 'components/VisualFeed.vue'
import { useSessionStore } from 'src/stores/session-store'
import { loadRelays } from 'src/services/nostrRelay'
import { formatDate } from 'src/utils/date'
import { notifyError } from 'src/utils/notify'

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
  anonymousFeedAllowed,
} = storeToRefs(session)

const twoColumnFeed = ref(false)
const loginDialogOpen = ref(false)
const anonymousNoticeOpen = ref(!session.identity && !session.anonymousFeedAllowed)
const router = useRouter()
const route = useRoute()
const searchTerm = ref('')
const relayCount = loadRelays().length
const showScrollTop = ref(false)

onMounted(() => {
  session.init()
  if (route.query.signin && !session.identity) {
    anonymousNoticeOpen.value = false
    loginDialogOpen.value = true
  }
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
  session.refreshFromNostr({ silent: true })
}

function search() {
  const term = searchTerm.value.trim().replace(/^nostr:/, '')
  if (!term) return
  if (term.startsWith('#')) {
    router.push(`/tag/${encodeURIComponent(term.slice(1))}`)
    return
  }
  try {
    const { type } = decode(term)
    if (type !== 'npub' && type !== 'nprofile') throw new Error()
    router.push(`/profile/${term}`)
  } catch {
    if (/^[0-9a-f]{64}$/i.test(term)) router.push(`/profile/${term}`)
    else notifyError('Enter a Nostr public key (npub) or a topic beginning with #.')
  }
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
</script>

<style scoped>
.topic-chip {
  background: var(--faro-accent-soft);
}
.feed-search {
  box-shadow: none;
}

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
