const TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000

export const POMEGRANATE_STATUS = 'available'

export function pomegranateUnavailableMessage() {
  return 'Google login requires a Pomegranate central server. Please configure the server URL in settings.'
}

export function normalizePomegranateUrl(input = '') {
  const value = String(input || '').trim()
  if (!value) throw new Error('Configure a Pomegranate central server first.')
  const hasProtocol = /^https?:\/\//i.test(value)
  const withProtocol = hasProtocol ? value : `https://${value}`
  return new URL(withProtocol).origin
}

export function buildPomegranateBunkerUrl(central, profile) {
  const normalized = normalizePomegranateUrl(central)
  if (!profile?.handler_pubkey) throw new Error('Missing Pomegranate signing profile.')
  const url = new URL(normalized)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.pathname = ''
  url.search = ''
  url.hash = ''
  return `bunker://${profile.handler_pubkey}?relay=${encodeURIComponent(url.toString().replace(/\/$/, ''))}`
}

class PomegranateRequestError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

async function pomegranateFetch(centralUrl, path, token, init = {}) {
  const response = await fetch(`${centralUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Token ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  })
  if (!response.ok) {
    throw new PomegranateRequestError(response.status, pomegranateRequestMessage(response.status))
  }
  if (init.expectJson === false || response.status === 204) return undefined
  return response.json()
}

function pomegranateRequestMessage(status) {
  if (status === 401) return 'Your Pomegranate login expired. Please sign in again.'
  if (status === 404) return 'Pomegranate could not find this account or connection.'
  if (status >= 500) return 'Pomegranate is unavailable. Please try again.'
  return `Pomegranate request failed (${status}).`
}

function pomegranateEmailFromToken(token) {
  try {
    const decoded = JSON.parse(atob(token))
    return decoded.tags?.find((tag) => tag[0] === 'email' && tag[1])?.[1] ?? ''
  } catch {
    return ''
  }
}

function tokenCreatedAt(token) {
  try {
    const decoded = JSON.parse(atob(token))
    return decoded.created_at ? decoded.created_at * 1000 : 0
  } catch {
    return 0
  }
}

export async function authenticatePomegranateGoogle(centralUrl) {
  const normalized = normalizePomegranateUrl(centralUrl)
  return new Promise((resolve, reject) => {
    const loginUrl = new URL(`${normalized}/login/google`)
    loginUrl.searchParams.set('prompt', 'select_account')
    const popup = window.open(loginUrl.toString(), 'pomegranate-login', 'width=560,height=720')
    if (!popup) {
      reject(new Error('Pomegranate login popup was blocked. Please allow popups for this site.'))
      return
    }
    let settled = false
    const cleanup = () => {
      settled = true
      clearTimeout(timeout)
      clearInterval(closedCheck)
      window.removeEventListener('message', onMessage)
    }
    const finish = (token) => {
      cleanup()
      popup.close()
      resolve(token)
    }
    const fail = () => {
      cleanup()
      reject(new Error('Could not sign in with Google. Please try again.'))
    }
    const timeout = setTimeout(fail, 120_000)
    const closedCheck = setInterval(() => {
      if (!settled && popup.closed) fail()
    }, 500)
    const onMessage = (event) => {
      if (event.origin !== normalized) return
      const token = typeof event.data?.token === 'string' ? event.data.token : ''
      if (token) finish(token)
    }
    window.addEventListener('message', onMessage)
  })
}

export async function fetchPomegranateAccount(centralUrl, token) {
  try {
    return await pomegranateFetch(centralUrl, '/account', token)
  } catch (error) {
    if (error instanceof PomegranateRequestError && error.status === 404) return null
    throw error
  }
}

export async function ensurePomegranateDefaultProfile(centralUrl, token) {
  const profiles = await pomegranateFetch(centralUrl, '/profiles', token)
  const existing = profiles.find((profile) => profile.name === 'default') ?? profiles[0]
  if (existing) return existing
  return pomegranateFetch(centralUrl, '/profiles', token, {
    method: 'POST',
    body: JSON.stringify({ name: 'default' }),
  })
}

export async function loginWithPomegranate({ centralUrl, onAuth }) {
  const normalized = normalizePomegranateUrl(centralUrl)
  const token = await authenticatePomegranateGoogle(normalized)
  const auth = {
    token,
    centralUrl: normalized,
    createdAt: tokenCreatedAt(token) || Date.now(),
    email: pomegranateEmailFromToken(token),
  }
  const account = await fetchPomegranateAccount(normalized, token)
  if (!account) {
    throw new Error('No Pomegranate account found. Please create an account first at ' + normalized)
  }
  const profile = await ensurePomegranateDefaultProfile(normalized, token)
  const bunkerUrl = buildPomegranateBunkerUrl(normalized, profile)
  if (onAuth) onAuth({ type: 'pomegranate-bunker', bunkerUrl })
  return {
    auth,
    account,
    profile: { ...profile, bunkerUrl },
    bunkerUrl,
  }
}
