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
                Blossom stores image bytes. Faro tries servers in order, so keep 2–3 CORS-friendly servers for redundancy.
              </q-item-label>
              <q-input
                v-model="draftBlossomServers"
                outlined
                dense
                autogrow
                class="q-mt-sm relay-input"
                label="Blossom server URLs"
                placeholder="https://cdn.nostrverse.net"
                hint="One per line or comma-separated. bouquet.slidestr.net currently fails browser CORS."
              />
              <div class="row q-gutter-xs q-mt-sm">
                <q-btn-dropdown flat dense no-caps color="dark" label="Add default server">
                  <q-list dense>
                    <q-item
                      v-for="server in defaultBlossomServers"
                      :key="server"
                      clickable
                      v-close-popup
                      @click="addDefaultBlossomServer(server)"
                    >
                      <q-item-section>{{ server.replace('https://', '') }}</q-item-section>
                    </q-item>
                  </q-list>
                </q-btn-dropdown>
                <q-btn flat dense no-caps color="dark" label="Reset defaults" @click="resetBlossomServers" />
              </div>
            </q-item-section>
            <q-item-section side>
              <q-btn unelevated dense no-caps color="dark" label="Save" @click="saveServers" />
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
              <q-item-label caption>Next step: keep a lightweight subscription open and show “X new posts” instead of auto-jumping the feed.</q-item-label>
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
  loadBlossomServers,
  normalizeBlossomServers,
  saveBlossomServers,
} from 'src/services/blossom'
import { DEFAULT_RELAYS, loadRelays, saveRelays } from 'src/services/nostrRelay'

const defaultBlossomServers = DEFAULT_BLOSSOM_SERVERS
const draftBlossomServers = ref('')
const draftRelays = ref('')
const message = ref('')
const notificationsEnabled = ref(false)

onMounted(() => {
  draftBlossomServers.value = loadBlossomServers().join('\n')
  draftRelays.value = loadRelays().join('\n')
})

function splitLines(value) {
  return String(value || '')
    .split(/[\n, ]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function saveServers() {
  const servers = saveBlossomServers(splitLines(draftBlossomServers.value))
  draftBlossomServers.value = servers.join('\n')
  message.value = `Blossom settings saved: ${servers.length} server${servers.length === 1 ? '' : 's'}.`
}

function addDefaultBlossomServer(server) {
  const servers = normalizeBlossomServers([...splitLines(draftBlossomServers.value), server])
  draftBlossomServers.value = servers.join('\n')
}

function resetBlossomServers() {
  draftBlossomServers.value = DEFAULT_BLOSSOM_SERVERS.join('\n')
  saveServers()
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
