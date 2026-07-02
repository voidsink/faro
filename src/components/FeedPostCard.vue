<template>
  <q-card flat bordered class="faro-surface full-width overflow-hidden" data-testid="feed-post">
    <q-card-section class="q-py-sm q-px-md">
      <q-item class="q-px-none">
        <q-item-section avatar>
          <user-avatar
            size="38px"
            :name="post.author.name"
            :pubkey="post.author.pubkey"
            :picture="post.author.picture"
          />
        </q-item-section>
        <q-item-section>
          <q-item-label class="text-weight-bold text-body2">{{ post.author.name }}</q-item-label>
          <q-item-label caption class="text-blue-grey-6 text-caption">{{
            formattedDate
          }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-btn flat round dense icon="more_horiz" color="blue-grey-6" aria-label="Post options" />
        </q-item-section>
      </q-item>
    </q-card-section>

    <div v-if="postImages.length > 1" class="relative-position bg-grey-1">
      <q-carousel
        v-model="activeImage"
        swipeable
        arrows
        animated
        transition-prev="slide-right"
        transition-next="slide-left"
        navigation
        navigation-icon="fiber_manual_record"
        navigation-active-icon="fiber_manual_record"
        height="auto"
        class="feed-carousel"
        control-type="flat"
        control-color="blue-grey-10"
      >
        <q-carousel-slide
          v-for="(image, index) in postImages"
          :key="index"
          :name="index"
          class="q-pa-none flex flex-center"
        >
          <img
            :src="image"
            :alt="post.caption || `Visual post image ${index + 1}`"
            loading="lazy"
            spinner-color="white"
            class="feed-image block"
          />
        </q-carousel-slide>
        <template #navigation-icon="{ active, btnProps, onClick }">
          <q-btn
            v-if="active"
            size="xs"
            :icon="btnProps.icon"
            color="light-blue-5"
            round
            flat
            dense
            @click="onClick"
          />
          <q-btn
            v-else
            size="xs"
            :icon="btnProps.icon"
            color="white"
            round
            flat
            dense
            @click="onClick"
          />
        </template>
      </q-carousel>
    </div>

    <img
      v-else-if="postImages.length === 1"
      :src="postImages[0]"
      :alt="post.caption || 'Visual post image'"
      loading="lazy"
      decoding="async"
      class="feed-image block bg-grey-1"
    />

    <video
      v-else-if="postVideos.length"
      controls
      playsinline
      :src="postVideos[0]"
      class="feed-video block bg-grey-1"
      preload="metadata"
    />

    <q-card-actions class="row items-center justify-between q-px-sm q-py-sm">
      <div class="row items-center">
        <q-btn
          flat
          round
          dense
          size="md"
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
          size="md"
          icon="mode_comment"
          color="blue-grey-10"
          aria-label="Comment on post"
          @click="openComments"
        >
          <q-tooltip>Comment</q-tooltip>
        </q-btn>
        <q-btn
          flat
          round
          dense
          size="md"
          icon="bolt"
          color="blue-grey-10"
          aria-label="Zap post"
          @click="handleZap"
        >
          <q-tooltip>Zap</q-tooltip>
        </q-btn>
      </div>

      <q-btn
        flat
        round
        dense
        size="md"
        icon="bookmark_border"
        color="blue-grey-10"
        aria-label="Save post"
      >
        <q-tooltip>Save</q-tooltip>
      </q-btn>
    </q-card-actions>

    <q-card-section class="q-pt-none q-px-md q-pb-md">
      <div class="text-caption text-weight-bold">{{ engagementLabel }}</div>
      <p
        v-if="post.caption"
        class="q-mt-xs q-mb-none text-body2"
        :class="{ 'caption-clamped': captionLong && !captionExpanded }"
      >
        <span class="text-weight-bold">{{ post.author.name }}</span>
        <caption-with-hashtags :text="post.caption" />
      </p>
      <div v-if="captionLong" class="q-mt-xs">
        <q-btn
          flat
          dense
          no-caps
          class="q-pa-none text-blue-grey-6"
          :label="captionExpanded ? 'Show less' : 'more'"
          @click="captionExpanded = !captionExpanded"
        />
      </div>
      <q-btn
        flat
        dense
        no-caps
        class="q-mt-sm q-pa-none text-blue-grey-6"
        :label="commentsOpen ? 'Hide comments' : 'View comments'"
        @click="toggleComments"
      />

      <q-slide-transition>
        <div v-if="commentsOpen" class="q-mt-sm">
          <div v-if="replies.length" class="column q-gutter-sm q-mb-sm">
            <div v-for="reply in replies" :key="reply.id" class="row no-wrap q-gutter-sm">
              <user-avatar
                size="26px"
                :name="replyAuthor(reply).name"
                :pubkey="reply.pubkey"
                :picture="replyAuthor(reply).picture"
              />
              <div class="reply-body text-body2">
                <span class="text-weight-bold">{{ replyAuthor(reply).name }}</span>
                {{ reply.content }}
              </div>
            </div>
          </div>
          <div v-else class="text-caption text-blue-grey-6 q-mb-sm">No comments yet.</div>
          <q-input
            ref="commentInput"
            v-model="commentDraft"
            dense
            borderless
            placeholder="Add a comment..."
            class="q-pt-sm"
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
import CaptionWithHashtags from 'components/CaptionWithHashtags.vue'
import UserAvatar from 'components/UserAvatar.vue'
import { notifyInfo } from 'src/utils/notify'

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

const emit = defineEmits(['like-post', 'comment-post', 'zap-post'])

const formattedDate = computed(() => props.formatDate(props.post.createdAt))
const postImages = computed(() =>
  props.post.images?.length ? props.post.images : [props.post.image].filter(Boolean),
)
const postVideos = computed(() =>
  props.post.videos?.length ? props.post.videos : [props.post.video].filter(Boolean),
)
const replies = computed(() => props.interaction?.replies || [])
const likeCount = computed(() => props.interaction?.count || 0)
const zapCount = computed(() => props.interaction?.zapCount || 0)
const zapSats = computed(() => props.interaction?.sats || 0)
const likedIcon = computed(() => (props.interaction?.likedByMe ? 'favorite' : 'favorite_border'))
const likedColor = computed(() => (props.interaction?.likedByMe ? 'red-5' : undefined))
const likeTooltip = computed(() => (props.interaction?.likedByMe ? 'Liked by you' : 'Like'))
const engagementLabel = computed(() => {
  const likes = likeCount.value
  const comments = replies.value.length
  const zaps = zapCount.value
  const sats = zapSats.value
  const parts = []
  if (likes) parts.push(`${likes} ${likes === 1 ? 'like' : 'likes'}`)
  if (zaps) parts.push(`${zaps} ${zaps === 1 ? 'zap' : 'zaps'} · ${sats} sats`)
  if (comments) parts.push(`${comments} ${comments === 1 ? 'comment' : 'comments'}`)
  if (parts.length) return parts.join(' · ')
  return props.post.nostr ? 'No reactions yet' : 'Local draft'
})
const commentsOpen = ref(false)
const commentDraft = ref('')
const commentInput = ref(null)
const activeImage = ref(0)
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

function handleZap() {
  emit('zap-post')
  notifyInfo(
    'Zapping requires a Lightning address and a WebLN-enabled wallet. Full zap payment flow is not wired yet.',
  )
}
</script>

<style scoped>
.feed-image {
  display: block;
  width: auto;
  max-width: 100%;
  height: auto;
  max-height: min(78vh, 760px);
  margin: 0 auto;
  object-fit: contain;
}

.feed-video {
  display: block;
  width: 100%;
  max-width: 100%;
  height: auto;
  max-height: min(78vh, 760px);
  margin: 0 auto;
  object-fit: contain;
}

.caption-clamped {
  display: -webkit-box;
  -webkit-line-clamp: 5;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.reply-body {
  flex: 1;
  line-height: 1.4;
  min-width: 0;
  overflow-wrap: anywhere;
}

.feed-carousel :deep(.q-carousel__arrow .q-btn) {
  background: rgba(255, 255, 255, 0.86);
  color: #263238;
}
</style>
