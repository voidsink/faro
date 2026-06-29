<template>
  <q-card flat bordered class="faro-surface" data-testid="composer-card">
    <q-card-section class="q-pb-none">
      <q-item class="q-px-none">
        <q-item-section avatar>
          <user-avatar
            size="44px"
            :name="displayName"
            :pubkey="identity?.pubkey"
            :picture="activeProfile.picture"
          />
        </q-item-section>
        <q-item-section>
          <q-item-label class="text-weight-bold">{{
            identity ? displayName : 'Create post'
          }}</q-item-label>
          <q-item-label caption class="text-blue-grey-6">{{
            identity ? 'Share a visual moment' : 'Login to unlock posting'
          }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-btn
            flat
            dense
            round
            color="blue-grey-6"
            icon="delete_sweep"
            aria-label="Clear local posts"
            @click="$emit('clear-post-cache')"
          >
            <q-tooltip>Clear local posts</q-tooltip>
          </q-btn>
        </q-item-section>
      </q-item>
    </q-card-section>

    <q-card-section>
      <q-banner v-if="!identity" rounded class="bg-orange-1 text-brown-8 q-mb-md">
        Sign in or create a local identity to publish visuals.
      </q-banner>

      <input
        ref="imageInput"
        class="hidden"
        type="file"
        accept="image/*"
        data-testid="image-input"
        @change="$emit('select-image', $event)"
      />

      <div
        v-if="!imagePreview"
        class="upload-zone column flex-center text-center q-pa-xl q-mb-md rounded-borders cursor-pointer"
        data-testid="image-picker"
        @click="openImagePicker"
      >
        <q-icon name="add_photo_alternate" size="42px" color="blue-grey-4" />
        <div class="text-weight-medium text-body2 q-mt-sm">Add a photo</div>
        <div class="text-caption text-blue-grey-6">Tap to choose an image</div>
      </div>

      <div
        v-else
        class="overflow-hidden rounded-borders bg-grey-1 q-mx-auto q-mb-md"
        :style="previewFrameStyle"
      >
        <q-img :src="imagePreview" alt="Selected preview" fit="contain" class="full-height" />
      </div>

      <div v-if="imagePreview" class="row justify-center q-mb-md">
        <q-btn-toggle
          :model-value="selectedRatio"
          unelevated
          rounded
          dense
          no-caps
          toggle-color="dark"
          color="grey-2"
          text-color="dark"
          :options="ratioOptions"
          aria-label="Image aspect ratio"
          @update:model-value="setRatio"
        />
      </div>

      <q-form @submit.prevent="$emit('publish-post')">
        <q-input
          :model-value="caption"
          type="textarea"
          autogrow
          outlined
          rounded
          placeholder="Write a caption..."
          data-testid="caption-input"
          @update:model-value="$emit('update:caption', $event)"
        />

        <q-btn
          unelevated
          rounded
          color="dark"
          class="full-width q-mt-md text-weight-bold"
          no-caps
          :disable="!canPost"
          label="Post"
          type="submit"
          data-testid="post-button"
        />
      </q-form>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import UserAvatar from 'components/UserAvatar.vue'

const props = defineProps({
  identity: {
    type: Object,
    default: null,
  },
  activeProfile: {
    type: Object,
    required: true,
  },
  displayName: {
    type: String,
    required: true,
  },
  caption: {
    type: String,
    required: true,
  },
  imagePreview: {
    type: String,
    required: true,
  },
  selectedRatio: {
    type: String,
    required: true,
  },
  ratios: {
    type: Array,
    required: true,
  },
  canPost: {
    type: Boolean,
    default: false,
  },
  ratioToNumber: {
    type: Function,
    required: true,
  },
})

const emit = defineEmits([
  'clear-post-cache',
  'select-image',
  'publish-post',
  'update:caption',
  'update:selectedRatio',
])

const imageInput = ref(null)

const ratioOptions = computed(() => props.ratios.map((ratio) => ({ label: ratio, value: ratio })))
const previewRatio = computed(() => props.ratioToNumber(props.selectedRatio))
const previewFrameStyle = computed(() => ({
  aspectRatio: String(previewRatio.value),
  maxHeight: '58vh',
  width: 'min(100%, calc(58vh * var(--preview-ratio)))',
  '--preview-ratio': previewRatio.value,
}))

watch(
  () => props.imagePreview,
  (value) => {
    if (!value && imageInput.value) {
      imageInput.value.value = ''
    }
  },
)

function openImagePicker() {
  imageInput.value?.click()
}

defineExpose({
  openImagePicker,
})

async function setRatio(ratio) {
  emit('update:selectedRatio', ratio)
  await nextTick()
  const file = imageInput.value?.files?.[0]
  if (file) {
    emit('select-image', { target: { files: [file] } })
  }
}
</script>

<style scoped>
.upload-zone {
  border: 1.5px dashed rgba(15, 23, 42, 0.16);
  background: rgba(15, 23, 42, 0.02);
}
</style>
