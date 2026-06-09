<template>
  <q-avatar :size="size" :color="avatarColor" text-color="white" class="user-avatar">
    <q-img v-if="picture" :src="picture" :alt="alt" ratio="1" />
    <span v-else>{{ initials }}</span>
  </q-avatar>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  name: {
    type: String,
    default: '',
  },
  pubkey: {
    type: String,
    default: '',
  },
  picture: {
    type: String,
    default: '',
  },
  size: {
    type: String,
    default: '40px',
  },
})

const alt = computed(() => props.name || 'Profile avatar')

const initials = computed(() => {
  const cleaned = String(props.name).trim()
  if (!cleaned || cleaned === 'Faro user') return '?'
  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
})

const avatarColor = computed(() => {
  const palette = ['indigo-6', 'teal-6', 'deep-orange-5', 'purple-6', 'blue-grey-6', 'pink-6']
  const value = String(props.pubkey || props.name || 'faro')
    .split('')
    .reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return palette[value % palette.length]
})
</script>

<style scoped>
.user-avatar {
  flex: 0 0 auto;
  font-weight: 800;
}
</style>
