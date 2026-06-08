<template>
  <q-layout view="lHh Lpr lFf" class="app-shell">
    <q-header class="app-header" bordered>
      <q-toolbar class="container toolbar">
        <div class="brand-mark">F</div>
        <q-toolbar-title class="brand-title">
          Faro
          <span>Nostr Visual</span>
        </q-toolbar-title>
        <q-badge outline color="deep-orange-5" class="demo-badge">local demo</q-badge>
      </q-toolbar>
    </q-header>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<style scoped>
.app-shell {
  background:
    radial-gradient(circle at 12% 0%, rgba(255, 128, 92, 0.2), transparent 28%),
    linear-gradient(180deg, #fff8ef 0%, #f6eee8 46%, #f9f5f0 100%);
  color: #241b18;
}

.app-header {
  background: rgba(255, 250, 244, 0.84);
  color: #241b18;
  backdrop-filter: blur(18px);
}

.container {
  width: min(100%, 920px);
  margin: 0 auto;
}

.toolbar {
  min-height: 62px;
  padding: 0 14px;
}

.brand-mark {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: 15px;
  background: linear-gradient(135deg, #7f44ff, #ff805c 58%, #ffc46b);
  color: white;
  font-weight: 950;
  box-shadow: 0 10px 22px rgba(160, 76, 50, 0.22);
}

.brand-title {
  display: grid;
  font-size: 1.08rem;
  font-weight: 900;
  letter-spacing: -0.04em;
  line-height: 1.05;
}

.brand-title span {
  color: #8b756c;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.demo-badge {
  border-radius: 999px;
  padding: 5px 9px;
  text-transform: uppercase;
  font-size: 0.66rem;
  letter-spacing: 0.08em;
}
</style>
