const routes = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: '', component: () => import('pages/IndexPage.vue') },
      { path: 'new', component: () => import('pages/NewPostPage.vue') },
      { path: 'profile', component: () => import('pages/ProfilePage.vue') },
      { path: 'profile/:pubkey', component: () => import('pages/ProfilePage.vue') },
      { path: 'tag/:tag', component: () => import('pages/HashtagPage.vue') },
      { path: 'settings', component: () => import('pages/SettingsPage.vue') },
    ],
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
  },
]

export default routes
