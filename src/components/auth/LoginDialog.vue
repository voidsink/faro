<template>
  <q-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)">
    <q-card class="login-card faro-surface">
      <q-card-section class="login-header row items-start no-wrap">
        <div class="login-mark column flex-center">F</div>
        <div class="col login-heading-copy">
          <div class="text-h6 text-weight-bold">Sign in to Faro</div>
          <div class="text-body2 text-blue-grey-7">
            Choose the safest login method for how you use Nostr.
          </div>
        </div>
        <q-btn
          flat
          round
          icon="close"
          aria-label="Close login"
          @click="$emit('update:modelValue', false)"
        />
      </q-card-section>

      <q-separator />

      <q-card-section class="login-options">
        <div class="login-option-block">
          <q-btn
            unelevated
            color="dark"
            no-caps
            align="left"
            class="login-option"
            icon="account_circle"
            label="Continue with Google"
            @click="$emit('login-google')"
          >
            <q-tooltip>Google-backed recovery with Pomegranate. Planned next.</q-tooltip>
          </q-btn>
          <div class="option-caption">
            Easiest onboarding once Pomegranate is wired. Creates or recovers a Nostr identity.
          </div>
        </div>

        <div class="login-option-block">
          <q-btn
            outline
            color="dark"
            no-caps
            align="left"
            class="login-option"
            icon="extension"
            :disable="!hasNip07"
            :label="hasNip07 ? 'Browser signer' : 'Browser signer not detected'"
            @click="$emit('login-nip07')"
          />
          <div class="option-caption">Use Alby, nos2x, Flamingo or another NIP-07 extension.</div>
        </div>

        <q-expansion-item
          switch-toggle-side
          label="Other login methods"
          header-class="login-more-header text-weight-bold"
        >
          <div class="login-more-content column q-gutter-md">
            <q-input
              v-model="bunkerValue"
              outlined
              dense
              label="Bunker / NIP-46 URL"
              placeholder="bunker://..."
            >
              <template #after>
                <q-btn
                  dense
                  flat
                  color="dark"
                  label="Connect"
                  @click="$emit('login-bunker', bunkerValue)"
                />
              </template>
            </q-input>

            <q-btn
              outline
              color="dark"
              no-caps
              icon="vpn_key"
              label="Create a new key"
              @click="$emit('create-key')"
            />

            <q-banner rounded dense class="bg-red-1 text-red-10">
              Importing an nsec gives Faro direct access to your private key. Prefer Google, browser
              signer, or bunker if possible. Use a burner key unless you understand the risk.
            </q-banner>
            <q-input
              v-model="nsecValue"
              outlined
              dense
              :type="showNsec ? 'text' : 'password'"
              label="Paste nsec private key"
              placeholder="nsec1..."
            >
              <template #append>
                <q-btn
                  dense
                  flat
                  round
                  :icon="showNsec ? 'visibility_off' : 'visibility'"
                  @click="showNsec = !showNsec"
                />
              </template>
              <template #after>
                <q-btn
                  dense
                  flat
                  color="negative"
                  label="Import"
                  @click="$emit('import-nsec', nsecValue)"
                />
              </template>
            </q-input>
          </div>
        </q-expansion-item>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  hasNip07: {
    type: Boolean,
    default: false,
  },
})

defineEmits([
  'update:modelValue',
  'login-google',
  'login-nip07',
  'login-bunker',
  'create-key',
  'import-nsec',
])

const bunkerValue = ref('')
const nsecValue = ref('')
const showNsec = ref(false)
</script>

<style scoped>
.login-card {
  width: min(92vw, 560px);
  border-radius: 28px;
}

.login-header {
  gap: 18px;
  padding: 26px 28px 22px;
}

.login-heading-copy {
  padding-top: 3px;
}

.login-mark {
  width: 52px;
  height: 52px;
  border-radius: 18px;
  color: white;
  background: linear-gradient(135deg, #ff7a59, #9b5cff);
  font-family: var(--faro-font-heading);
  font-size: 1.45rem;
  font-weight: 900;
}

.login-options {
  display: grid;
  gap: 22px;
  padding: 26px 28px 28px;
}

.login-option-block {
  display: grid;
  gap: 9px;
}

.login-option {
  width: 100%;
  min-height: 52px;
  border-radius: 17px;
  padding: 0 16px;
}

.option-caption {
  max-width: 420px;
  margin-left: 50px;
  color: #64748b;
  font-size: 0.82rem;
  line-height: 1.35;
}

.login-more-content {
  padding: 14px 0 2px;
}

:deep(.login-more-header) {
  min-height: 48px;
  padding: 0 4px;
  border-radius: 16px;
}
</style>
