const TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000

export const POMEGRANATE_STATUS = 'planned'

export function pomegranateUnavailableMessage() {
  return 'Google login needs the Pomegranate central server and NIP-46 signer wiring. This method is planned next.'
}

export function normalizePomegranateUrl(input = '') {
  const value = String(input || '').trim()
  if (!value) throw new Error('Configure a Pomegranate central server first.')
  const withProtocol = value.startsWith('http') ? value : `https://${value}`
  return new URL(withProtocol).origin
}

export function decodeGoogleToken(raw = '') {
  let parsed
  try {
    parsed = JSON.parse(atob(raw))
  } catch {
    throw new Error('Invalid Google sign-in token.')
  }

  const createdAt = Number(parsed.created_at) * 1000
  if (!Number.isFinite(createdAt) || Date.now() - createdAt > TOKEN_MAX_AGE_MS) {
    throw new Error('Google sign-in token expired, please try again.')
  }

  const emailTag = Array.isArray(parsed.tags)
    ? parsed.tags.find((tag) => Array.isArray(tag) && tag[0] === 'email')
    : null

  return {
    raw,
    email: emailTag?.[1] || '',
    createdAt,
  }
}

export function buildPomegranateBunkerUrl(central, profile) {
  const normalized = normalizePomegranateUrl(central)
  if (!profile?.handler_pubkey) throw new Error('Missing Pomegranate signing profile.')
  return `bunker://${profile.handler_pubkey}?relay=${encodeURIComponent(normalized.replace(/^http/, 'ws'))}`
}
