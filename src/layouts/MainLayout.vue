<template>
  <q-layout view="lHh Lpr lFf" class="app-shell">
    <q-page-container>
      <router-view />
    </q-page-container>

    <key-backup-dialog />

    <q-footer class="faro-tabbar lt-md">
      <q-tabs
        align="justify"
        dense
        no-caps
        active-color="accent"
        indicator-color="accent"
        class="faro-muted"
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
.faro-tabbar {
  border-top: 1px solid var(--faro-surface-border);
  background: var(--faro-surface-bg);
  color: var(--faro-ink);
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
