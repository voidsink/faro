<template>
  <q-dialog :model-value="session.keyBackupRequired" persistent>
    <q-card class="faro-surface q-pa-lg" style="width: min(92vw, 520px)">
      <h2 class="text-h6 q-mt-none">Keep your Nostr key safe</h2>
      <p>
        This key is your account. Faro keeps it only until you reload or sign out. Save it in a
        password manager before continuing.
      </p>
      <q-input
        class="faro-input"
        color="accent"
        :model-value="nsec"
        :type="revealed ? 'text' : 'password'"
        outlined
        readonly
        label="Private key (nsec)"
      >
        <template #append>
          <q-btn
            flat
            round
            :icon="revealed ? 'visibility_off' : 'visibility'"
            aria-label="Toggle private key visibility"
            @click="revealed = !revealed"
          />
        </template>
      </q-input>
      <p class="text-caption faro-danger">
        Never share this key. Anyone who has it can control your account.
      </p>
      <q-btn outline no-caps icon="content_copy" label="Copy private key" @click="copyKey" />
      <q-checkbox v-model="saved" class="q-mt-md" label="I saved my key somewhere safe" />
      <q-btn
        unelevated
        no-caps
        color="primary"
        class="full-width q-mt-md"
        label="Continue to Faro"
        :disable="!saved"
        @click="session.keyBackupRequired = false"
      />
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { copyToClipboard } from 'quasar'
import { nsecEncode } from 'nostr-tools/nip19'
import { useSessionStore } from 'src/stores/session-store'
import { notifyError, notifySuccess } from 'src/utils/notify'

const session = useSessionStore()
const saved = ref(false)
const revealed = ref(false)
const nsec = computed(() => (session.secretKey ? nsecEncode(session.secretKey) : ''))
watch(
  () => session.keyBackupRequired,
  () => {
    saved.value = false
    revealed.value = false
  },
)

async function copyKey() {
  try {
    await copyToClipboard(nsec.value)
    notifySuccess('Private key copied. Store it safely, then clear your clipboard.')
  } catch {
    revealed.value = true
    notifyError('Could not copy. Select and save the visible key manually.')
  }
}
</script>
