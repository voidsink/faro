# Faro — current state (2026-10-15)

## Delivery and constraints

- First UI/UX readiness pass completed on `feat/faro-review`, for local merge into `main` at the owner's request.
- Both requested branches are included: `8974403` (NIP-68) is an ancestor of `7b3e85b` (UI polish).
- Do not push. The owner will push `main` when ready; that triggers Netlify deployment.
- Use normal branch prefixes (`feat/`, `fix/`, `chore/`); never `codex/`.

## Completed

- Working mobile routes; person/topic lookup; shareable post pages; working grid navigation.
- Real Nostr follow/unfollow and profile editing, preserving existing metadata.
- Session-only key backup acknowledgement; composer sign-in and unsaved-draft protection; rejected comments retain their text.
- Global-feed reads require consent, retained during navigation; loading/error/retry states and pagination fixes.
- NIP-68 title/media tags and extensionless media support; content warnings hide tagged media in feeds and grids.
- Mobile settings layout, zoom/keyboard accessibility, honest controls, MIT license and contributor/setup documentation.
- One scoped Astra medium review used; no further Astra work requested.

## Validation and next checkpoint

- Lint, unit suite (six files), production build and eight mocked Playwright flows pass. Desktop feed and mobile feed/settings screenshots inspected.
- Browser tests intercept relay writes and media uploads. Live Google/bunker/browser-signer interoperability and real uploads/payments were not exercised.
- Next: owner tests real account/signers/media servers before pushing. Zaps, bookmarks, notifications, DMs and advanced moderation remain unimplemented; publishing currently uploads one photo per post. Public feeds remain unmoderated, and content warnings depend on author tagging.
- Stop condition: verified local commit and merge, clean working tree, both original feature commits reachable from `main`, no push.
