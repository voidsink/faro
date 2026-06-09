<template>
  <q-page class="faro-page">
    <div class="faro-page-inner">
      <q-card flat bordered class="faro-surface q-pa-lg">
        <div class="row items-start justify-between q-gutter-md">
          <div class="row items-center q-gutter-md">
            <user-avatar
              size="82px"
              :name="displayName"
              :pubkey="identity?.pubkey"
              :picture="profile.picture"
            />
            <div>
              <h1 class="q-ma-none">{{ displayName }}</h1>
              <p class="q-ma-none text-blue-grey-6">
                {{ profile.nip05 || shortKey(identity?.pubkey || '') || 'Nostr profile' }}
              </p>
              <p v-if="profile.about" class="bio q-mt-sm q-mb-none text-blue-grey-6">{{ profile.about }}</p>
            </div>
          </div>
          <div class="row q-gutter-sm">
            <q-btn flat round icon="home" aria-label="Home" to="/" />
            <q-btn
              unelevated
              color="dark"
              no-caps
              :label="following ? 'Following' : 'Follow'"
              @click="following = !following"
            />
          </div>
        </div>
      </q-card>

      <div v-if="posts.length" class="photo-grid q-mt-md">
        <q-card
          v-for="post in posts"
          :key="post.id"
          flat
          bordered
          class="faro-surface photo-card full-width overflow-hidden q-mb-md"
        >
          <q-img :src="post.image" :alt="post.caption || 'Posted photo'" fit="cover" />
          <q-card-section v-if="post.caption" class="caption text-blue-grey-6">
            {{ post.caption }}
          </q-card-section>
        </q-card>
      </div>

      <q-card
        v-else
        flat
        bordered
        class="faro-surface column flex-center text-blue-grey-6 q-gutter-sm q-pa-xl q-mt-md"
      >
        <q-icon name="photo_camera" size="36px" />
        <p class="q-ma-none">No posted photos yet.</p>
      </q-card>
    </div>
  </q-page>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import UserAvatar from 'components/UserAvatar.vue'
import { useSessionStore } from 'src/stores/session-store'

const session = useSessionStore()
const { identity, activeProfile: profile, displayName, userPosts: posts } = storeToRefs(session)

const following = ref(false)

onMounted(() => {
  session.init()
})

function shortKey(pubkey = '') {
  return session.shortKey(pubkey)
}
</script>

<style scoped>
h1 {
  font-size: 1.7rem;
  font-weight: 900;
}

.bio {
  max-width: 520px;
  line-height: 1.45;
}

.photo-grid {
  column-count: 2;
  column-gap: 14px;
}

.photo-card {
  display: inline-block;
  break-inside: avoid;
}

.caption {
  line-height: 1.45;
  white-space: pre-wrap;
}

@media (max-width: 700px) {
  .photo-grid {
    column-count: 2;
    column-gap: 8px;
  }
}
</style>
