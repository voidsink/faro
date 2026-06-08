export const ASPECT_RATIOS = {
  '1:1': { label: '1:1', width: 1, height: 1 },
  '4:3': { label: '4:3', width: 4, height: 3 },
  '16:9': { label: '16:9', width: 16, height: 9 },
  '9:16': { label: '9:16', width: 9, height: 16 },
}

export const LOCAL_POSTS_STORAGE_KEY = 'faro-local-posts'
const LEGACY_LOCAL_POSTS_STORAGE_KEY = 'nostr-visual-demo-posts'
export const MAX_LOCAL_POSTS = 24
export const MAX_IMAGE_SIDE = 1400
export const JPEG_QUALITY = 0.82
export const MAX_LOCAL_CACHE_BYTES = 4_500_000

function assertBrowserApi(name, value) {
  if (!value) {
    throw new Error(`${name} is not available in this environment`)
  }
}

function getRatio(ratioKey) {
  return ASPECT_RATIOS[ratioKey] || ASPECT_RATIOS['1:1']
}

function readFileAsDataUrl(file) {
  assertBrowserApi('FileReader', globalThis.FileReader)

  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Could not read selected image file'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src) {
  assertBrowserApi('Image', globalThis.Image)

  return new Promise((resolve, reject) => {
    const image = new Image()

    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not load selected image'))
    image.src = src
  })
}

function calculateCrop(sourceWidth, sourceHeight, ratio) {
  const targetRatio = ratio.width / ratio.height
  const sourceRatio = sourceWidth / sourceHeight

  if (sourceRatio > targetRatio) {
    const cropWidth = sourceHeight * targetRatio
    return {
      sx: (sourceWidth - cropWidth) / 2,
      sy: 0,
      sw: cropWidth,
      sh: sourceHeight,
    }
  }

  const cropHeight = sourceWidth / targetRatio
  return {
    sx: 0,
    sy: (sourceHeight - cropHeight) / 2,
    sw: sourceWidth,
    sh: cropHeight,
  }
}

function calculateOutputSize(cropWidth, cropHeight) {
  const longestSide = Math.max(cropWidth, cropHeight)
  const scale = longestSide > MAX_IMAGE_SIDE ? MAX_IMAGE_SIDE / longestSide : 1

  return {
    width: Math.max(1, Math.round(cropWidth * scale)),
    height: Math.max(1, Math.round(cropHeight * scale)),
  }
}

function dataUrlBytesApprox(dataUrl) {
  const commaIndex = dataUrl.indexOf(',')
  const payload = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0

  return Math.max(0, Math.floor((payload.length * 3) / 4) - padding)
}

export function estimateLocalStorageBytes(value) {
  try {
    const text = typeof value === 'string' ? value : JSON.stringify(value)
    return text ? text.length * 2 : 0
  } catch {
    return 0
  }
}

export async function processImageFile(file, ratioKey = '1:1') {
  if (!file) {
    throw new Error('No image file selected')
  }

  assertBrowserApi('document', globalThis.document)

  const ratio = getRatio(ratioKey)
  const sourceDataUrl = await readFileAsDataUrl(file)
  const image = await loadImage(sourceDataUrl)
  const sourceWidth = image.naturalWidth || image.width
  const sourceHeight = image.naturalHeight || image.height

  if (!sourceWidth || !sourceHeight) {
    throw new Error('Selected image has invalid dimensions')
  }

  const crop = calculateCrop(sourceWidth, sourceHeight, ratio)
  const output = calculateOutputSize(crop.sw, crop.sh)
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Canvas rendering is not available')
  }

  canvas.width = output.width
  canvas.height = output.height
  context.drawImage(image, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, output.width, output.height)

  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)

  return {
    dataUrl,
    width: output.width,
    height: output.height,
    ratioKey: ASPECT_RATIOS[ratioKey] ? ratioKey : '1:1',
    bytesApprox: dataUrlBytesApprox(dataUrl),
  }
}

function safeParsePosts(raw) {
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function postTimestamp(post) {
  const value = post?.createdAt || post?.created_at || 0
  const numeric = Number(value)

  if (Number.isFinite(numeric)) {
    return numeric
  }

  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function newestFirst(posts) {
  return [...posts].sort((a, b) => postTimestamp(b) - postTimestamp(a))
}

function storageQuotaError(error) {
  return Boolean(
    error &&
      (error.name === 'QuotaExceededError' ||
        error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        error.code === 22 ||
        error.code === 1014),
  )
}

export function loadLocalPosts() {
  assertBrowserApi('localStorage', globalThis.localStorage)

  const posts = newestFirst(safeParsePosts(localStorage.getItem(LOCAL_POSTS_STORAGE_KEY))).slice(0, MAX_LOCAL_POSTS)
  if (posts.length) return posts

  const legacyPosts = newestFirst(safeParsePosts(localStorage.getItem(LEGACY_LOCAL_POSTS_STORAGE_KEY))).slice(0, MAX_LOCAL_POSTS)
  if (legacyPosts.length) {
    saveLocalPostsWithPruning(legacyPosts)
    localStorage.removeItem(LEGACY_LOCAL_POSTS_STORAGE_KEY)
  }
  return legacyPosts
}

export function saveLocalPostsWithPruning(posts, maxPosts = MAX_LOCAL_POSTS) {
  assertBrowserApi('localStorage', globalThis.localStorage)

  let nextPosts = newestFirst(Array.isArray(posts) ? posts : []).slice(0, maxPosts)
  const newestPostId = nextPosts[0]?.id

  while (nextPosts.length && estimateLocalStorageBytes(nextPosts) > MAX_LOCAL_CACHE_BYTES) {
    nextPosts = nextPosts.slice(0, -1)
  }

  if (newestPostId && nextPosts[0]?.id !== newestPostId) {
    throw new Error('Selected image is too large for the local demo cache')
  }

  for (;;) {
    try {
      localStorage.setItem(LOCAL_POSTS_STORAGE_KEY, JSON.stringify(nextPosts))
      return nextPosts
    } catch (error) {
      if (!storageQuotaError(error) || nextPosts.length <= 1) {
        throw new Error('Could not save local demo posts')
      }

      nextPosts = nextPosts.slice(0, -1)
      if (newestPostId && nextPosts[0]?.id !== newestPostId) {
        throw new Error('Selected image is too large for the local demo cache')
      }
    }
  }
}

export function clearLocalPosts() {
  assertBrowserApi('localStorage', globalThis.localStorage)

  localStorage.removeItem(LOCAL_POSTS_STORAGE_KEY)
  localStorage.removeItem(LEGACY_LOCAL_POSTS_STORAGE_KEY)
}
