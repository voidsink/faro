<template>
  <q-card flat bordered class="faro-surface q-pa-md" data-testid="profile-card">
    <q-item class="q-px-none">
      <q-item-section avatar>
        <user-avatar
          size="48px"
          :name="displayName"
          :pubkey="identity?.pubkey"
          :picture="activeProfile.picture"
        />
      </q-item-section>
      <q-item-section>
        <q-item-label class="text-weight-bold">{{
          identity ? displayName : 'Not logged in'
        }}</q-item-label>
        <q-item-label caption>{{
          identity ? profileSubtitle : 'Connect a signer to post.'
        }}</q-item-label>
      </q-item-section>
    </q-item>

    <div class="column q-mt-md q-gutter-sm">
      <q-badge color="grey-2" text-color="dark" rounded class="self-start" :label="authLabel" />
      <q-btn
        v-if="!identity"
        unelevated
        color="dark"
        no-caps
        label="Sign in"
        data-testid="open-login"
        @click="$emit('open-login')"
      />
      <q-btn
        v-else
        flat
        color="dark"
        no-caps
        icon="logout"
        label="Logout"
        @click="$emit('logout')"
      />
    </div>
  </q-card>
</template>

<script setup>
import UserAvatar from 'components/UserAvatar.vue'

defineProps({
  identity: {
    type: Object,
    default: null,
  },
  activeProfile: {
    type: Object,
    required: true,
  },
  displayName: {
    type: String,
    required: true,
  },
  profileSubtitle: {
    type: String,
    required: true,
  },
  authLabel: {
    type: String,
    required: true,
  },
  hasNip07: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['open-login', 'logout'])
</script>
