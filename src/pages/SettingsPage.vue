<template>
  <q-page class="faro-page">
    <div class="faro-page-inner settings-content">
      <q-card flat bordered class="faro-surface q-pa-lg">
        <div class="row items-center justify-between q-mb-lg">
          <div>
            <h1 class="q-ma-none">Settings</h1>
            <p class="q-ma-none text-blue-grey-6">Preferences and account controls for portable Nostr publishing.</p>
          </div>
          <q-btn flat round icon="home" aria-label="Home" to="/" />
        </div>

        <q-banner v-if="message" rounded dense class="faro-warning q-mb-md">
          {{ message }}
        </q-banner>

        <q-list separator>
          <q-item>
            <q-item-section avatar>
              <q-icon name="cloud_upload" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Media storage</q-item-label>
              <q-item-label caption>
                Blossom stores the image bytes. Nostr relays store the signed post that points to them.
              </q-item-label>
              <q-input
                v-model="draftBlossomServer"
                outlined
                dense
                class="q-mt-sm"
                label="Blossom server URL"
                placeholder="https://blossom.example.com"
                hint="Use an HTTP(S) Blossom server you trust. Leave empty to keep local-save fallback only."
              />
            </q-item-section>
            <q-item-section side>
              <q-btn unelevated dense no-caps color="dark" label="Save" @click="saveServer" />
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
        </q-list>
      </q-card>
    </div>
  </q-page>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { loadBlossomServer, normalizeBlossomServerUrl, saveBlossomServer } from 'src/services/blossom'

const draftBlossomServer = ref('')
const message = ref('')

onMounted(() => {
  draftBlossomServer.value = loadBlossomServer()
})

function saveServer() {
  const raw = draftBlossomServer.value.trim()
  const normalized = saveBlossomServer(raw)
  draftBlossomServer.value = normalized

  if (!raw) {
    message.value = 'Blossom server cleared. Publishing will use local-save fallback only.'
    return
  }

  if (!normalizeBlossomServerUrl(raw)) {
    message.value = 'Enter a valid HTTP(S) Blossom server URL.'
    return
  }

  message.value = `Blossom server saved: ${normalized}`
}
</script>

<style scoped>
.settings-content {
  --faro-page-max: 860px;
}

h1 {
  font-size: 1.7rem;
  font-weight: 900;
}
</style>
