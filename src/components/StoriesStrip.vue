<template>
  <q-card flat bordered class="faro-surface stories-strip row no-wrap q-gutter-md q-pa-md">
    <div class="story your-story column items-center text-center q-gutter-xs">
      <user-avatar
        size="58px"
        :name="displayName"
        :pubkey="identity?.pubkey"
        :picture="activeProfile.picture"
      />
      <span class="text-caption faro-muted">Your story</span>
    </div>

    <div
      v-for="person in profiles"
      :key="person.pubkey"
      class="story column items-center text-center q-gutter-xs"
    >
      <user-avatar
        size="58px"
        :name="person.name"
        :pubkey="person.pubkey"
        :picture="person.picture"
      />
      <span class="text-caption faro-muted">{{ person.name }}</span>
    </div>
  </q-card>
</template>

<script setup>
import UserAvatar from 'components/UserAvatar.vue'

defineProps({
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
  profiles: {
    type: Array,
    default: () => [],
  },
})
</script>

<style scoped>
.stories-strip {
  overflow-x: auto;
}

.story {
  min-width: 68px;
  line-height: 1.4;
}

.story :deep(.q-avatar) {
  padding: 2px;
  border: 2px solid var(--faro-link);
  box-shadow: inset 0 0 0 3px var(--faro-surface-bg);
}

.your-story :deep(.q-avatar) {
  border-color: var(--faro-surface-border);
}
</style>
