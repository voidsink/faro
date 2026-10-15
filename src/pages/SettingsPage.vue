<template>
  <q-page class="faro-page">
    <div class="faro-page-inner settings-content">
      <q-card flat bordered class="faro-surface q-pa-lg">
        <div class="row items-center justify-between q-mb-lg">
          <div>
            <h1 class="q-ma-none">Settings</h1>
            <p class="q-ma-none faro-muted">
              Preferences and account controls for portable Nostr publishing.
            </p>
          </div>
          <q-btn flat round icon="home" aria-label="Home" to="/" />
        </div>

        <q-banner v-if="message" rounded dense class="faro-warning q-mb-md">
          {{ message }}
        </q-banner>

        <q-list separator>
          <q-item class="settings-row">
            <q-item-section avatar><q-icon name="contrast" /></q-item-section>
            <q-item-section>
              <q-item-label class="text-weight-bold">Appearance</q-item-label>
              <q-item-label caption class="faro-muted"
                >Follow your device or choose a theme for this browser.</q-item-label
              >
              <q-select
                color="accent"
                :model-value="theme.preference"
                :options="themeOptions"
                emit-value
                map-options
                outlined
                dense
                class="faro-input q-mt-sm"
                label="Theme"
                @update:model-value="theme.setPreference"
              />
            </q-item-section>
          </q-item>
          <q-item class="settings-row">
            <q-item-section avatar>
              <q-icon name="cloud_upload" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Media storage</q-item-label>
              <q-item-label caption class="faro-muted">
                Your photos are uploaded to the first available server in this list. Use a server
                that allows uploads from your browser.
              </q-item-label>
              <q-input
                color="accent"
                v-model="draftBlossomServers"
                outlined
                dense
                autogrow
                class="faro-input q-mt-sm relay-input"
                label="Blossom server URLs"
                placeholder="https://cdn.nostrverse.net"
                hint="One URL per line or separated by commas."
              />
              <div class="row q-gutter-xs q-mt-sm">
                <q-btn-dropdown flat dense no-caps color="accent" label="Add default server">
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
                <q-btn
                  flat
                  dense
                  no-caps
                  color="accent"
                  label="Reset defaults"
                  @click="resetBlossomServers"
                />
              </div>
            </q-item-section>
            <q-item-section side>
              <q-btn unelevated dense no-caps color="primary" label="Save" @click="saveServers" />
            </q-item-section>
          </q-item>

          <q-item class="settings-row">
            <q-item-section avatar>
              <q-icon name="dns" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Relays</q-item-label>
              <q-item-label caption class="faro-muted">
                Used for profile, following, feed reads, and publishing. Faro falls back to defaults
                if this is empty or invalid.
              </q-item-label>
              <q-input
                color="accent"
                v-model="draftRelays"
                outlined
                dense
                autogrow
                class="faro-input q-mt-sm relay-input"
                label="Relay URLs"
                hint="One URL per line or separated by commas."
              />
              <div class="row q-gutter-xs q-mt-sm">
                <q-btn
                  flat
                  dense
                  no-caps
                  color="accent"
                  label="Reset defaults"
                  @click="resetRelays"
                />
              </div>
            </q-item-section>
            <q-item-section side>
              <q-btn
                unelevated
                dense
                no-caps
                color="primary"
                label="Save"
                @click="saveRelaySettings"
              />
            </q-item-section>
          </q-item>

          <q-item class="settings-row">
            <q-item-section avatar>
              <q-icon name="tag" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Follow hashtags</q-item-label>
              <q-item-label caption class="faro-muted">
                Add topics like #bitcoin or photography. Faro mixes matching visual posts into your
                feed alongside people you follow.
              </q-item-label>
              <q-input
                color="accent"
                v-model="draftHashtags"
                outlined
                dense
                autogrow
                class="faro-input q-mt-sm relay-input"
                label="Hashtags"
                placeholder="#bitcoin\n#photography"
                hint="One per line, comma, or space. # is optional."
                :disable="!session.identity"
              />
            </q-item-section>
            <q-item-section side>
              <q-btn
                unelevated
                dense
                no-caps
                color="primary"
                label="Save"
                :disable="!session.identity"
                @click="saveHashtagSettings"
              />
            </q-item-section>
          </q-item>

          <q-item v-if="session.secretKey">
            <q-item-section>
              <q-item-label>Private key backup</q-item-label>
              <q-item-label caption class="faro-muted"
                >Your key is kept for this session only. Back it up before reloading or signing
                out.</q-item-label
              >
            </q-item-section>
            <q-item-section side
              ><q-btn
                outline
                no-caps
                color="accent"
                label="Back up key"
                @click="session.keyBackupRequired = true"
            /></q-item-section>
          </q-item>
          <q-item
            tag="a"
            href="https://github.com/voidsink/faro"
            target="_blank"
            rel="noopener noreferrer"
            clickable
          >
            <q-item-section avatar><q-icon name="code" /></q-item-section>
            <q-item-section
              ><q-item-label>Faro is open source</q-item-label
              ><q-item-label caption class="faro-muted"
                >Read the code, report a bug, or contribute.</q-item-label
              ></q-item-section
            >
            <q-item-section side><q-icon name="open_in_new" /></q-item-section>
          </q-item>
        </q-list>
      </q-card>
    </div>
  </q-page>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useThemeStore } from 'src/stores/theme-store'
import { useSessionStore } from 'src/stores/session-store'
import {
  DEFAULT_BLOSSOM_SERVERS,
  loadBlossomServers,
  normalizeBlossomServers,
  saveBlossomServers,
} from 'src/services/blossom'
import { DEFAULT_RELAYS, loadRelays, saveRelays } from 'src/services/nostrRelay'

const session = useSessionStore()
const theme = useThemeStore()
const themeOptions = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
]
const defaultBlossomServers = DEFAULT_BLOSSOM_SERVERS
const draftBlossomServers = ref('')
const draftRelays = ref('')
const draftHashtags = ref('')
const message = ref('')

onMounted(() => {
  session.init()
  draftBlossomServers.value = loadBlossomServers().join('\n')
  draftRelays.value = loadRelays().join('\n')
  draftHashtags.value = session.followedHashtags.map((tag) => `#${tag}`).join('\n')
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

function saveHashtagSettings() {
  const tags = session.updateFollowedHashtags(draftHashtags.value)
  draftHashtags.value = tags.map((tag) => `#${tag}`).join('\n')
  message.value = `Hashtag settings saved: ${tags.length} tag${tags.length === 1 ? '' : 's'}. Refreshing feed…`
  session.refreshFromNostr({ silent: true })
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

.relay-input {
  padding-bottom: 0;
}

.relay-input :deep(.q-field__bottom) {
  position: relative;
  transform: none;
  padding-left: 0;
  padding-right: 0;
}

@media (max-width: 599px) {
  .settings-content > .q-card {
    padding: 20px;
  }

  .settings-row {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
    padding: 20px 0;
  }

  .settings-row > .q-item__section--avatar {
    display: none;
  }

  .settings-row > .q-item__section--main {
    margin-left: 0;
  }

  .settings-row > .q-item__section--side {
    padding-left: 0;
    align-items: flex-end;
  }
}
</style>
