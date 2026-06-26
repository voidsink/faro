<template>
  <q-card flat bordered class="faro-surface overflow-hidden" data-testid="profile-card">
    <div class="profile-cover bg-blue-grey-2 relative-position">
      <q-img
        v-if="activeProfile.banner"
        :src="activeProfile.banner"
        alt="Profile cover"
        ratio="3.5"
        class="profile-cover-image"
      />
      <div
        v-else
        class="profile-cover-gradient full-width full-height"
        aria-hidden="true"
      />
    </div>

    <div class="relative-position q-px-md q-pb-md">
      <div class="profile-avatar-wrap">
        <user-avatar
          size="88px"
          :name="displayName"
          :pubkey="identity?.pubkey"
          :picture="activeProfile.picture"
          class="profile-avatar bg-white"
        />
      </div>

      <div class="q-mt-lg">
        <q-item-label class="text-h6 text-weight-bold line-height-tight">
          {{ identity ? displayName : 'Not logged in' }}
        </q-item-label>
        <q-item-label caption class="text-blue-grey-6">
          {{ identity ? profileSubtitle : 'Connect a signer to post.' }}
        </q-item-label>
      </div>

      <div class="row items-center q-col-gutter-md q-mt-md">
        <div class="col-auto text-center">
          <div class="text-weight-bold text-body2">{{ followingCount }}</div>
          <div class="text-caption text-blue-grey-6">Following</div>
        </div>
        <div class="col-auto text-center">
          <div class="text-weight-bold text-body2">{{ postsCount }}</div>
          <div class="text-caption text-blue-grey-6">Posts</div>
        </div>
        <div class="col-auto text-center">
          <div class="text-weight-bold text-body2">{{ relaysCount }}</div>
          <div class="text-caption text-blue-grey-6">Relays</div>
        </div>
      </div>

      <div class="column q-mt-md q-gutter-sm">
        <q-badge
          color="grey-2"
          text-color="dark"
          rounded
          class="self-start text-weight-medium"
          :label="authLabel"
        />
        <q-btn
          v-if="!identity"
          unelevated
          rounded
          color="dark"
          no-caps
          label="Sign in"
          data-testid="open-login"
          @click="$emit('open-login')"
        />
        <q-btn
          v-else
          outline
          rounded
          color="dark"
          no-caps
          icon="logout"
          label="Logout"
          @click="$emit('logout')"
        />
      </div>
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
  followingCount: {
    type: Number,
    default: 0,
  },
  postsCount: {
    type: Number,
    default: 0,
  },
  relaysCount: {
    type: Number,
    default: 0,
  },
})

defineEmits(['open-login', 'logout'])
</script>

<style scoped>
.profile-cover {
  height: 110px;
  min-height: 110px;
}

.profile-cover-image :deep(.q-img__image) {
  background-size: cover;
}

.profile-cover-gradient {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
}

.profile-avatar-wrap {
  position: absolute;
  top: -44px;
  left: 16px;
  padding: 4px;
  border-radius: 50%;
  background: white;
}

.profile-avatar {
  display: block;
}

.line-height-tight {
  line-height: 1.2;
}
</style>
