import { createHeadManager } from '@inertiajs/core'
import { getPage } from './page.js'

let manager
export function setupHead(title = value => value) {
  manager = createHeadManager(false, value => title(value, getPage()), () => {})
}

export function headElements(host) {
  const elements = []
  if (host.title !== undefined && host.title !== null) {
    const title = host.ownerDocument.createElement('title')
    title.setAttribute('data-inertia', '')
    title.textContent = host.title
    elements.push(title.outerHTML)
  }
  for (const child of host.children) {
    const element = child.cloneNode(true)
    // Imba compiles unknown dashed attributes to properties using its Ξ separator.
    element.setAttribute('data-inertia', child['headΞkey'] ?? child.getAttribute('head-key') ?? '')
    element.removeAttribute('head-key')
    elements.push(element.outerHTML)
  }
  return elements
}

export function mountHead(host) {
  if (!manager) setupHead()
  host.headProvider = manager.createProvider()
  host.headObserver = new MutationObserver(() => updateHead(host))
  host.headObserver.observe(host, { childList: true, subtree: true, attributes: true, characterData: true })
  updateHead(host)
}

export function updateHead(host) {
  if (host.headQueued) return
  host.headQueued = true
  queueMicrotask(() => {
    host.headQueued = false
    if (!host.headProvider) return
    const elements = headElements(host)
    const signature = JSON.stringify(elements)
    if (signature === host.headSignature) return
    host.headSignature = signature
    host.headProvider.update(elements)
  })
}

export function unmountHead(host) {
  host.headObserver?.disconnect()
  host.headProvider?.disconnect()
  host.headProvider = null
  host.headSignature = null
}
