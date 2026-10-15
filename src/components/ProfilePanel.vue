<template>
  <q-card flat bordered class="faro-surface overflow-hidden" data-testid="profile-card">
    <div class="profile-cover faro-muted-surface">
      <q-img
        v-if="activeProfile.banner"
        :src="activeProfile.banner"
        alt="Profile cover"
        fit="cover"
        class="fit"
      />
    </div>

    <div class="relative-position q-px-md q-pb-md">
      <div class="profile-avatar-wrap">
        <user-avatar
          size="88px"
          :name="displayName"
          :pubkey="identity?.pubkey"
          :picture="activeProfile.picture"
          button
          class="profile-avatar faro-surface-bg"
        />
      </div>

      <div class="profile-identity">
        <q-item-label class="text-h6 text-weight-bold line-height-tight">
          {{ identity ? displayName : 'Not logged in' }}
        </q-item-label>
        <q-item-label caption class="faro-muted">
          {{ identity ? profileSubtitle : 'Connect a signer to post.' }}
        </q-item-label>
      </div>

      <div class="row items-center q-col-gutter-md q-mt-md">
        <div class="col-auto text-center">
          <div class="text-weight-bold text-body2">{{ followingCount }}</div>
          <div class="text-caption faro-muted">Following</div>
        </div>
        <div class="col-auto text-center">
          <div class="text-weight-bold text-body2">{{ postsCount }}</div>
          <div class="text-caption faro-muted">Posts</div>
        </div>
        <div class="col-auto text-center">
          <div class="text-weight-bold text-body2">{{ relaysCount }}</div>
          <div class="text-caption faro-muted">Relays</div>
        </div>
        <div class="col-auto text-center">
          <div class="text-weight-bold text-body2">{{ hashtagsCount }}</div>
          <div class="text-caption faro-muted">Tags</div>
        </div>
      </div>

      <div class="column q-mt-md q-gutter-sm">
        <q-badge outline class="self-start text-weight-medium faro-muted" :label="authLabel" />
        <q-btn
          v-if="!identity"
          unelevated
          color="primary"
          no-caps
          label="Sign in"
          data-testid="open-login"
          @click="$emit('open-login')"
        />
        <q-btn
          v-else
          outline
          color="accent"
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
  hashtagsCount: {
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

.profile-avatar-wrap {
  position: absolute;
  top: -44px;
  left: 16px;
}

.profile-avatar {
  display: block;
}

.profile-identity {
  padding-top: 58px;
}

.line-height-tight {
  line-height: 1.2;
}
</style>
