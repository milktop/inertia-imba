// Only forward the Rails meta token to the current origin. Explicit headers win.
export function requestHeaders(url, json, supplied = {}, document = globalThis.document) {
  const headers = { Accept: 'application/json', ...(json ? { 'Content-Type': 'application/json' } : {}) }
  if (document && new URL(url, document.baseURI).origin === new URL(document.location.href).origin) {
    const token = document.querySelector('meta[name="csrf-token"]')?.content
    if (token) headers['X-CSRF-Token'] = token
  }
  for (const [key, value] of Object.entries(supplied)) {
    for (const existing of Object.keys(headers)) {
      if (existing.toLowerCase() === key.toLowerCase()) delete headers[existing]
    }
    headers[key] = value
  }
  return headers
}
