<template>
  <q-layout view="lHh Lpr lFf" class="app-shell">
    <q-page-container>
      <router-view />
    </q-page-container>

    <key-backup-dialog />

    <!-- Instagram-shaped nav: the primary destinations live at the bottom on phones.
         lt-md is Quasar's responsive visibility class (xs/sm only), so desktop keeps
         the right rail and no tab bar. -->
    <q-footer class="faro-tabbar lt-md">
      <q-tabs
        align="justify"
        dense
        no-caps
        active-color="dark"
        indicator-color="transparent"
        class="text-blue-grey-6"
      >
        <q-route-tab name="home" icon="home" label="Home" to="/" exact aria-label="Home" />
        <q-route-tab name="new" icon="add_box" label="Post" to="/new" aria-label="New post" />
        <q-route-tab
          name="profile"
          icon="person"
          label="Profile"
          to="/profile"
          aria-label="Profile"
        />
        <q-route-tab
          name="settings"
          icon="settings"
          label="Settings"
          to="/settings"
          aria-label="Settings"
        />
      </q-tabs>
    </q-footer>
  </q-layout>
</template>

<script setup>
import KeyBackupDialog from 'components/auth/KeyBackupDialog.vue'
</script>

<style scoped>
.app-shell {
  background:
    radial-gradient(circle at 12% 0%, rgba(255, 128, 92, 0.2), transparent 28%),
    linear-gradient(180deg, #fff8ef 0%, #f6eee8 46%, #f9f5f0 100%);
  color: #241b18;
}

.faro-tabbar {
  border-top: 1px solid var(--faro-surface-border);
  background: rgba(255, 253, 250, 0.94);
  backdrop-filter: saturate(160%) blur(12px);
  padding-bottom: env(safe-area-inset-bottom);
}

.faro-tabbar :deep(.q-tab) {
  min-height: 58px;
}

.faro-tabbar :deep(.q-tab__label) {
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.01em;
}
</style>
