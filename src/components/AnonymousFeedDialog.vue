<template>
  <q-dialog
    :model-value="modelValue"
    persistent
    transition-show="jump-down"
    transition-hide="jump-up"
  >
    <q-card class="anonymous-feed-dialog faro-surface">
      <q-card-section class="q-pa-lg">
        <q-avatar rounded size="48px" class="faro-warning faro-link q-mb-lg" icon="public" />
        <div class="text-overline faro-link">Faro on Nostr</div>
        <h1 class="text-h5 text-weight-bold q-mt-xs q-mb-md">The global feed is unfiltered</h1>
        <p class="text-body2 faro-muted q-mb-none">
          Faro reads public posts from Nostr relays. You may see anything those relays return.
        </p>
      </q-card-section>
      <q-card-section class="column q-gutter-sm q-px-lg q-pt-none q-pb-lg">
        <div class="text-caption text-weight-medium faro-muted">Choose how you want to begin</div>
        <q-btn
          unelevated
          color="primary"
          no-caps
          icon-right="arrow_forward"
          label="Show the global feed"
          @click="emit('show-feed')"
        />
        <q-btn
          outline
          color="accent"
          no-caps
          icon="person_add"
          label="Don’t show — I’ll follow people"
          @click="emit('follow-people')"
        />
      </q-card-section>
      <q-separator />
      <q-card-section class="text-caption faro-muted q-px-lg">
        Following people gives you a feed shaped by accounts you choose.
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup>
defineProps({ modelValue: { type: Boolean, default: false } })
const emit = defineEmits(['show-feed', 'follow-people'])
</script>

<style scoped>
.anonymous-feed-dialog {
  width: min(92vw, 480px);
}
</style>
