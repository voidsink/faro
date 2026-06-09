<template>
  <q-layout view="lHh Lpr lFf" class="app-shell">
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
</style>
