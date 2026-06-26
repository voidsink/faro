import { Notify } from 'quasar'

const defaultOptions = {
  position: 'top',
  timeout: 4000,
  actions: [{ icon: 'close', color: 'white', handler: () => {} }],
}

export function notifySuccess(message, opts = {}) {
  Notify.create({
    ...defaultOptions,
    type: 'positive',
    message,
    ...opts,
  })
}

export function notifyError(message, opts = {}) {
  Notify.create({
    ...defaultOptions,
    type: 'negative',
    message,
    timeout: 6000,
    ...opts,
  })
}

export function notifyWarning(message, opts = {}) {
  Notify.create({
    ...defaultOptions,
    type: 'warning',
    message,
    ...opts,
  })
}

export function notifyInfo(message, opts = {}) {
  Notify.create({
    ...defaultOptions,
    type: 'info',
    message,
    ...opts,
  })
}

export function notifyPersistent(message, opts = {}) {
  Notify.create({
    ...defaultOptions,
    type: 'ongoing',
    message,
    timeout: 0,
    actions: [
      { label: 'Dismiss', color: 'white', handler: () => {} }
    ],
    ...opts,
  })
}
