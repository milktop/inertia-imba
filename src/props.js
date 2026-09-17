export function applyPageProps(node, props, previousKeys = []) {
  for (const key of previousKeys) {
    if (!(key in props)) node[key] = undefined
  }

  Object.assign(node, props)
  return Object.keys(props)
}
