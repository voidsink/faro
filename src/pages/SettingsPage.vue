<template>
  <q-page class="faro-page">
    <div class="faro-page-inner settings-content">
      <q-card flat bordered class="faro-surface q-pa-lg">
        <div class="row items-center justify-between q-mb-lg">
          <div>
            <h1 class="q-ma-none">Settings</h1>
            <p class="q-ma-none text-blue-grey-6">Preferences and account controls will live here.</p>
          </div>
          <q-btn flat round icon="home" aria-label="Home" to="/" />
        </div>

        <q-list separator>
          <q-item>
            <q-item-section avatar>
              <q-icon name="notifications" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Notifications</q-item-label>
              <q-item-label caption>Reaction, reply, and relay activity settings.</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-toggle disable />
            </q-item-section>
          </q-item>

          <q-item>
            <q-item-section avatar>
              <q-icon name="dns" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Relays</q-item-label>
              <q-item-label caption>Default relay list and connection health.</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-btn flat dense no-caps label="Soon" />
            </q-item-section>
          </q-item>

          <q-item>
            <q-item-section avatar>
              <q-icon name="cloud_upload" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Media storage</q-item-label>
              <q-item-label caption>Blossom server discovery, upload, and mirroring.</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-btn flat dense no-caps label="Soon" />
            </q-item-section>
          </q-item>
        </q-list>
      </q-card>
    </div>
  </q-page>
</template>

<style scoped>
.settings-content {
  --faro-page-max: 860px;
}

h1 {
  font-size: 1.7rem;
  font-weight: 900;
}
</style>
