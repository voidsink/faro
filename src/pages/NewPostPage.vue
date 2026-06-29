<template>
  <q-page class="faro-page">
    <div class="new-post-shell window-height q-mx-auto q-pa-sm">
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
                <q-card
                  flat
                  bordered
                  class="source-tile column flex-center text-center q-gutter-sm bg-grey-1"
                  @click="openGallery"
                >
                  <q-icon name="photo_library" size="34px" />
                  <strong>Choose photo</strong>
                  <span class="text-blue-grey-6">Open the file picker.</span>
                </q-card>
              </div>

              <div class="col-12 col-sm-6">
                <q-card
                  flat
                  bordered
                  class="source-tile column flex-center text-center q-gutter-sm bg-grey-1"
                  @click="openCamera"
                >
                  <q-icon name="photo_camera" size="34px" />
                  <strong>Use camera</strong>
                  <span class="text-blue-grey-6">Best on phones.</span>
                </q-card>
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
                :disable="!imagePreview"
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
                :disable="!imagePreview"
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
              Remote signer connection is not active. You can still press Publish to see the exact
              recovery message, or sign in again with your bunker link.
            </q-banner>

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
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import LoginDialog from 'components/auth/LoginDialog.vue'
import { ASPECT_RATIOS, processImageFile } from 'src/services/localMedia'
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
const selectedRatio = ref('1:1')
const selectedFile = ref(null)
const publishing = ref(false)
const publishMode = ref('')
const loginDialogOpen = ref(false)
const galleryInput = ref(null)
const cameraInput = ref(null)

const ratioOptions = Object.keys(ASPECT_RATIOS).map((ratio) => ({ label: ratio, value: ratio }))
const previewRatio = computed(() => ratioToNumber(selectedRatio.value))
const previewFrameStyle = computed(() => ({
  aspectRatio: String(previewRatio.value),
  '--preview-ratio': previewRatio.value,
}))
const canSaveLocally = computed(() =>
  Boolean(identity.value && imagePreview.value && !publishing.value),
)
const canAttemptNostrPublish = computed(() =>
  Boolean(
    processedMedia.value?.blob &&
    !publishing.value &&
    (hasActiveNostrSigner.value || identity.value?.clientSecretKeyHex),
  ),
)
const hasActiveNostrSigner = computed(() => Boolean(canSignNostrEvents.value))

onMounted(() => {
  session.init()
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
  try {
    const processed = await processImageFile(selectedFile.value, selectedRatio.value)
    processedMedia.value = processed
    imagePreview.value = processed.dataUrl
  } catch {
    processedMedia.value = null
    imagePreview.value = ''
    notifyError('Could not process that image.')
  }
}

function ratioToNumber(ratio) {
  const value = ASPECT_RATIOS[ratio] || ASPECT_RATIOS['1:1']
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
      source: 'local kind 1 draft',
    }
    session.addLocalPost(nextPost)
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
