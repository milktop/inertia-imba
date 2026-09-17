import { shouldIntercept } from '@inertiajs/core'

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
      if (![true, 'hover'].includes(config().prefetch) || !linkUrl(anchor)) return
      timer = setTimeout(() => {
        timer = null
        const settings = config()
        const url = linkUrl(anchor)
        if (!url || ![true, 'hover'].includes(settings.prefetch)) return
        router.prefetch(url, { ...options(), method: 'get' }, {
          cacheFor: settings.cacheFor ?? 30000,
          cacheTags: settings.cacheTags ?? [],
        })
      }, 75)
    },
  }
}
