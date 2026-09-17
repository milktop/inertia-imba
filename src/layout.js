// An explicit null/false/empty array opts out of the application default.
export function resolveLayout(component, defaultLayout, page) {
  const Page = component.default || component
  const declared = component.layout !== undefined ? component.layout : Page.layout
  const layout = declared !== undefined ? declared : defaultLayout?.(page.component, page)
  if (layout == null || layout === false) return null
  const layouts = Array.isArray(layout) ? layout : [layout]
  if (layouts.some(Layout => typeof Layout !== 'function')) {
    throw new Error('Imba layouts must be a tag class or a flat array of tag classes, null, or false')
  }
  return layout
}

export function updateLayout(previous, layout, props, child, create) {
  const layouts = Array.isArray(layout) ? layout : layout ? [layout] : []
  const states = []
  let candidate = previous

  // Only the shared outer prefix survives. An inner layout cannot outlive a
  // replaced parent, even if its tag class also appears in the new chain.
  for (const Layout of layouts) {
    const state = candidate?.component === Layout
      ? candidate
      : { component: Layout, node: create(Layout), keys: [], inner: null }
    candidate = state === candidate ? candidate.inner : null
    states.push(state)
  }

  // Wire from the page outward, assigning current props at every level.
  for (let index = states.length - 1; index >= 0; index--) {
    const state = states[index]
    state.inner = states[index + 1] ?? null
    const layoutProps = { ...props, pageContent: child }
    for (const key of state.keys) {
      if (!(key in layoutProps)) state.node[key] = undefined
    }
    Object.assign(state.node, layoutProps)
    state.keys = Object.keys(layoutProps)
    child = state.node
  }
  return states[0] ?? null
}
