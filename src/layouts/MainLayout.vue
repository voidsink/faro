<template>
  <q-layout view="lHh Lpr lFf" class="app-shell">
    <q-header class="faro-header">
      <div class="faro-header-inner">
        <app-top-bar
          :identity="identity"
          :active-profile="activeProfile"
          :display-name="displayName"
          @open-login="loginDialogOpen = true"
          @logout="session.logout"
        />
      </div>
    </q-header>

    <login-dialog
      v-model="loginDialogOpen"
      :has-nip07="hasNip07"
      :bunker-loading="session.bunkerLoading"
      @login-google="session.loginWithGoogle"
      @login-nip07="session.loginWithNip07"
      @login-bunker="session.loginWithBunker"
      @create-key="session.createLocalKey"
      @import-nsec="session.importNsec"
    />

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
import { ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import AppTopBar from 'components/AppTopBar.vue'
import LoginDialog from 'components/auth/LoginDialog.vue'
import { useSessionStore } from 'src/stores/session-store'
import KeyBackupDialog from 'components/auth/KeyBackupDialog.vue'

const session = useSessionStore()
const { identity, activeProfile, displayName, hasNip07 } = storeToRefs(session)
const loginDialogOpen = ref(false)
session.init()
watch(identity, (value) => {
  if (value?.pubkey) loginDialogOpen.value = false
})
</script>

<style scoped>
.faro-header {
  background: var(--faro-canvas);
  color: var(--faro-ink);
}

.faro-header-inner {
  width: min(100%, 960px);
  margin: 0 auto;
  padding: 20px 12px 0;
}

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
