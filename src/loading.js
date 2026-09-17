import { router } from '@inertiajs/core'
import { get } from 'es-toolkit/compat'
import { getPage, onPageChange } from './page.js'

export function propKeys(data) {
  const keys = typeof data === 'string' ? [data] : data
  if (!Array.isArray(keys) || !keys.length || keys.some(key => typeof key !== 'string' || !key)) {
    throw new Error('Expected data to be a prop name or a non-empty array of prop names')
  }
  return keys
}

export function deferredState(data, page = getPage()) {
  const keys = propKeys(data)
  return {
    ready: keys.every(key => get(page?.props, key) !== undefined),
    rescued: keys.some(key => page?.rescuedProps?.includes(key)),
    props: page?.props ?? {},
  }
}

export function observeVisibility(element, options, changed, dependencies = {}) {
  const client = dependencies.router ?? router
  const Observer = dependencies.IntersectionObserver ?? globalThis.IntersectionObserver
  const page = dependencies.getPage ?? getPage
  const subscribe = dependencies.onPageChange ?? onPageChange
  const state = { loaded: false, fetching: false }
  let disposed = false
  let token
  let observer

  const exists = () => options().data !== undefined && deferredState(options().data, page()).ready
  const sync = () => {
    if (disposed) return
    if (options().data !== undefined) state.loaded = exists()
    if (state.loaded && !options().always) observer?.unobserve(element)
    else observer?.observe(element)
    changed()
  }

  const fetch = () => {
    if (disposed || state.fetching || (state.loaded && !options().always)) return
    const settings = options()
    const params = { preserveErrors: true, ...settings.params }
    if (settings.data !== undefined) params.only = propKeys(settings.data)
    if (!settings.data && !settings.params) throw new Error('WhenVisible requires data or params')
    state.fetching = true
    changed()
    try {
      client.reload({
        ...params,
        onBefore: visit => {
          if (params.onBefore?.(visit) === false) {
            state.fetching = false
            changed()
            return false
          }
        },
        onCancelToken: value => {
          token = value
          if (disposed) value.cancel()
          else params.onCancelToken?.(value)
        },
        onSuccess: response => {
          if (disposed) return
          state.loaded = settings.data === undefined || deferredState(settings.data, response).ready
          if (state.loaded && !options().always) observer?.unobserve(element)
          return params.onSuccess?.(response)
        },
        onFinish: visit => {
          token = null
          if (disposed) return
          state.fetching = false
          changed()
          return params.onFinish?.(visit)
        },
      })
    } catch (error) {
      state.fetching = false
      changed()
      throw error
    }
  }

  const buffer = options().buffer ?? 0
  if (!Number.isFinite(buffer) || buffer < 0) throw new Error('WhenVisible buffer must be a non-negative number')
  if (options().data !== undefined) propKeys(options().data)
  if (Observer) {
    observer = new Observer(entries => {
      if (entries.some(entry => entry.isIntersecting)) fetch()
    }, { rootMargin: `${buffer}px` })
  }
  const unsubscribe = subscribe(sync)
  sync()
  // Progressive enhancement for environments without IntersectionObserver.
  if (!Observer) fetch()

  return {
    state,
    retry: fetch,
    destroy() {
      disposed = true
      unsubscribe()
      observer?.disconnect()
      token?.cancel()
    },
  }
}
