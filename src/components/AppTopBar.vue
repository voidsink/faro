<template>
  <q-card flat bordered class="faro-surface q-mb-md">
    <q-toolbar class="toolbar q-px-md q-gutter-x-sm">
      <q-toolbar-title class="brand-block column no-wrap">
        <div class="brand-title">Faro</div>
        <div class="q-mt-xs text-caption text-blue-grey-6 text-weight-bold">
          Your visual social graph, carried by Nostr.
        </div>
      </q-toolbar-title>

      <div class="nav-actions row items-center no-wrap q-gutter-xs q-ml-auto">
        <q-btn flat round icon="home" aria-label="Home" to="/">
          <q-tooltip>Home</q-tooltip>
        </q-btn>
        <q-btn flat round icon="add_box" aria-label="New post" to="/new">
          <q-tooltip>New post</q-tooltip>
        </q-btn>
        <q-btn flat round icon="notifications" aria-label="Notifications">
          <q-tooltip>Notifications</q-tooltip>
        </q-btn>
        <q-btn flat round icon="settings" aria-label="Settings" to="/settings">
          <q-tooltip>Settings</q-tooltip>
        </q-btn>
        <q-btn flat round aria-label="Profile" to="/profile">
          <user-avatar
            size="32px"
            :name="displayName"
            :pubkey="identity?.pubkey"
            :picture="activeProfile.picture"
          />
          <q-tooltip>Profile</q-tooltip>
        </q-btn>
        <q-btn
          flat
          round
          icon="refresh"
          :loading="refreshing"
          aria-label="Refresh Nostr data"
          @click="$emit('refresh')"
        >
          <q-tooltip>Refresh Nostr data</q-tooltip>
        </q-btn>
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
  min-height: 76px;
}

.brand-block {
  min-width: 0;
  line-height: 1.1;
}

.brand-title {
  color: #161311;
  font-family: var(--faro-font-heading);
  font-size: 1.55rem;
  font-weight: 900;
  letter-spacing: 0;
}

@media (max-width: 700px) {
  .toolbar {
    min-height: 92px;
    flex-wrap: wrap;
    padding-bottom: 10px;
    padding-top: 10px;
  }

  .brand-block {
    flex-basis: 100%;
  }

  .nav-actions {
    width: 100%;
    overflow-x: auto;
  }
}
</style>
