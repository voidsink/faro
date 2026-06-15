export const BLOSSOM_SERVER_STORAGE_KEY = 'faro-blossom-server'
export const DEFAULT_BLOSSOM_SERVERS = [
  'https://cdn.nostrverse.net',
  'https://cdn.satellite.earth',
  'https://blssm.us',
]

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
  const serverHost = hostFromUrl(uploadUrl)
  const tags = [
    ['t', 'upload'],
    ['expiration', String(now() + 10 * 60)],
  ]

  if (sha256) tags.push(['x', sha256])
  if (serverHost) tags.push(['server', serverHost])
  if (mimeType) tags.push(['m', mimeType])
  if (Number.isFinite(Number(size))) tags.push(['size', String(size)])

  return {
    kind: 24242,
    created_at: now(),
    content: 'Upload Blob',
    tags,
  }
}

function hostFromUrl(value) {
  try {
    return new URL(value).host.toLowerCase()
  } catch {
    return ''
  }
}

export function loadBlossomServer() {
  return loadBlossomServers()[0] || DEFAULT_BLOSSOM_SERVERS[0]
}

export function loadBlossomServers() {
  try {
    const stored = localStorage.getItem(BLOSSOM_SERVER_STORAGE_KEY)
    if (!stored) return [DEFAULT_BLOSSOM_SERVERS[0]]

    try {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed)) return normalizeBlossomServers(parsed)
    } catch {
      // Legacy single-string value.
    }

    return normalizeBlossomServers([stored])
  } catch {
    return [DEFAULT_BLOSSOM_SERVERS[0]]
  }
}

export function saveBlossomServer(serverUrl) {
  return saveBlossomServers(serverUrl ? [serverUrl] : [])[0] || ''
}

export function normalizeBlossomServers(values) {
  const normalized = [...new Set((values || []).map(normalizeBlossomServerUrl).filter(Boolean))]
  return normalized.length ? normalized : [DEFAULT_BLOSSOM_SERVERS[0]]
}

export function saveBlossomServers(serverUrls) {
  const normalized = normalizeBlossomServers(serverUrls)
  try {
    localStorage.setItem(BLOSSOM_SERVER_STORAGE_KEY, JSON.stringify(normalized))
  } catch {
    // Ignore storage failures; caller can still use returned value in memory.
  }
  return normalized
}

export function addBlossomServer(serverUrl) {
  const normalized = normalizeBlossomServerUrl(serverUrl)
  if (!normalized) return loadBlossomServers()
  return saveBlossomServers([...loadBlossomServers(), normalized])
}

function encodeAuthorization(signedEvent) {
  const json = JSON.stringify(signedEvent)
  const base64 = btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
  return `Nostr ${base64}`
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

export async function uploadBlobToBlossom(media, { serverUrl, serverUrls, signer = globalThis.window?.nostr, fetchImpl = fetch } = {}) {
  const servers = normalizeBlossomServers(serverUrls || (serverUrl ? [serverUrl] : loadBlossomServers()))
  const attempts = []

  for (const server of servers) {
    const result = await uploadBlobToSingleBlossomServer(media, { serverUrl: server, signer, fetchImpl })
    attempts.push({ serverUrl: server, ok: result.ok, error: result.error || '' })
    if (result.ok) return { ...result, attempts }
  }

  return { ok: false, attempts, error: attempts.map((attempt) => `${attempt.serverUrl}: ${attempt.error}`).join('; ') || 'Blossom upload failed.' }
}

async function uploadBlobToSingleBlossomServer(media, { serverUrl, signer = globalThis.window?.nostr, fetchImpl = fetch } = {}) {
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
    const headers = {
      Authorization: encodeAuthorization(signedAuthEvent),
      'Content-Type': media.mimeType || media.blob.type || 'application/octet-stream',
    }
    if (media.sha256) headers['X-SHA-256'] = media.sha256

    const response = await fetchImpl(uploadUrl, {
      method: 'PUT',
      headers,
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
