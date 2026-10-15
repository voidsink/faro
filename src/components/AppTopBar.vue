<template>
  <q-card flat bordered class="faro-surface">
    <q-toolbar class="toolbar q-px-md">
      <q-toolbar-title class="q-pa-none">
        <q-btn flat dense no-caps class="brand-title" aria-label="Home" to="/">
          <span class="faro-logo q-mr-xs" aria-hidden="true" />
          faro
        </q-btn>
      </q-toolbar-title>

      <div class="nav-actions row items-center no-wrap q-gutter-sm">
        <q-btn
          v-if="!identity"
          class="gt-sm"
          flat
          round
          icon="settings"
          aria-label="Settings"
          to="/settings"
        />
        <template v-if="identity">
          <q-btn flat round icon="add_box" aria-label="New post" to="/new" />
          <q-btn flat round aria-label="Account menu">
            <q-avatar v-if="activeProfile?.picture">
              <q-img :src="activeProfile.picture" :alt="displayName" ratio="1" />
            </q-avatar>
            <q-avatar
              v-else
              size="32px"
              color="primary"
              text-color="white"
              :icon="!activeProfile?.picture ? 'person' : null"
            >
            </q-avatar>
            <q-menu class="faro-menu" auto-close>
              <q-list style="min-width: 100px">
                <q-item clickable v-close-popup to="/profile" aria-label="Profile">
                  <q-item-section>Profile</q-item-section>
                </q-item>
                <q-item clickable v-close-popup to="/settings" aria-label="Settings">
                  <q-item-section>Settings</q-item-section>
                </q-item>
                <q-item clickable v-close-popup @click="$emit('logout')" aria-label="Sign out">
                  <q-item-section>Sign out</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
        </template>
        <q-btn
          v-else
          unelevated
          no-caps
          color="primary"
          icon="login"
          label="Sign in"
          aria-label="Sign in"
          @click="$emit('open-login')"
        />
      </div>
    </q-toolbar>
  </q-card>
</template>

<script setup>
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
})

defineEmits(['open-login', 'logout'])
</script>

<style scoped>
.faro-logo {
  width: 32px;
  height: 32px;
  background: var(--q-primary);
  mask: url('../assets/faro.svg') center / contain no-repeat;
}

.toolbar {
  min-height: 64px;
}

.brand-title {
  font-size: 1.65rem;
  font-weight: 700;
}
</style>
