export function hasNip07Signer(win = globalThis.window) {
  return Boolean(win?.nostr?.getPublicKey && win?.nostr?.signEvent)
}

export async function getNip07Pubkey(win = globalThis.window) {
  if (!hasNip07Signer(win)) {
    throw new Error('No browser signer detected.')
  }
  return win.nostr.getPublicKey()
}

export async function loginWithNip07(win = globalThis.window) {
  const pubkey = await getNip07Pubkey(win)
  return { pubkey, source: 'nip07' }
}

export function nip07Signer(win = globalThis.window) {
  if (!hasNip07Signer(win)) return null
  return win.nostr
}
