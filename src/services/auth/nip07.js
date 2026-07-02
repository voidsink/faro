const HEX64_PATTERN = /^[0-9a-f]{64}$/i

export function hasNip07Signer(win = globalThis.window) {
  return Boolean(win?.nostr?.getPublicKey && win?.nostr?.signEvent)
}

export async function getNip07Pubkey(win = globalThis.window) {
  if (!hasNip07Signer(win)) {
    throw new Error('No browser signer detected.')
  }
  return win.nostr.getPublicKey()
}

function nip07LoginProbeEvent() {
  return {
    kind: 27235,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['u', globalThis.location?.origin || 'faro'],
      ['method', 'GET'],
    ],
    content: 'Faro login check: confirm the active browser signer identity.',
  }
}

export async function loginWithNip07(win = globalThis.window) {
  if (!hasNip07Signer(win)) {
    throw new Error('No browser signer detected.')
  }

  const fallbackPubkey = await getNip07Pubkey(win)
  const signedProbe = await win.nostr.signEvent(nip07LoginProbeEvent())
  const pubkey = HEX64_PATTERN.test(signedProbe?.pubkey || '') ? signedProbe.pubkey : fallbackPubkey
  return { pubkey, source: 'nip07' }
}

export function nip07Signer(win = globalThis.window) {
  if (!hasNip07Signer(win)) return null
  return win.nostr
}
