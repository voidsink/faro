# Faro — current state (2026-10-15)

## Theme refresh

- Implemented on `feat/neutral-purple-themes`. Owner explicitly requested commit, merge into `main`, and push; this supersedes the earlier no-push constraint. A main push triggers Netlify.
- Quasar Dark now applies a persisted System/Light/Dark preference from Settings. No new dependencies.
- Brand/neutral colors live in `src/css/quasar.variables.scss`; semantic light/dark tokens live in `src/css/app.scss`.
- Removed peach/brown shell colors, decorative gradients/default rainbow banner, global Quasar color overrides, unused chart CSS, and redundant carousel/dialog markup. User-provided imagery is preserved.
- Consistent corners, borders, typography, purple actions/links/focus, and neutral surfaces cover feed, profiles, stories, composer, settings, login and onboarding.

## Validation and delivery

- Lint, unit suite (six files), production build and all 22 Playwright checks pass across light and dark modes.
- Checks cover existing social/publishing flows, theme persistence/system changes, keyboard focus, carousel state, text contrast >= 4.5:1 and focus/control boundaries >= 3:1. Test writes/uploads are mocked.
- Matching mobile/desktop screenshots cover feed, profile, composer, settings, login and onboarding. Artifacts: `/home/talvasconcelos/.codex/visualizations/2026/10/15/01a13f4b-0d72-76b2-b88c-044d7d7613cd/faro-themes/screenshots.md`.
- Live auth/upload interoperability and Netlify deployment status were not re-tested by the theme checks.
- Stop condition: reviewed screenshots, verified commit merged/pushed to main, clean working tree, and upstream SHA matches local main.

## Project constraints and known limits

- Use `feat/`, `fix/` or `chore/` branch prefixes; never `codex/`.
- NIP-68 `8974403`, UI polish `7b3e85b`, and core-flow review `54bde56` remain included.
- One scoped Astra medium review was used previously; do not repeat without new authorization.
- Zaps, bookmarks, notifications, DMs and advanced moderation remain unimplemented. Public feeds are unmoderated; content warnings depend on author tagging. Publishing uploads one photo per post.
