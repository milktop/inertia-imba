let currentPage = null
let pageScope = {}
const listeners = new Set()

export function setPage(page, preserveState = false) {
  if (!preserveState) pageScope = {}
  currentPage = page
  for (const listener of listeners) listener(page)
}

export function getPageScope() { return pageScope }

export function getPage() {
  return currentPage
}

export function onPageChange(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
