<template>
  <q-card flat bordered class="faro-surface column q-pa-md q-gutter-md">
    <h2 class="text-subtitle1 text-weight-bold q-ma-none">Your feed</h2>

    <p class="faro-muted text-caption">
      {{ followingCount }} following · {{ relayPostsCount }} posts from Nostr ·
      {{ localPostsCount }} local drafts
    </p>

    <strong v-if="suggestedProfiles.length">People to discover</strong>
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
          <q-item-label caption class="faro-muted">{{ shortKey(person.pubkey) }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-btn
            v-if="canFollow"
            flat
            dense
            no-caps
            color="accent"
            label="Follow"
            :loading="publishingFollow"
            @click="$emit('follow', person.pubkey)"
          />
          <q-btn
            v-else
            flat
            dense
            no-caps
            color="accent"
            label="View"
            :to="`/profile/${person.pubkey}`"
          />
        </q-item-section>
      </q-item>
    </q-list>
  </q-card>
</template>

<script setup>
import UserAvatar from 'components/UserAvatar.vue'

defineProps({
  canFollow: Boolean,
  publishingFollow: Boolean,
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

defineEmits(['follow'])
</script>
