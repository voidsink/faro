import { notifySuccess, notifyError, notifyWarning, notifyInfo } from 'src/utils/notify.js'

function inferNotificationType(message) {
  if (!message) return null
  const lower = message.toLowerCase()
  if (
    lower.includes('failed') ||
    lower.includes('error') ||
    lower.includes('could not') ||
    lower.includes('rejected')
  ) {
    return 'error'
  }
  if (lower.includes('cancelled') || lower.includes('unavailable') || lower.includes('try again')) {
    return 'warning'
  }
  if (
    lower.includes('connected') ||
    lower.includes('published') ||
    lower.includes('created') ||
    lower.includes('imported')
  ) {
    return 'success'
  }
  if (lower.includes('connecting') || lower.includes('loading') || lower.includes('fetching')) {
    return 'info'
  }
  return 'info'
}

export function createNotificationsPlugin() {
  return ({ store }) => {
    let previousMessage = ''

    store.$subscribe((mutation, state) => {
      const message = state.message
      if (message && message !== previousMessage) {
        previousMessage = message
        const type = inferNotificationType(message)

        switch (type) {
          case 'success':
            notifySuccess(message)
            break
          case 'error':
            notifyError(message)
            break
          case 'warning':
            notifyWarning(message)
            break
          default:
            notifyInfo(message)
        }

        // Clear message after showing notification
        setTimeout(() => {
          if (store.message === message) {
            store.message = ''
          }
        }, 100)
      }
    })
  }
}
