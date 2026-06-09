<template>
  <q-card flat bordered class="faro-surface stories-strip row no-wrap q-gutter-md q-pa-md">
    <div class="story your-story column items-center text-center q-gutter-xs">
      <user-avatar
        size="58px"
        :name="displayName"
        :pubkey="identity?.pubkey"
        :picture="activeProfile.picture"
      />
      <span class="text-caption text-blue-grey-6">Your story</span>
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
      <span class="text-caption text-blue-grey-6">{{ person.name }}</span>
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
  border: 2px solid #f04b79;
  box-shadow: inset 0 0 0 3px #fff;
}

.your-story :deep(.q-avatar) {
  border-color: #111;
}
</style>
