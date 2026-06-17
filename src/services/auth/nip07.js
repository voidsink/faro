export function hasNip07Signer(win = globalThis.window) {
  return Boolean(win?.nostr?.getPublicKey && win?.nostr?.signEvent)
}

export async function loginWithNip07(win = globalThis.window) {
  if (!hasNip07Signer(win)) {
    throw new Error('No browser signer detected.')
  }
  const pubkey = await win.nostr.getPublicKey()
  return { pubkey, source: 'nip07' }
}

export function nip07Signer(win = globalThis.window) {
  if (!hasNip07Signer(win)) return null
  return win.nostr
}
