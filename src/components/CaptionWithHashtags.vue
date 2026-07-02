<template>
  <span>
    <template v-for="(part, index) in parts" :key="index">
      <router-link
        v-if="part.tag"
        :to="`/tag/${encodeURIComponent(part.tag)}`"
        class="hashtag-link text-primary text-weight-medium"
        @click.stop
      >
        #{{ part.label }}
      </router-link>
      <span v-else>{{ part.text }}</span>
    </template>
  </span>
</template>

<script setup>
import { computed } from 'vue'
import { normalizeHashtags } from 'src/services/nostrRelay'

const props = defineProps({
  text: {
    type: String,
    default: '',
  },
})

const parts = computed(() => {
  const text = String(props.text || '')
  const hashtagPattern = /(^|\s)#([\p{L}\p{N}_-]+)/gu
  const nextParts = []
  let lastIndex = 0
  let match

  while ((match = hashtagPattern.exec(text))) {
    const prefix = match[1] || ''
    const tagLabel = match[2] || ''
    const hashIndex = match.index + prefix.length

    if (hashIndex > lastIndex) {
      nextParts.push({ text: text.slice(lastIndex, hashIndex) })
    }

    const normalized = normalizeHashtags([tagLabel])[0]
    if (normalized) {
      nextParts.push({ tag: normalized, label: tagLabel })
    } else {
      nextParts.push({ text: `#${tagLabel}` })
    }

    lastIndex = hashIndex + tagLabel.length + 1
  }

  if (lastIndex < text.length) {
    nextParts.push({ text: text.slice(lastIndex) })
  }

  return nextParts.length ? nextParts : [{ text }]
})
</script>

<style scoped>
.hashtag-link {
  text-decoration: none;
}

.hashtag-link:hover {
  text-decoration: underline;
}
</style>
