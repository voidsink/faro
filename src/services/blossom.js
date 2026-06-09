export const BLOSSOM_SERVER_STORAGE_KEY = 'faro-blossom-server'

function nowSeconds() {
  return Math.floor(Date.now() / 1000)
}

export function normalizeBlossomServerUrl(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''

  try {
    const url = new URL(raw)
    if (!['http:', 'https:'].includes(url.protocol)) return ''
    return url.toString().replace(/\/+$/, '')
  } catch {
    return ''
  }
}

export function buildBlossomUploadUrl(serverUrl) {
  const normalized = normalizeBlossomServerUrl(serverUrl)
  if (!normalized) return ''

  return normalized.endsWith('/upload') ? normalized : `${normalized}/upload`
}

export function buildBlossomAuthEvent({ uploadUrl, sha256, mimeType, size, now = nowSeconds } = {}) {
  const tags = [
    ['u', uploadUrl],
    ['method', 'PUT'],
  ]

  if (sha256) tags.push(['x', sha256])
  if (mimeType) tags.push(['m', mimeType])
  if (Number.isFinite(Number(size))) tags.push(['size', String(size)])

  return {
    kind: 27235,
    created_at: now(),
    content: '',
    tags,
  }
}

export function loadBlossomServer() {
  try {
    return normalizeBlossomServerUrl(localStorage.getItem(BLOSSOM_SERVER_STORAGE_KEY))
  } catch {
    return ''
  }
}

export function saveBlossomServer(serverUrl) {
  const normalized = normalizeBlossomServerUrl(serverUrl)
  try {
    if (normalized) localStorage.setItem(BLOSSOM_SERVER_STORAGE_KEY, normalized)
    else localStorage.removeItem(BLOSSOM_SERVER_STORAGE_KEY)
  } catch {
    // Ignore storage failures; caller can still use returned value in memory.
  }
  return normalized
}

function encodeAuthorization(signedEvent) {
  return `Nostr ${btoa(JSON.stringify(signedEvent))}`
}

function extractUploadedUrl(response, serverUrl, sha256) {
  const fallback = sha256 ? `${normalizeBlossomServerUrl(serverUrl)}/${sha256}` : ''

  try {
    const location = response.headers?.get?.('location')
    if (location) return new URL(location, serverUrl).toString()
  } catch {
    // Fall through to body/fallback.
  }

  return fallback
}

export async function uploadBlobToBlossom(media, { serverUrl, signer = globalThis.window?.nostr, fetchImpl = fetch } = {}) {
  const normalizedServer = normalizeBlossomServerUrl(serverUrl)
  const uploadUrl = buildBlossomUploadUrl(normalizedServer)

  if (!normalizedServer || !uploadUrl) {
    return { ok: false, error: 'Configure a valid Blossom media server before publishing.' }
  }
  if (!media?.blob) {
    return { ok: false, error: 'No prepared media blob available for upload.' }
  }
  if (!signer?.signEvent) {
    return { ok: false, error: 'Login with NIP-07 before uploading media.' }
  }

  try {
    const authEvent = buildBlossomAuthEvent({
      uploadUrl,
      sha256: media.sha256,
      mimeType: media.mimeType || media.blob.type,
      size: media.bytes || media.blob.size,
    })
    const signedAuthEvent = await signer.signEvent(authEvent)
    const response = await fetchImpl(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: encodeAuthorization(signedAuthEvent),
        'Content-Type': media.mimeType || media.blob.type || 'application/octet-stream',
      },
      body: media.blob,
    })

    if (!response.ok) {
      return { ok: false, error: `Blossom upload failed (${response.status}).` }
    }

    let body = null
    try {
      body = await response.clone().json()
    } catch {
      body = null
    }

    const url = body?.url || body?.data?.url || extractUploadedUrl(response, normalizedServer, media.sha256)
    return {
      ok: true,
      url,
      serverUrl: normalizedServer,
      authEvent: signedAuthEvent,
      metadata: {
        sha256: media.sha256,
        mimeType: media.mimeType || media.blob.type,
        width: media.width,
        height: media.height,
        dimensions: media.dimensions,
        bytes: media.bytes || media.blob.size,
      },
      response: body,
    }
  } catch (error) {
    return { ok: false, error: error?.message || 'Blossom upload failed.' }
  }
}
