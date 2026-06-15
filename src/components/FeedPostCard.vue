<template>
  <q-card
    flat
    bordered
    class="faro-surface feed-post-card full-width overflow-hidden"
    data-testid="feed-post"
  >
    <q-item class="q-pa-md">
      <q-item-section avatar>
        <user-avatar
          size="34px"
          :name="post.author.name"
          :pubkey="post.author.pubkey"
          :picture="post.author.picture"
        />
      </q-item-section>
      <q-item-section>
        <q-item-label class="text-weight-bold">{{ post.author.name }}</q-item-label>
        <q-item-label caption>{{ formattedDate }}</q-item-label>
      </q-item-section>
    </q-item>

    <q-carousel
      v-if="postImages.length > 1"
      v-model="activeImage"
      animated
      arrows
      navigation
      swipeable
      control-color="white"
      class="post-carousel bg-grey-1"
    >
      <q-carousel-slide
        v-for="(image, index) in postImages"
        :key="image"
        :name="index"
        class="q-pa-none flex flex-center bg-grey-1"
      >
        <img
          :src="image"
          :alt="post.caption || `Visual post image ${index + 1}`"
          loading="lazy"
          decoding="async"
          class="post-image block full-width"
        />
      </q-carousel-slide>
    </q-carousel>

    <img
      v-else
      :src="post.image"
      :alt="post.caption || 'Visual post image'"
      loading="lazy"
      decoding="async"
      class="post-image block full-width bg-grey-1"
    />

    <q-card-actions class="post-actions row items-center justify-between q-px-sm q-py-xs">
      <div class="row items-center q-gutter-xs">
        <q-btn
          flat
          round
          dense
          :icon="likedIcon"
          :color="likedColor"
          :loading="interaction?.publishing"
          :disable="!post.nostr || interaction?.likedByMe"
          aria-label="Like post"
          @click="$emit('like-post')"
        >
          <q-tooltip>{{ likeTooltip }}</q-tooltip>
        </q-btn>
        <q-btn
          flat
          round
          dense
          icon="mode_comment"
          aria-label="Comment on post"
          @click="openComments"
        >
          <q-tooltip>Comment</q-tooltip>
        </q-btn>
        <q-btn flat round dense icon="bolt" aria-label="Zap post">
          <q-tooltip>Zap</q-tooltip>
        </q-btn>
      </div>

      <q-btn flat round dense icon="bookmark_border" aria-label="Save post">
        <q-tooltip>Save</q-tooltip>
      </q-btn>
    </q-card-actions>

    <q-card-section class="q-pt-none q-px-md q-pb-md">
      <div class="text-caption text-weight-bold">{{ engagementLabel }}</div>
      <p v-if="post.caption" class="post-caption q-mt-xs q-mb-none">
        <strong>{{ post.author.name }}</strong>
        {{ post.caption }}
      </p>
      <q-btn
        flat
        dense
        no-caps
        class="q-mt-xs q-pa-none text-blue-grey-5"
        :label="commentsOpen ? 'Hide comments' : 'View comments'"
        @click="toggleComments"
      />

      <q-slide-transition>
        <div v-if="commentsOpen" class="q-mt-sm">
          <div v-if="replies.length" class="column q-gutter-sm q-mb-sm">
            <div v-for="reply in replies" :key="reply.id" class="reply-row row no-wrap q-gutter-sm">
              <user-avatar
                size="26px"
                :name="replyAuthor(reply).name"
                :pubkey="reply.pubkey"
                :picture="replyAuthor(reply).picture"
              />
              <div class="reply-body">
                <strong>{{ replyAuthor(reply).name }}</strong>
                {{ reply.content }}
              </div>
            </div>
          </div>
          <div v-else class="text-caption text-blue-grey-5 q-mb-sm">
            No comments loaded yet.
          </div>
          <q-input
            ref="commentInput"
            v-model="commentDraft"
            dense
            borderless
            placeholder="Add a comment..."
            class="comment-input"
          >
            <template #prepend>
              <q-icon name="sentiment_satisfied" size="18px" class="text-blue-grey-4" />
            </template>
            <template #append>
              <q-btn
                flat
                dense
                no-caps
                color="primary"
                label="Post"
                :loading="interaction?.publishing"
                :disable="!commentDraft.trim() || !post.nostr || interaction?.publishing"
                @click="publishComment"
              />
            </template>
          </q-input>
        </div>
      </q-slide-transition>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue'
import UserAvatar from 'components/UserAvatar.vue'

const props = defineProps({
  post: {
    type: Object,
    required: true,
  },
  formatDate: {
    type: Function,
    required: true,
  },
  interaction: {
    type: Object,
    default: null,
  },
  replyAuthor: {
    type: Function,
    default: () => ({ name: 'Nostr user', pubkey: '', picture: '' }),
  },
})

const emit = defineEmits(['like-post', 'comment-post'])

const formattedDate = computed(() => props.formatDate(props.post.createdAt))
const postImages = computed(() => props.post.images?.length ? props.post.images : [props.post.image].filter(Boolean))
const replies = computed(() => props.interaction?.replies || [])
const likeCount = computed(() => props.interaction?.count || 0)
const likedIcon = computed(() => (props.interaction?.likedByMe ? 'favorite' : 'favorite_border'))
const likedColor = computed(() => (props.interaction?.likedByMe ? 'red-5' : undefined))
const likeTooltip = computed(() => (props.interaction?.likedByMe ? 'Liked by you' : 'Like'))
const engagementLabel = computed(() => {
  const likes = likeCount.value
  const comments = replies.value.length
  if (likes || comments) return `${likes} ${likes === 1 ? 'like' : 'likes'} · ${comments} ${comments === 1 ? 'comment' : 'comments'}`
  return props.post.nostr ? 'No Nostr reactions yet' : 'Local draft'
})
const commentsOpen = ref(false)
const commentDraft = ref('')
const commentInput = ref(null)
const activeImage = ref(0)

function toggleComments() {
  commentsOpen.value = !commentsOpen.value
}

async function openComments() {
  commentsOpen.value = true
  await nextTick()
  commentInput.value?.focus?.()
}

function publishComment() {
  const content = commentDraft.value.trim()
  if (!content) return
  emit('comment-post', content)
  commentDraft.value = ''
}
</script>

<style scoped>
.feed-post-card {
  display: inline-block;
  break-inside: avoid;
}

.post-image {
  height: auto;
  object-fit: contain;
}

.post-carousel {
  height: min(72vh, 640px);
}

.post-carousel .post-image {
  max-height: min(72vh, 640px);
}

.post-caption {
  line-height: 1.45;
  white-space: pre-wrap;
}

.post-actions :deep(.q-icon) {
  font-size: 25px;
}

.reply-body {
  flex: 1;
  line-height: 1.4;
  min-width: 0;
  overflow-wrap: anywhere;
}

.comment-input {
  border-top: 1px solid rgba(20, 24, 28, 0.08);
}
</style>
