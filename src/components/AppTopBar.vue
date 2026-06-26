<template>
  <q-card flat bordered class="faro-surface q-mb-md">
    <q-toolbar class="toolbar q-px-md">
      <q-toolbar-title class="brand-title">Faro</q-toolbar-title>

      <div class="nav-actions row items-center no-wrap q-gutter-sm">
        <q-btn flat round icon="home" aria-label="Home" to="/" />
        <q-btn flat round icon="add_box" aria-label="New post" to="/new" />
        <q-btn flat round icon="settings" aria-label="Settings" to="/settings" />
        <q-btn flat round aria-label="Profile" to="/profile">
          <user-avatar
            size="32px"
            :name="displayName"
            :pubkey="identity?.pubkey"
            :picture="activeProfile.picture"
          />
        </q-btn>
        <q-btn
          flat
          round
          icon="refresh"
          :loading="refreshing"
          aria-label="Refresh"
          @click="$emit('refresh')"
        />
      </div>
    </q-toolbar>
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
    default: () => ({}),
  },
  displayName: {
    type: String,
    default: 'Faro user',
  },
  refreshing: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['refresh'])
</script>

<style scoped>
.toolbar {
  min-height: 56px;
}

.brand-title {
  font-size: 1.4rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}
</style>
