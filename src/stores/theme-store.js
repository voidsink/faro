import { defineStore } from 'pinia'
import { Dark } from 'quasar'

const preferences = ['system', 'light', 'dark']
const storageKey = 'faro-theme'

function savedPreference() {
  try {
    const saved = localStorage.getItem(storageKey)
    return preferences.includes(saved) ? saved : 'system'
  } catch {
    return 'system'
  }
}

export const useThemeStore = defineStore('theme', {
  state: () => ({ preference: savedPreference() }),
  actions: {
    applyPreference() {
      Dark.set(this.preference === 'system' ? 'auto' : this.preference === 'dark')
    },
    setPreference(preference) {
      if (!preferences.includes(preference)) return
      this.preference = preference
      this.applyPreference()
      try {
        localStorage.setItem(storageKey, preference)
      } catch {
        // Theme changes still work when browser storage is unavailable.
      }
    },
  },
})
