const HEX_64 = /^[0-9a-f]{64}$/i

export function isRemoteSignerUrl(input = '') {
  const value = String(input || '').trim()
  return value.startsWith('bunker://') || value.startsWith('nostrconnect://')
}

export function parseRemoteSignerUrl(input = '') {
  const raw = String(input || '').trim()
  if (!isRemoteSignerUrl(raw)) {
    throw new Error('Paste a bunker:// or nostrconnect:// URL.')
  }

  let url
  try {
    url = new URL(raw)
  } catch {
    throw new Error('Invalid bunker URL.')
  }

  const signerPubkey = url.hostname || url.pathname.replace(/^\/+/, '')
  if (!HEX_64.test(signerPubkey)) {
    throw new Error('Bunker URL is missing a valid signer pubkey.')
  }

  const relays = url.searchParams.getAll('relay').filter(Boolean)
  if (!relays.length) {
    throw new Error('Bunker URL needs at least one relay parameter.')
  }

  return {
    type: url.protocol.replace(':', ''),
    signerPubkey,
    relays,
    secret: url.searchParams.get('secret') || '',
    raw,
  }
}
