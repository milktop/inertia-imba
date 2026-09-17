// An explicit null/false page layout opts out of the application default.
export function resolveLayout(component, defaultLayout, page) {
  const Page = component.default || component
  const declared = component.layout !== undefined ? component.layout : Page.layout
  const layout = declared !== undefined ? declared : defaultLayout?.(page.component, page)
  if (layout == null || layout === false) return null
  if (typeof layout !== 'function') {
    throw new Error('Imba layouts must be a tag class, null, or false; nested layouts are not supported yet')
  }
  return layout
}

export function updateLayout(previous, Layout, props, child, create) {
  if (!Layout) return null
  const state = previous?.component === Layout
    ? previous
    : { component: Layout, node: create(Layout), keys: [] }

  // Child content belongs to the adapter, even if page props include `pageContent`.
  const layoutProps = { ...props, pageContent: child }
  for (const key of state.keys) {
    if (!(key in layoutProps)) state.node[key] = undefined
  }
  Object.assign(state.node, layoutProps)
  state.keys = Object.keys(layoutProps)
  return state
}
