<template>
  <section class="column q-gutter-y-sm full-width">
    <div class="row items-center justify-between q-col-gutter-sm">
      <h2 class="section-heading col-auto q-ma-none">Visual feed</h2>
      <div class="col-auto row items-center q-col-gutter-sm">
        <div class="col-auto">
          <q-toggle
            :model-value="twoColumnFeed"
            dense
            label="2 columns"
            @update:model-value="$emit('update:twoColumnFeed', $event)"
          />
        </div>
        <div class="col-auto">
          <q-btn
            flat
            dense
            no-caps
            icon="refresh"
            label="Fetch Nostr"
            :loading="refreshing"
            @click="$emit('refresh')"
          />
        </div>
      </div>
    </div>

    <q-banner v-if="pendingCount" rounded dense class="faro-warning q-mt-sm">
      <div class="row items-center justify-between q-gutter-sm">
        <span>{{ pendingCount }} new post{{ pendingCount === 1 ? '' : 's' }}</span>
        <q-btn flat dense no-caps color="dark" label="Show" @click="$emit('show-pending')" />
      </div>
    </q-banner>

    <q-infinite-scroll v-if="posts.length" :disable="!hasMore" :offset="700" @load="loadMore">
      <div
        class="q-mt-md"
        :class="twoColumnFeed ? 'masonry' : 'column q-gutter-y-md'"
        data-testid="feed-grid"
      >
        <feed-post-card
          v-for="post in posts"
          :key="post.id"
          :class="{ 'masonry-card': twoColumnFeed }"
          :post="post"
          :interaction="interactionForPost(post)"
          :reply-author="replyAuthor"
          :format-date="formatDate"
          @like-post="$emit('like-post', post)"
          @comment-post="(content) => $emit('comment-post', post, content)"
        />
      </div>

      <div v-if="!hasMore" class="text-center text-caption text-blue-grey-5 q-py-md">
        Caught up for now.
      </div>

      <template #loading>
        <div class="row full-width justify-center q-my-md">
          <q-spinner-dots color="primary" size="32px" />
        </div>
      </template>
    </q-infinite-scroll>

    <q-card
      v-else
      flat
      bordered
      class="faro-surface column flex-center text-center text-brown-5 q-pa-lg q-mt-md q-gutter-sm"
      data-testid="empty-feed"
    >
      <q-icon name="auto_awesome" size="32px" />
      <p class="q-ma-none">No images yet. Post locally or fetch Nostr visuals from followed pubkeys.</p>
    </q-card>
  </section>
</template>

<script setup>
import FeedPostCard from 'components/FeedPostCard.vue'

defineProps({
  posts: {
    type: Array,
    default: () => [],
  },
  twoColumnFeed: {
    type: Boolean,
    default: false,
  },
  refreshing: {
    type: Boolean,
    default: false,
  },
  hasMore: {
    type: Boolean,
    default: false,
  },
  pendingCount: {
    type: Number,
    default: 0,
  },
  formatDate: {
    type: Function,
    required: true,
  },
  interactionForPost: {
    type: Function,
    default: () => null,
  },
  replyAuthor: {
    type: Function,
    default: () => ({ name: 'Nostr user', pubkey: '', picture: '' }),
  },
})

const emit = defineEmits(['load-more', 'refresh', 'update:twoColumnFeed', 'like-post', 'comment-post', 'show-pending'])

function loadMore(_index, done) {
  emit('load-more', done)
}
</script>

<style scoped>
.section-heading {
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: 0;
}

.masonry {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  align-items: start;
}

.masonry-card {
  width: 100%;
}

@media (max-width: 700px) {
  .masonry {
    grid-template-columns: 1fr;
  }
}
</style>
