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
          <router-link
            :to="`/profile/${post.author.pubkey}`"
            class="text-weight-bold text-body2 author-link"
            >{{ post.author.name }}</router-link
          >
          <q-item-label caption class="faro-muted text-caption">{{ formattedDate }}</q-item-label>
        </q-item-section>
      </q-item>
    </q-card-section>

    <q-banner v-if="contentWarning && !mediaRevealed" class="faro-warning" role="status">
      Content warning: {{ contentWarning }}
      <template #action
        ><q-btn flat no-caps label="Show media" @click="mediaRevealed = true"
      /></template>
    </q-banner>
    <template v-if="!contentWarning || mediaRevealed">
      <div v-if="postImages.length > 1" class="relative-position faro-muted-surface">
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
          control-color="accent"
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
              class="feed-image block"
            />
          </q-carousel-slide>
          <template #navigation-icon="{ btnProps, onClick, index }">
            <q-btn
              size="xs"
              :icon="btnProps.icon"
              :class="activeImage === index ? 'faro-link' : 'faro-muted'"
              round
              flat
              dense
              :aria-label="`Show image ${index + 1}`"
              :aria-current="activeImage === index ? 'true' : undefined"
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
        class="feed-image block faro-muted-surface"
      />

      <video
        v-else-if="postVideos.length"
        controls
        playsinline
        :src="postVideos[0]"
        class="feed-video block faro-muted-surface"
        preload="metadata"
      />
    </template>

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
          class="faro-text"
          aria-label="Comment on post"
          @click="openComments"
        >
          <q-tooltip>Comment</q-tooltip>
        </q-btn>
      </div>

      <q-btn
        flat
        round
        dense
        size="md"
        icon="ios_share"
        class="faro-text"
        aria-label="Share post"
        :disable="!post.nostr"
        @click="sharePost"
      >
        <q-tooltip>Copy link to post</q-tooltip>
      </q-btn>
    </q-card-actions>

    <q-card-section class="q-pt-none q-px-md q-pb-md">
      <div class="text-caption text-weight-bold">{{ engagementLabel }}</div>
      <p
        v-if="post.caption"
        class="q-mt-xs q-mb-none text-body2"
        :class="{ 'caption-clamped': captionLong && !captionExpanded }"
      >
        <span class="text-weight-bold q-mr-sm">{{ post.author.name }}</span>
        <caption-with-hashtags :text="post.caption" />
      </p>
      <div v-if="captionLong" class="q-mt-xs">
        <q-btn
          flat
          dense
          no-caps
          class="q-pa-none faro-muted"
          :label="captionExpanded ? 'Show less' : 'more'"
          @click="captionExpanded = !captionExpanded"
        />
      </div>
      <q-btn
        flat
        dense
        no-caps
        class="q-mt-sm q-pa-none faro-muted"
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
          <div v-else class="text-caption faro-muted q-mb-sm">No comments yet.</div>
          <q-input
            color="accent"
            ref="commentInput"
            v-model="commentDraft"
            dense
            borderless
            placeholder="Add a comment..."
            aria-label="Add a comment"
            :disable="commentPublishing"
            class="faro-input q-pt-sm"
          >
            <template #prepend>
              <q-icon name="sentiment_satisfied" size="18px" class="faro-muted" />
            </template>
            <template #append>
              <q-btn
                flat
                dense
                no-caps
                color="accent"
                label="Post"
                :loading="commentPublishing"
                :disable="
                  !commentDraft.trim() ||
                  !post.nostr ||
                  interaction?.publishing ||
                  commentPublishing
                "
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
import { copyToClipboard } from 'quasar'
import { notifyError, notifySuccess } from 'src/utils/notify'

const props = defineProps({
  commentOnPost: { type: Function, required: true },
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
const likedColor = computed(() => (props.interaction?.likedByMe ? 'accent' : undefined))
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
const mediaRevealed = ref(false)
const contentWarning = computed(() => {
  const tag = props.post.nostr?.tags?.find((tag) => tag[0] === 'content-warning')
  return tag ? tag[1] || 'Sensitive content' : ''
})
const commentPublishing = ref(false)
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

async function publishComment() {
  const content = commentDraft.value.trim()
  if (!content || commentPublishing.value) return
  commentPublishing.value = true
  try {
    if (await props.commentOnPost(props.post, content)) commentDraft.value = ''
  } catch {
    notifyError('Could not publish your comment. Your text is still here.')
  } finally {
    commentPublishing.value = false
  }
}

async function sharePost() {
  const url = new URL(window.location.href)
  url.hash = `/post/${props.post.id}`
  try {
    await copyToClipboard(url.toString())
    notifySuccess('Post link copied.')
  } catch {
    notifyError('Could not copy the link. Open the post and copy its address.')
  }
}

defineEmits(['like-post'])
</script>

<style scoped>
.author-link {
  color: var(--faro-link);
  text-decoration: none;
  overflow-wrap: anywhere;
}
.author-link:hover {
  text-decoration: underline;
}
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
  background: var(--faro-surface-bg);
  color: var(--faro-ink);
}

.feed-carousel :deep(.q-carousel__navigation-inner) {
  flex: 0 1 auto;
  width: fit-content;
  margin: 0 auto;
  border-radius: var(--faro-radius-sm);
  background: var(--faro-surface-bg);
}
</style>
