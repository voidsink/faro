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
                placeholder="https://cdn.nostrverse.net"
                hint="For browser testing, use a server with CORS enabled. bouquet.slidestr.net currently fails browser CORS; try cdn.nostrverse.net, cdn.satellite.earth, or blssm.us."
              />
              <div class="row q-gutter-xs q-mt-sm">
                <q-btn
                  v-for="server in defaultBlossomServers"
                  :key="server"
                  flat
                  dense
                  no-caps
                  color="dark"
                  :label="server.replace('https://', '')"
                  @click="draftBlossomServer = server"
                />
              </div>
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
              <q-item-label caption>
                Used for profile, following, feed reads, and publishing. Faro falls back to defaults if this is empty or invalid.
              </q-item-label>
              <q-input
                v-model="draftRelays"
                outlined
                dense
                autogrow
                class="q-mt-sm relay-input"
                label="Relay URLs"
                hint="One per line or comma-separated. Defaults include Damus, nos.lol, Primal, and nostr.band."
              />
              <div class="row q-gutter-xs q-mt-sm">
                <q-btn flat dense no-caps color="dark" label="Reset defaults" @click="resetRelays" />
              </div>
            </q-item-section>
            <q-item-section side>
              <q-btn unelevated dense no-caps color="dark" label="Save" @click="saveRelaySettings" />
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
              <q-toggle v-model="notificationsEnabled" disable />
            </q-item-section>
          </q-item>
        </q-list>
      </q-card>
    </div>
  </q-page>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import {
  DEFAULT_BLOSSOM_SERVERS,
  loadBlossomServer,
  normalizeBlossomServerUrl,
  saveBlossomServer,
} from 'src/services/blossom'
import { DEFAULT_RELAYS, loadRelays, saveRelays } from 'src/services/nostrRelay'

const defaultBlossomServers = DEFAULT_BLOSSOM_SERVERS
const draftBlossomServer = ref('')
const draftRelays = ref('')
const message = ref('')
const notificationsEnabled = ref(false)

onMounted(() => {
  draftBlossomServer.value = loadBlossomServer()
  draftRelays.value = loadRelays().join('\n')
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

function saveRelaySettings() {
  const relays = saveRelays(draftRelays.value)
  draftRelays.value = relays.join('\n')
  message.value = `Relay settings saved: ${relays.length} relay${relays.length === 1 ? '' : 's'}.`
}

function resetRelays() {
  draftRelays.value = DEFAULT_RELAYS.join('\n')
  saveRelaySettings()
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

.relay-input :deep(textarea) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.82rem;
}
</style>
