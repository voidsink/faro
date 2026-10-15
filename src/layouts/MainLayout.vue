<template>
  <q-layout view="lHh Lpr lFf" class="app-shell">
    <q-page-container>
      <router-view />
    </q-page-container>

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
        <q-tab name="home" icon="home" label="Home" to="/" exact aria-label="Home" />
        <q-tab name="new" icon="add_box" label="Post" to="/new" aria-label="New post" />
        <q-tab name="profile" icon="person" label="Profile" to="/profile" aria-label="Profile" />
      </q-tabs>
    </q-footer>
  </q-layout>
</template>

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
