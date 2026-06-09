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

    <q-infinite-scroll
      v-if="posts.length"
      :disable="!hasMore"
      :offset="700"
      @load="loadMore"
    >
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
          :format-date="formatDate"
        />
      </div>

      <template #loading>
        <div class="row justify-center q-my-md">
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
  formatDate: {
    type: Function,
    required: true,
  },
})

const emit = defineEmits(['load-more', 'refresh', 'update:twoColumnFeed'])

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
  display: block;
  column-count: 2;
  column-gap: 14px;
}

.masonry-card {
  margin-bottom: 14px;
}

@media (max-width: 700px) {
  .masonry {
    column-count: 1;
  }
}
</style>
