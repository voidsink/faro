<template>
  <q-layout view="lHh Lpr lFf" class="app-shell">
    <q-header class="app-header" bordered>
      <q-toolbar class="container toolbar">
        <div class="brand-mark">NV</div>
        <q-toolbar-title class="brand-title">Nostr Visual</q-toolbar-title>
        <q-badge outline color="deep-purple-4" class="demo-badge">local demo</q-badge>
      </q-toolbar>
    </q-header>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<style scoped>
.app-shell {
  background: #f8f5f2;
  color: #241b22;
}

.app-header {
  background: rgba(255, 252, 249, 0.92);
  color: #241b22;
  backdrop-filter: blur(14px);
}

.container {
  width: min(100%, 760px);
  margin: 0 auto;
}

.toolbar {
  min-height: 64px;
  padding: 0 16px;
}

.brand-mark {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: 14px;
  background: linear-gradient(135deg, #7f44ff, #ff6f91);
  color: white;
  font-weight: 800;
  letter-spacing: -0.08em;
}

.brand-title {
  font-size: 1.08rem;
  font-weight: 800;
  letter-spacing: -0.03em;
}

.demo-badge {
  border-radius: 999px;
  padding: 5px 9px;
  text-transform: uppercase;
  font-size: 0.66rem;
  letter-spacing: 0.08em;
}
</style>
