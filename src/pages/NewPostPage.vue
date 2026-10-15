<template>
  <q-page class="faro-page">
    <div class="faro-page-inner new-post-shell">
      <q-card flat bordered class="faro-surface new-post-card overflow-hidden">
        <q-toolbar class="composer-toolbar q-px-md">
          <q-btn flat round icon="close" aria-label="Close composer" to="/" />
          <q-toolbar-title>
            <div class="page-title">New post</div>
            <div class="text-caption text-blue-grey-6 text-weight-bold">
              Choose, frame, caption, publish.
            </div>
          </q-toolbar-title>
        </q-toolbar>

        <login-dialog
          v-model="loginDialogOpen"
          :has-nip07="hasNip07"
          :bunker-loading="session.bunkerLoading"
          @login-google="handleLoginGoogle"
          @login-nip07="handleLoginNip07"
          @login-bunker="handleLoginBunker"
          @create-key="handleCreateKey"
          @import-nsec="handleImportNsec"
        />

        <q-stepper
          v-model="step"
          flat
          animated
          keep-alive
          alternative-labels
          color="dark"
          active-color="dark"
          done-color="positive"
          :contracted="$q.screen.lt.sm"
          class="post-stepper"
        >
          <q-step :name="1" title="Photo" icon="add_photo_alternate" :done="Boolean(imagePreview)">
            <div class="row q-col-gutter-md">
              <div class="col-12 col-sm-6">
                <q-btn
                  outline
                  no-caps
                  color="dark"
                  class="source-tile full-width bg-grey-1"
                  @click="openGallery"
                >
                  <q-icon name="photo_library" size="34px" />
                  <strong>Choose photo</strong>
                  <span class="text-blue-grey-6">Open the file picker.</span>
                </q-btn>
              </div>

              <div class="col-12 col-sm-6">
                <q-btn
                  outline
                  no-caps
                  color="dark"
                  class="source-tile full-width bg-grey-1"
                  @click="openCamera"
                >
                  <q-icon name="photo_camera" size="34px" />
                  <strong>Use camera</strong>
                  <span class="text-blue-grey-6">Best on phones.</span>
                </q-btn>
              </div>
            </div>

            <input
              ref="galleryInput"
              class="hidden"
              type="file"
              accept="image/*"
              @change="selectImage"
            />
            <input
              ref="cameraInput"
              class="hidden"
              type="file"
              accept="image/*"
              capture="environment"
              @change="selectImage"
            />

            <q-stepper-navigation class="stepper-nav row justify-end q-gutter-sm q-pb-none">
              <q-btn
                unelevated
                color="dark"
                no-caps
                label="Continue"
                :disable="!imagePreview || processing"
                @click="step = 2"
              />
            </q-stepper-navigation>
          </q-step>

          <q-step
            :name="2"
            title="Frame"
            icon="crop"
            :done="Boolean(imagePreview && selectedRatio)"
          >
            <div class="column q-gutter-md">
              <div
                v-if="imagePreview"
                class="frame-preview overflow-hidden bg-grey-1 q-mx-auto"
                :style="previewFrameStyle"
              >
                <img :src="imagePreview" alt="Selected preview" class="block fit" />
              </div>
              <q-card
                v-else
                flat
                bordered
                class="empty-frame column flex-center text-center q-gutter-sm q-pa-xl bg-grey-1"
              >
                <q-icon name="image" size="34px" />
                <span class="text-blue-grey-6">Select an image first.</span>
              </q-card>

              <q-btn-toggle
                v-model="selectedRatio"
                unelevated
                rounded
                no-caps
                toggle-color="dark"
                color="grey-2"
                text-color="dark"
                :options="ratioOptions"
                :disable="processing || publishing"
                @update:model-value="reprocessSelectedImage"
              />
            </div>

            <q-stepper-navigation class="stepper-nav row justify-end q-gutter-sm q-pb-none">
              <q-btn flat no-caps label="Back" @click="step = 1" />
              <q-btn
                unelevated
                color="dark"
                no-caps
                label="Continue"
                :disable="!imagePreview || processing"
                @click="step = 3"
              />
            </q-stepper-navigation>
          </q-step>

          <q-step :name="3" title="Caption" icon="notes" :done="step > 3">
            <q-input
              v-model="caption"
              type="textarea"
              autogrow
              outlined
              autofocus
              counter
              maxlength="600"
              placeholder="Write a caption..."
              label="Caption"
            />

            <q-stepper-navigation class="stepper-nav row justify-end q-gutter-sm q-pb-none">
              <q-btn flat no-caps label="Back" @click="step = 2" />
              <q-btn unelevated color="dark" no-caps label="Review" @click="step = 4" />
            </q-stepper-navigation>
          </q-step>

          <q-step :name="4" title="Post" icon="send">
            <q-banner
              v-if="identity && !hasActiveNostrSigner && !identity.clientSecretKeyHex"
              rounded
              dense
              class="faro-warning q-mb-md"
            >
              Your signer is disconnected. Sign in again to publish; your draft will stay here.
            </q-banner>

            <q-banner v-if="!identity" rounded class="faro-warning q-mb-md">
              Sign in to publish or save this photo. Your draft stays here while you connect.
              <template #action
                ><q-btn
                  unelevated
                  no-caps
                  color="dark"
                  label="Sign in"
                  @click="loginDialogOpen = true"
              /></template>
            </q-banner>
            <q-banner v-else-if="!hasActiveNostrSigner" rounded class="faro-warning q-mb-md">
              <q-btn
                flat
                no-caps
                color="dark"
                label="Reconnect signer"
                @click="loginDialogOpen = true"
              />
            </q-banner>
            <p class="text-caption text-blue-grey-6">
              Publishing shares this photo publicly with Nostr and your media server. Save locally
              keeps a draft in this browser only.
            </p>

            <q-card flat bordered class="review-card overflow-hidden q-mx-auto">
              <q-card-section class="review-grid q-pa-none">
                <div
                  v-if="imagePreview"
                  class="review-preview bg-grey-1"
                  :style="previewFrameStyle"
                >
                  <img :src="imagePreview" alt="Post preview" class="block fit" />
                </div>
                <div class="review-caption column q-pa-md">
                  <div class="text-caption text-blue-grey-6 text-weight-bold text-uppercase">
                    Review caption
                  </div>
                  <div class="text-weight-bold q-mt-xs">{{ displayName }}</div>
                  <p v-if="caption.trim()" class="caption-preview q-mt-md q-mb-none">
                    {{ caption.trim() }}
                  </p>
                  <p v-else class="caption-preview q-mt-md q-mb-none text-blue-grey-6">
                    No caption.
                  </p>
                </div>
              </q-card-section>
            </q-card>

            <q-stepper-navigation class="stepper-nav row justify-end q-gutter-sm q-pb-none">
              <q-btn flat no-caps label="Back" @click="step = 3" />
              <q-btn
                flat
                color="dark"
                no-caps
                icon="save"
                label="Save locally"
                :loading="publishing && publishMode === 'local'"
                :disable="!canSaveLocally"
                @click="saveLocalPost"
              />
              <q-btn
                unelevated
                color="dark"
                no-caps
                icon="send"
                label="Publish to Nostr"
                :loading="publishing && publishMode === 'nostr'"
                :disable="!canAttemptNostrPublish"
                @click="publishNostrPost"
              />
            </q-stepper-navigation>
          </q-step>
        </q-stepper>
      </q-card>
    </div>
  </q-page>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import LoginDialog from 'components/auth/LoginDialog.vue'
import { ASPECT_RATIOS, ORIGINAL_ASPECT_RATIO_KEY, processImageFile } from 'src/services/localMedia'
import { loadBlossomServers, uploadBlobToBlossom } from 'src/services/blossom'
import { publishMediaPost } from 'src/services/nostrRelay'
import { useSessionStore } from 'src/stores/session-store'
import { notifySuccess, notifyError } from 'src/utils/notify'

const router = useRouter()
const session = useSessionStore()
const { identity, displayName, hasNip07, canSignNostrEvents } = storeToRefs(session)

const step = ref(1)
const caption = ref('')
const imagePreview = ref('')
const processedMedia = ref(null)
const selectedRatio = ref(ORIGINAL_ASPECT_RATIO_KEY)
const selectedFile = ref(null)
const publishing = ref(false)
const processing = ref(false)
const draftSaved = ref(false)
let imageRequest = 0
const publishMode = ref('')
const loginDialogOpen = ref(false)
const galleryInput = ref(null)
const cameraInput = ref(null)

const ratioOptions = Object.keys(ASPECT_RATIOS).map((ratio) => ({
  label: ASPECT_RATIOS[ratio].label,
  value: ratio,
}))
const previewRatio = computed(() => ratioToNumber(selectedRatio.value))
const previewFrameStyle = computed(() => {
  const ratio = ASPECT_RATIOS[selectedRatio.value] || ASPECT_RATIOS['1:1']
  const numeric = previewRatio.value
  const aspectRatio =
    ratio.original && processedMedia.value
      ? `${processedMedia.value.width} / ${processedMedia.value.height}`
      : ratio.width && ratio.height
        ? `${ratio.width} / ${ratio.height}`
        : String(numeric)

  return {
    aspectRatio,
    '--preview-ratio': numeric,
  }
})
const canSaveLocally = computed(() =>
  Boolean(identity.value && imagePreview.value && !publishing.value && !processing.value),
)
const canAttemptNostrPublish = computed(() =>
  Boolean(
    processedMedia.value?.blob &&
    !publishing.value &&
    !processing.value &&
    (hasActiveNostrSigner.value || identity.value?.clientSecretKeyHex),
  ),
)
const hasActiveNostrSigner = computed(() => Boolean(canSignNostrEvents.value))

onMounted(() => {
  session.init()
  window.addEventListener('beforeunload', warnBeforeUnload)
})
onUnmounted(() => window.removeEventListener('beforeunload', warnBeforeUnload))

const hasUnsavedDraft = computed(
  () => !draftSaved.value && Boolean(selectedFile.value || caption.value.trim()),
)
function warnBeforeUnload(event) {
  if (!hasUnsavedDraft.value && !publishing.value) return
  event.preventDefault()
  event.returnValue = ''
}
onBeforeRouteLeave(() => {
  if (publishing.value) {
    notifyError('Please wait for your post to finish saving or publishing.')
    return false
  }
  return (
    !hasUnsavedDraft.value ||
    window.confirm('Discard this unsaved post? Your photo and caption will be lost.')
  )
})

watch(identity, (nextIdentity) => {
  if (nextIdentity?.pubkey) loginDialogOpen.value = false
})

async function handleLoginNip07() {
  await session.loginWithNip07()
  if (session.identity) loginDialogOpen.value = false
}

function handleLoginGoogle() {
  session.loginWithGoogle()
}

function handleLoginBunker(value) {
  session.loginWithBunker(value)
}

function handleCreateKey() {
  session.createLocalKey()
  loginDialogOpen.value = false
}

function handleImportNsec(value) {
  session.importNsec(value)
  if (session.identity?.source === 'nsec') loginDialogOpen.value = false
}

function openGallery() {
  galleryInput.value?.click()
}

function openCamera() {
  cameraInput.value?.click()
}

async function selectImage(event) {
  const file = event.target.files?.[0]
  if (!file) return

  selectedFile.value = file
  await processSelectedImage()
  if (imagePreview.value) step.value = 2
}

async function reprocessSelectedImage() {
  if (!selectedFile.value) return
  await processSelectedImage()
}

async function processSelectedImage() {
  if (!selectedFile.value) return
  const current = ++imageRequest
  processing.value = true
  try {
    const processed = await processImageFile(selectedFile.value, selectedRatio.value)
    if (current !== imageRequest) return
    processedMedia.value = processed
    imagePreview.value = processed.dataUrl
  } catch {
    if (current !== imageRequest) return
    processedMedia.value = null
    imagePreview.value = ''
    notifyError('Could not process that image.')
  } finally {
    if (current === imageRequest) processing.value = false
  }
}

function ratioToNumber(ratio) {
  const value = ASPECT_RATIOS[ratio] || ASPECT_RATIOS['1:1']
  if (value?.original) {
    const media = processedMedia.value
    if (media?.width && media?.height) {
      return media.width / media.height
    }
    return 1
  }
  return value.width / value.height
}

async function saveLocalPost() {
  if (!identity.value) {
    notifyError('Login or create a local identity before saving locally.')
    return
  }
  if (!imagePreview.value) {
    notifyError('Choose an image before saving.')
    return
  }

  publishing.value = true
  publishMode.value = 'local'
  try {
    const nextPost = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      author: { name: displayName.value, pubkey: identity.value.pubkey },
      caption: caption.value.trim(),
      image: processedMedia.value?.dataUrl || imagePreview.value,
      media: serializableMedia(processedMedia.value),
      ratio: selectedRatio.value,
      createdAt: new Date().toISOString(),
      source: 'local draft',
    }
    session.addLocalPost(nextPost)
    draftSaved.value = true
    publishing.value = false
    await router.push('/')
  } catch {
    notifyError('Could not save locally. Try a smaller image.')
  } finally {
    publishing.value = false
    publishMode.value = ''
  }
}

function serializableMedia(media) {
  return media
    ? {
        mimeType: media.mimeType,
        sha256: media.sha256,
        width: media.width,
        height: media.height,
        dimensions: media.dimensions,
        bytes: media.bytes,
      }
    : null
}

async function publishNostrPost() {
  const signer = await session.activeSigner('publishing to Nostr')
  if (!signer) {
    notifyError(session.message || session.requireSignerMessage('publishing to Nostr'))
    return
  }
  if (!processedMedia.value?.blob) {
    notifyError('Choose an image before publishing.')
    return
  }

  const blossomServers = loadBlossomServers()
  if (!blossomServers.length) {
    notifyError('Configure a Blossom media server in Settings before publishing to Nostr.')
    return
  }

  publishing.value = true
  publishMode.value = 'nostr'

  try {
    const uploadResult = await uploadBlobToBlossom(processedMedia.value, {
      serverUrls: blossomServers,
      signer,
    })
    if (!uploadResult.ok) {
      notifyError(uploadResult.error || 'Blossom upload failed.')
      return
    }

    const publishResult = await publishMediaPost(
      {
        caption: caption.value.trim(),
        mediaUrl: uploadResult.url,
        media: uploadResult.metadata,
      },
      { signer },
    )

    if (!publishResult.ok) {
      notifyError(publishResult.error || 'Post could not be published to any relay.')
      return
    }

    session.addPublishedRelayPost({
      event: publishResult.event,
      mediaUrl: uploadResult.url,
      media: uploadResult.metadata,
      caption: caption.value.trim(),
    })
    notifySuccess(relayPublishMessage(publishResult.results))
    draftSaved.value = true
    publishing.value = false
    await router.push('/')
  } catch (error) {
    notifyError(error?.message || 'Nostr publish failed.')
  } finally {
    publishing.value = false
    publishMode.value = ''
  }
}

function relayPublishMessage(results = []) {
  const okCount = results.filter((result) => result.ok).length
  const total = results.length
  return okCount === total
    ? `Post published to ${okCount} relays.`
    : `Post published to ${okCount}/${total} relays. Some relays rejected or timed out.`
}
</script>

<style scoped>
.new-post-shell {
  width: min(100%, 920px);
}

.new-post-card {
  min-height: calc(100vh - 24px);
}

.composer-toolbar {
  min-height: 72px;
}

.page-title {
  font-family: var(--faro-font-heading);
  font-size: 1.35rem;
  font-weight: 900;
}

.post-stepper {
  background: transparent;
}

.source-tile,
.empty-frame {
  min-height: 180px;
  border-color: rgba(20, 24, 28, 0.08);
  border-radius: var(--faro-radius-md);
  cursor: pointer;
}

.frame-preview,
.review-card {
  border-radius: var(--faro-radius-md);
}

.frame-preview {
  width: min(100%, calc(58vh * var(--preview-ratio)));
  max-height: 58vh;
}

.review-preview {
  width: 100%;
  max-height: 58vh;
  aspect-ratio: var(--preview-ratio);
}

.review-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(220px, 0.85fr);
}

.review-caption {
  min-width: 0;
}

.frame-preview img,
.review-preview img {
  object-fit: contain;
}

.empty-frame {
  cursor: default;
}

.review-card {
  width: min(100%, 820px);
  border-color: rgba(20, 24, 28, 0.08);
}

.caption-preview {
  line-height: 1.45;
  white-space: pre-wrap;
}

@media (max-width: 700px) {
  .new-post-shell {
    padding: 0;
  }

  .new-post-card {
    min-height: 100vh;
    border: 0;
    border-radius: 0;
  }

  .source-tile {
    min-height: 148px;
  }

  :deep(.q-stepper__content) {
    padding: 18px 16px 22px;
  }

  .review-grid {
    grid-template-columns: 1fr;
  }

  .review-preview {
    max-height: none;
  }

  .stepper-nav {
    position: sticky;
    bottom: 0;
    z-index: 2;
    margin: 18px -16px -22px;
    padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
    background: rgba(255, 255, 255, 0.94);
    backdrop-filter: blur(12px);
  }

  .stepper-nav :deep(.q-btn) {
    flex: 1;
  }
}
</style>
