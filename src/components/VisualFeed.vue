<template>
  <section class="visual-feed column q-gutter-y-sm full-width">
    <div class="row items-center justify-between q-col-gutter-sm">
      <h2 class="text-h6 text-weight-bolder q-ma-none">Visual feed</h2>
      <div class="col-auto row items-center q-col-gutter-sm">
        <div class="col-auto">
          <q-checkbox
            v-model="twoColumnFeedProxy"
            checked-icon="calendar_view_day"
            unchecked-icon="dashboard"
            color="dark"
            class="layout-toggle"
            keep-color
            dense
            :aria-label="twoColumnFeed ? 'Two column feed' : 'Single column feed'"
          />
          <q-tooltip>{{ twoColumnFeed ? 'Single column feed' : 'Two column feed' }}</q-tooltip>
        </div>
        <div class="col-auto">
          <q-btn
            flat
            dense
            round
            color="dark"
            icon="refresh"
            :loading="refreshing"
            aria-label="Refresh Nostr feed"
            @click="$emit('refresh')"
          >
            <q-tooltip>Refresh</q-tooltip>
          </q-btn>
        </div>
      </div>
    </div>

    <q-banner
      v-if="pendingCount"
      rounded
      class="bg-white text-dark q-mt-sm"
      style="border: 1px solid rgba(15, 23, 42, 0.08)"
    >
      <div class="row items-center justify-between q-gutter-sm">
        <div class="row items-center q-gutter-sm">
          <q-icon name="auto_awesome" color="primary" size="20px" />
          <span class="text-weight-medium"
            >{{ pendingCount }} new post{{ pendingCount === 1 ? '' : 's' }}</span
          >
        </div>
        <q-btn
          unelevated
          rounded
          dense
          no-caps
          color="dark"
          label="Show"
          @click="$emit('show-pending')"
        />
      </div>
    </q-banner>

    <q-pull-to-refresh
      :disable="!isMobile"
      color="primary"
      bg-color="dark"
      scroll-target="body"
      class="feed-refresh full-width"
      @refresh="onPullRefresh"
    >
      <q-infinite-scroll
        v-if="posts.length"
        :disable="!hasMore"
        :offset="700"
        @load="loadMore"
        class="full-width"
      >
        <div
          class="feed-grid q-mt-md"
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
        class="faro-surface column flex-center text-center q-pa-xl q-mt-md q-gutter-md"
        data-testid="empty-feed"
      >
        <q-avatar size="64px" color="blue-grey-1" text-color="blue-grey-5" icon="photo_library" />
        <div>
          <p class="text-weight-bold text-body1 q-ma-none">No visuals yet</p>
          <p class="text-caption text-blue-grey-6 q-ma-none q-mt-xs">
            Post locally or fetch visuals from Nostr.
          </p>
        </div>
        <q-btn
          unelevated
          rounded
          color="dark"
          no-caps
          icon="add_photo_alternate"
          label="Create post"
          to="/new"
        />
      </q-card>
    </q-pull-to-refresh>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { useQuasar } from 'quasar'
import FeedPostCard from 'components/FeedPostCard.vue'

const $q = useQuasar()
const isMobile = computed(() => $q.screen.lt.md)

const emit = defineEmits([
  'load-more',
  'refresh',
  'update:twoColumnFeed',
  'like-post',
  'comment-post',
  'show-pending',
])

const props = defineProps({
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

const twoColumnFeedProxy = computed({
  get: () => props.twoColumnFeed,
  set: (value) => emit('update:twoColumnFeed', value),
})

function onPullRefresh(done) {
  emit('refresh', done)
}

function loadMore(_index, done) {
  emit('load-more', done)
}
</script>

<style scoped>
.visual-feed,
.feed-refresh,
.feed-grid {
  width: 100%;
  min-width: 0;
  max-width: 100%;
}

.feed-refresh :deep(.q-pull-to-refresh__content),
.feed-refresh :deep(.q-infinite-scroll) {
  width: 100%;
  min-width: 0;
  max-width: 100%;
}

.feed-grid:not(.masonry) {
  width: 100%;
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

.layout-toggle :deep(.q-checkbox__inner),
.layout-toggle :deep(.q-icon) {
  font-size: 25px;
}

@media (max-width: 700px) {
  .masonry {
    grid-template-columns: 1fr;
  }
}
</style>
