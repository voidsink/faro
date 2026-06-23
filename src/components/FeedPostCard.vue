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

    <div v-if="postImages.length > 1" class="post-carousel bg-grey-1">
      <img
        :src="activePostImage"
        :alt="post.caption || `Visual post image ${activeImage + 1}`"
        loading="lazy"
        decoding="async"
        class="post-image"
      />

      <q-btn
        v-if="activeImage > 0"
        round
        dense
        unelevated
        icon="chevron_left"
        class="carousel-arrow carousel-arrow--prev"
        aria-label="Previous image"
        @click="previousImage"
      />
      <q-btn
        v-if="activeImage < postImages.length - 1"
        round
        dense
        unelevated
        icon="chevron_right"
        class="carousel-arrow carousel-arrow--next"
        aria-label="Next image"
        @click="nextImage"
      />

      <div class="carousel-dots row no-wrap justify-center q-gutter-xs">
        <button
          v-for="(_, index) in postImages"
          :key="index"
          type="button"
          class="carousel-dot"
          :class="{ 'carousel-dot--active': index === activeImage }"
          :aria-label="`Show image ${index + 1}`"
          @click="activeImage = index"
        />
      </div>
    </div>

    <img
      v-else
      :src="post.image"
      :alt="post.caption || 'Visual post image'"
      loading="lazy"
      decoding="async"
      class="post-image bg-grey-1"
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
      <p
        v-if="post.caption"
        class="post-caption q-mt-xs q-mb-none"
        :class="{ 'post-caption--clamped': captionLong && !captionExpanded }"
      >
        <strong>{{ post.author.name }}</strong>
        {{ post.caption }}
      </p>
       <q-btn
         v-if="captionLong"
         flat
         dense
         no-caps
         class="q-pa-none text-blue-grey-5"
         :label="captionExpanded ? 'Show less...' : 'more...'"
         @click="captionExpanded = !captionExpanded"
       />
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
const activePostImage = computed(() => postImages.value[activeImage.value] || postImages.value[0] || '')
const captionExpanded = ref(false)
const captionLong = computed(() => {
  const text = props.post.caption?.trim()
  if (!text) return false
  return text.split(/\n|\r/).length > 5 || text.length > 220
})

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

function previousImage() {
  activeImage.value = Math.max(0, activeImage.value - 1)
}

function nextImage() {
  activeImage.value = Math.min(postImages.value.length - 1, activeImage.value + 1)
}
</script>

<style scoped>
.feed-post-card {
  display: inline-block;
  break-inside: avoid;
  max-width: 100%;
}

.post-image {
  display: block;
  width: auto;
  max-width: 100%;
  height: auto;
  max-height: min(78vh, 760px);
  margin: 0 auto;
  object-fit: contain;
}

.post-carousel {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
}

.carousel-arrow {
  position: absolute;
  top: 50%;
  z-index: 2;
  width: 32px;
  height: 32px;
  color: #263238;
  background: rgba(255, 255, 255, 0.86);
  transform: translateY(-50%);
}

.carousel-arrow--prev {
  left: 10px;
}

.carousel-arrow--next {
  right: 10px;
}

.carousel-dots {
  position: absolute;
  right: 0;
  bottom: 10px;
  left: 0;
  z-index: 2;
  pointer-events: none;
}

.carousel-dot {
  width: 6px;
  height: 6px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.55);
  pointer-events: auto;
}

.carousel-dot--active {
  background: white;
}

.post-caption {
  line-height: 1.45;
  white-space: pre-wrap;
}

.post-caption--clamped {
  display: -webkit-box;
  -webkit-line-clamp: 5;
  -webkit-box-orient: vertical;
  overflow: hidden;
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
