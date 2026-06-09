<template>
  <q-card flat bordered class="faro-surface" data-testid="composer-card">
    <q-card-section>
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
          <q-item-label class="text-weight-bold">Add post</q-item-label>
          <q-item-label caption>{{ identity ? displayName : 'Login to unlock posting' }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-btn flat dense round color="negative" icon="delete_sweep" aria-label="Clear local posts" @click="$emit('clear-post-cache')">
            <q-tooltip>Clear local posts</q-tooltip>
          </q-btn>
        </q-item-section>
      </q-item>
    </q-card-section>

    <q-card-section class="q-pt-none">
      <q-banner v-if="!identity" rounded dense class="bg-orange-1 text-brown-8 q-mb-md">
        Login or create a local identity to enable posting.
      </q-banner>

      <input
        ref="imageInput"
        class="hidden"
        type="file"
        accept="image/*"
        data-testid="image-input"
        @change="$emit('select-image', $event)"
      />

      <div class="row items-center q-gutter-sm q-mb-md">
        <q-btn
          unelevated
          color="dark"
          no-caps
          icon="add_photo_alternate"
          label="Add photo"
          data-testid="image-picker"
          @click="openImagePicker"
        />
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

      <div
        v-if="imagePreview"
        class="image-preview overflow-hidden bg-grey-1 q-mx-auto q-mb-md"
        :style="previewFrameStyle"
      >
        <img :src="imagePreview" alt="Selected preview" class="block fit" />
      </div>

      <q-form @submit.prevent="$emit('publish-post')">
        <q-input
          :model-value="caption"
          type="textarea"
          autogrow
          outlined
          placeholder="Caption..."
          data-testid="caption-input"
          @update:model-value="$emit('update:caption', $event)"
        />

        <q-btn
          unelevated
          color="dark"
          class="full-width q-mt-md text-weight-bold"
          no-caps
          :disable="!canPost"
          label="Post locally"
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
.image-preview {
  width: min(100%, calc(58vh * var(--preview-ratio)));
  max-height: 58vh;
  border: 1.5px dashed rgba(0, 0, 0, 0.18);
  border-radius: var(--faro-radius-md);
}

.image-preview img {
  object-fit: contain;
}
</style>
