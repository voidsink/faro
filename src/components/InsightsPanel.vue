<template>
  <q-card flat bordered class="faro-surface column q-pa-md q-gutter-md">
    <div class="row items-center justify-between">
      <strong>Insights</strong>
      <span class="text-caption text-weight-bold">See More</span>
    </div>

    <p class="text-blue-grey-6 text-caption">
      {{ followingCount }} follows · {{ relayPostsCount }} relays
    </p>

    <div class="bars row items-end q-py-md q-pb-xs q-gutter-sm" aria-hidden="true">
      <i v-for="height in barHeights" :key="height" class="col" :style="{ height: `${height}%` }" />
    </div>

    <strong>Suggestions For You</strong>
    <q-list class="q-mt-sm">
      <q-item v-for="person in suggestedProfiles" :key="person.pubkey" class="q-px-none">
        <q-item-section avatar>
          <user-avatar
            size="34px"
            :name="person.name"
            :pubkey="person.pubkey"
            :picture="person.picture"
          />
        </q-item-section>
        <q-item-section>
          <q-item-label class="text-weight-bold">{{ person.name }}</q-item-label>
          <q-item-label caption>{{ shortKey(person.pubkey) }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-btn flat dense no-caps color="primary" label="Follow" />
        </q-item-section>
      </q-item>
    </q-list>
  </q-card>
</template>

<script setup>
import UserAvatar from 'components/UserAvatar.vue'

defineProps({
  followingCount: {
    type: Number,
    required: true,
  },
  relayPostsCount: {
    type: Number,
    required: true,
  },
  localPostsCount: {
    type: Number,
    required: true,
  },
  suggestedProfiles: {
    type: Array,
    default: () => [],
  },
  shortKey: {
    type: Function,
    required: true,
  },
})

const barHeights = [42, 74, 28, 55, 82, 12, 50]
</script>

<style scoped>
.bars {
  height: 170px;
}

.bars i {
  min-width: 18px;
  border-radius: 8px 8px 0 0;
  background: $primary;
}
</style>
