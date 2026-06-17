const SOURCE_LABELS = {
  nip07: 'Browser signer',
  bunker: 'Bunker',
  pomegranate: 'Google',
  'local-key': 'Local key',
  nsec: 'Private key',
  'local-dev': 'Local dev',
}

const SIGNING_SOURCES = new Set(['nip07', 'local-key', 'nsec'])

export function normalizeIdentity(identity = null) {
  if (!identity?.pubkey) return null
  return {
    ...identity,
    source: identity.source || 'unknown',
    pubkey: String(identity.pubkey),
  }
}

export function authLabelForSource(source = '') {
  return SOURCE_LABELS[source] || (source ? String(source) : 'logged out')
}

export function isSigningSource(source = '') {
  return SIGNING_SOURCES.has(source)
}

export function safeIdentityForStorage(identity = null) {
  const normalized = normalizeIdentity(identity)
  if (!normalized) return null
  const { secretKey, nsec, signer, remoteSigner, ...safe } = normalized
  void secretKey
  void nsec
  void signer
  void remoteSigner
  return safe
}
