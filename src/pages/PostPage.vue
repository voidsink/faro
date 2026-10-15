<template>
  <q-page class="faro-page">
    <div class="faro-page-inner post-content">
      <div class="row items-center justify-between q-mb-md">
        <h1 class="text-h6 q-ma-none">Post</h1>
        <q-btn flat round icon="person" aria-label="Your profile" to="/profile" />
      </div>
      <q-skeleton
        v-if="loading && !post"
        height="480px"
        class="faro-surface"
        aria-label="Loading post"
      />
      <feed-post-card
        v-if="post"
        :post="post"
        :format-date="formatDate"
        :interaction="session.interactionForPost(post)"
        :reply-author="session.replyAuthor"
        :comment-on-post="session.commentOnPost"
        @like-post="session.likePost(post)"
      />
      <q-banner v-if="error" rounded class="faro-warning q-mt-md" role="alert">
        {{ error }}
        <template #action
          ><q-btn flat no-caps label="Try again" :loading="loading" @click="loadPost"
        /></template>
      </q-banner>
    </div>
  </q-page>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import FeedPostCard from 'components/FeedPostCard.vue'
import { useSessionStore } from 'src/stores/session-store'
import { fetchVisualPost } from 'src/services/nostrRelay'
import { formatDate } from 'src/utils/date'

const route = useRoute()
const session = useSessionStore()
const post = ref(null)
const loading = ref(false)
const error = ref('')
let request = 0

async function loadPost() {
  const current = ++request
  const id = route.params.id
  session.init()
  post.value = session.combinedFeed.find((item) => item.id === id) || null
  error.value = ''
  if (post.value && !post.value.nostr) return
  loading.value = true
  try {
    const result = await fetchVisualPost(id, { anonymous: !session.identity })
    if (current !== request) return
    if (!result.ok) {
      error.value = result.error
      return
    }
    await session.hydrateAuthorProfiles([result.event.pubkey], { anonymous: !session.identity })
    if (current !== request) return
    post.value = session.postsFromVisualEvents([result.event])[0]
    await session.refreshInteractionsForPosts([post.value])
  } finally {
    if (current === request) loading.value = false
  }
}
watch(() => route.params.id, loadPost, { immediate: true })
</script>

<style scoped>
.post-content {
  --faro-page-max: 680px;
}
</style>
