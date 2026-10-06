import { shouldIntercept } from '@inertiajs/core'
import { getPage } from './page.js'

export function linkUrl(anchor) {
  const href = anchor.getAttribute('href')
  if (!href || href.startsWith('#') || anchor.hasAttribute('download')) return null
  const target = anchor.getAttribute('target') ?? anchor.ownerDocument.querySelector('base[target]')?.target
  if (target && target !== '_self') return null
  const url = new URL(anchor.href, anchor.ownerDocument.baseURI)
  const current = new URL(anchor.ownerDocument.location.href)
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== current.origin) return null
  if (url.hash && url.pathname === current.pathname && url.search === current.search) return null
  return url.href
}

const pathOf = url => url.pathname.replace(/\/+$/, '') || '/'

// True when href points at the current page's path. Queries, hashes and
// trailing slashes are ignored; other origins and hash-only links never match.
// With prefix, pages under href match too ('/students' for '/students/1'),
// except '/', which only ever matches itself.
export function isCurrentLink(href, pageUrl, baseURI, { prefix = false } = {}) {
  if (!href || !pageUrl || href.startsWith('#')) return false
  const target = new URL(href, baseURI)
  const current = new URL(pageUrl, baseURI)
  if (target.origin !== current.origin) return false
  const path = pathOf(target)
  if (path === pathOf(current)) return true
  return prefix && path !== '/' && pathOf(current).startsWith(`${path}/`)
}

const baseURI = () => globalThis.document?.baseURI || 'http://localhost/'

// The current page's path, without query, hash or trailing slash.
export function currentPath() {
  const url = getPage()?.url
  return url ? pathOf(new URL(url, baseURI())) : null
}

// True when href is the current page or a page under it, for nav highlighting.
// Pass { exact: true } to match the page itself only, as Link's aria-current does.
export function isCurrent(href, { exact = false } = {}) {
  return isCurrentLink(href, getPage()?.url, baseURI(), { prefix: !exact })
}

export function followLink(event, anchor, options, router) {
  // Imba delegates events, so use the actual anchor as the current target.
  if (!shouldIntercept({
    currentTarget: anchor,
    target: event.target,
    defaultPrevented: event.defaultPrevented,
    button: event.button,
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey,
  })) return

  const url = linkUrl(anchor)
  if (!url) return

  event.preventDefault()
  router.visit(url, { ...options, method: 'get' })
}

export function createLinkPrefetch(anchor, options, config, router) {
  let timer
  const cancel = () => { clearTimeout(timer); timer = null }
  return {
    cancel,
    schedule() {
      cancel()
      if (![true, 'prefetch', 'hover'].includes(config().prefetch) || !linkUrl(anchor)) return
      timer = setTimeout(() => {
        timer = null
        const settings = config()
        const url = linkUrl(anchor)
        if (!url || ![true, 'prefetch', 'hover'].includes(settings.prefetch)) return
        router.prefetch(url, { ...options(), method: 'get' }, {
          cacheFor: settings.cacheFor ?? 30000,
          cacheTags: settings.cacheTags ?? [],
        })
      }, 75)
    },
  }
}

// Button actions deliberately accept only same-origin HTTP(S) destinations.
export function actionUrl(button, href) {
  if (!href || href.startsWith('#')) return null
  const url = new URL(href, button.ownerDocument.baseURI)
  const current = new URL(button.ownerDocument.location.href)
  return ['http:', 'https:'].includes(url.protocol) && url.origin === current.origin ? url.href : null
}

export function createLinkAction(button, settings, router, changed = () => {}, reportError = () => {}) {
  const state = { processing: false }
  let disposed = false
  let token
  let generation = 0
  const finish = request => {
    if (request !== generation) return
    token = null
    state.processing = false
    if (!disposed) changed()
  }
  return {
    state,
    follow(event) {
      if (disposed || event.defaultPrevented) return
      event.preventDefault()
      const config = settings()
      if (state.processing || config.disabled) return
      const method = (config.method ?? 'post').toLowerCase()
      if (!['post', 'put', 'patch', 'delete'].includes(method)) throw new Error(`Unsupported LinkButton method: ${method}`)
      const url = actionUrl(button, config.href)
      if (!url) return
      if (config.confirm && !button.ownerDocument.defaultView.confirm(config.confirm)) return

      const request = ++generation
      state.processing = true
      changed()
      try {
        router.visit(url, {
          ...config.options,
          method,
          data: config.data ?? {},
          preserveState: config.options?.preserveState ?? true,
          onCancelToken: value => { token = value; if (disposed) value.cancel() },
          onError: errors => {
            if (!disposed && request === generation) reportError(errors)
          },
          onFinish: () => finish(request),
        })
        // Inertia's global before event can veto a visit without onFinish.
        if (!token) finish(request)
      } catch (error) {
        finish(request)
        throw error
      }
    },
    cancel() { token?.cancel() },
    destroy() {
      disposed = true
      token?.cancel()
      finish(generation)
    },
  }
}
