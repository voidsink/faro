<template>
  <q-dialog :model-value="modelValue" persistent transition-show="jump-down" transition-hide="jump-up">
    <q-card class="anonymous-feed-dialog faro-surface">
      <q-card-section class="anonymous-feed-header">
        <div class="anonymous-feed-mark row items-center justify-center" aria-hidden="true">
          <q-icon name="public" size="25px" />
        </div>
        <div class="anonymous-feed-eyebrow">Faro on Nostr</div>
        <h1 class="anonymous-feed-title">The global feed is unfiltered</h1>
        <p class="anonymous-feed-copy">
          Faro reads public posts from Nostr relays. You may see anything those relays return.
        </p>
      </q-card-section>

      <q-card-section class="anonymous-feed-actions">
        <div class="anonymous-feed-prompt">Choose how you want to begin</div>
        <q-btn
          unelevated
          color="dark"
          no-caps
          class="anonymous-feed-primary"
          icon-right="arrow_forward"
          label="Show the global feed"
          @click="emit('show-feed')"
        />
        <q-btn
          outline
          color="dark"
          no-caps
          class="anonymous-feed-secondary"
          icon="person_add"
          label="Don’t show — I’ll follow people"
          @click="emit('follow-people')"
        />
      </q-card-section>

      <div class="anonymous-feed-footnote">
        Following people gives you a feed shaped by accounts you choose.
      </div>
    </q-card>
  </q-dialog>
</template>

<script setup>
defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['show-feed', 'follow-people'])
</script>

<style scoped>
.anonymous-feed-dialog {
  width: min(92vw, 520px);
  overflow: hidden;
  border-radius: 28px;
}

.anonymous-feed-header {
  padding: 30px 32px 26px;
  background:
    radial-gradient(circle at 100% 0%, rgba(255, 153, 95, 0.2), transparent 42%),
    #fffaf5;
}

.anonymous-feed-mark {
  width: 48px;
  height: 48px;
  margin-bottom: 22px;
  border-radius: 16px;
  background: #241b18;
  color: #fffaf5;
}

.anonymous-feed-eyebrow {
  margin-bottom: 8px;
  color: #8a4c29;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.anonymous-feed-title {
  max-width: 390px;
  margin: 0;
  color: #241b18;
  font-size: clamp(1.7rem, 5vw, 2.2rem);
  font-weight: 700;
  letter-spacing: -0.045em;
  line-height: 1.05;
}

.anonymous-feed-copy {
  max-width: 405px;
  margin: 16px 0 0;
  color: #655b55;
  font-size: 0.98rem;
  line-height: 1.55;
}

.anonymous-feed-actions {
  display: grid;
  gap: 10px;
  padding: 24px 32px 28px;
}

.anonymous-feed-prompt {
  margin-bottom: 2px;
  color: #6d625b;
  font-size: 0.78rem;
  font-weight: 700;
}

.anonymous-feed-primary,
.anonymous-feed-secondary {
  width: 100%;
  min-height: 52px;
  border-radius: 14px;
  font-weight: 700;
  letter-spacing: 0;
}

.anonymous-feed-secondary {
  background: #fff;
}

.anonymous-feed-footnote {
  padding: 14px 32px 18px;
  border-top: 1px solid rgba(36, 27, 24, 0.08);
  color: #8a8079;
  font-size: 0.78rem;
  line-height: 1.45;
}

@media (max-width: 420px) {
  .anonymous-feed-header,
  .anonymous-feed-actions {
    padding-right: 22px;
    padding-left: 22px;
  }

  .anonymous-feed-footnote {
    padding-right: 22px;
    padding-left: 22px;
  }
}
</style>
