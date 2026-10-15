import { defineBoot } from '#q-app/wrappers'
import { useThemeStore } from 'src/stores/theme-store'

export default defineBoot(({ store }) => {
  useThemeStore(store).applyPreference()
})
