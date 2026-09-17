// Investigation only: patch compiler input in memory, never node_modules.
// These changes need upstream review before becoming an adapter dependency.
function replaceOnce(source, before, after) {
  if (source.split(before).length !== 2) throw new Error(`Unexpected Imba source: ${before}`)
  return source.replace(before, after)
}

export function patchRuntimeSource(source, path, platform, skipDetached = true) {
  if (path.endsWith('/dom/core.imba')) {
    source = replaceOnce(source,
      'get outerHTML\n\t\tself.textContent',
      'get outerHTML\n\t\tescapeTextContent(self.textContent, self.parentNode && self.parentNode.nodeName)')
    source = replaceOnce(source,
      "const escapeAttributeValue = do(val)\n\tlet str = typeof val == 'string' ? val : String(val)",
      "const escapeAttributeValue = do(val)\n\tlet str = typeof val == 'string' ? val : String(val)\n\tstr = str.replace(/&/g, '&amp;')")
    source = replaceOnce(source,
      "if nodeName == 'script' or nodeName == 'style'\n\t\treturn str",
      "if nodeName == 'script' or nodeName == 'style'\n\t\treturn str\n\n\tstr = str.replace(/&/g, '&amp;')")
  }
  if (platform === 'node' && path.endsWith('/dom/bind.imba')) {
    source = replaceOnce(source, 'toBind[nodeName]', 'toBind[nodeName.toUpperCase()]')
  }
  if (skipDetached && path.endsWith('/dom/component.imba') && platform === 'browser') {
    source = replaceOnce(source,
      'continue if !item.parentNode or item.hydrated?',
      'continue if !item.isConnected or item.hydrated?')
  }
  return source
}
