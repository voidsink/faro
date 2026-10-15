# Faro

A photo-first social app built on Nostr. Bring your identity and follows, publish photos to your own relays, and discover people through shared topics.

[Try Faro](https://faro-nostr.netlify.app/) · [Report an issue](https://github.com/voidsink/faro/issues)

## What works

- Picture publishing with NIP-68 kind 20 events and Blossom media uploads.
- Visual feeds reading image and video posts from kinds 1, 20, 21 and 22.
- Browser signers (NIP-07), remote signers (NIP-46 / QR), Pomegranate Google sign-in, and session-only private keys.
- Real Nostr follows, hashtag feeds, public profile editing, likes and comments.
- Photo grids, multi-image posts, shareable post URLs and mobile navigation.
- Browser-only local drafts, configurable relays and media servers.

Faro is early software. Zaps, bookmarks, notifications, direct messages, and advanced moderation are not implemented. Profile images currently use URLs; the composer uploads one photo per post. Nostr feeds are public and unmoderated. Content warnings are respected when authors supply them; untagged content can still appear.

## Run locally

Use Node.js 22.12+ (or a supported newer LTS) and npm.

```sh
npm ci
npm run dev
```

The development server prints its local address. No backend, API key or paid service is required. Networked features need accessible Nostr relays and a Blossom server that accepts browser uploads.

```sh
npm run lint
npm test
npm run build
```

The production SPA is written to `dist/spa`. Serve that directory on any static host. Routes use URL hashes, so no server-side route rewrites are required. Pushing this repository's `main` branch triggers its Netlify deployment.

## Browser checks

Playwright is already a development dependency. Install its browser once, then run the mocked UI tests:

```sh
npx playwright install chromium
npm run test:ui
```

If Chromium is already installed elsewhere, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable. The tests intercept relay traffic and media uploads; they never publish to real relays. They cover mobile navigation and consent, post detail, rejected comments, following, profile editing, key backup, composing, publishing and relay outages.

## Your keys and data

Prefer a browser or remote signer for an existing account. Keys created or imported in Faro stay in memory and are lost on reload or sign-out. A new account requires a backup acknowledgement; the backup dialog can also be opened from Settings. Never share your nsec.

Remote-signer connection credentials are stored in this browser so Faro can reconnect. Local drafts and relay caches also use browser storage. Clearing site data removes them. Hashtag preferences are local to this browser and account; people follows and profile edits are published to Nostr.

Publishing uploads the image to an external media server and sends the signed event to your relays. These are public copies outside Faro's control. A successful publish means at least one configured relay accepted the event; it does not guarantee every other client can retrieve it.

## Contribute

Small, focused contributions are welcome. Open an issue with the affected flow, expected behavior, browser/device, and reproducible steps. Never include private keys or remote-signer credentials.

The app uses Vue 3, Quasar, Pinia and nostr-tools. Pages live in `src/pages`, reusable UI in `src/components`, Nostr/media/auth code in `src/services`, and account/feed state in `src/stores/session-store.js`. Follow the existing patterns, avoid new dependencies for small helpers, add focused coverage for behavior changes, and run lint, unit tests and a production build. Run browser checks for navigation, composing or feed changes.

Licensed under [MIT](LICENSE).
