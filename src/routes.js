// Named routes keyed by "controller.action" (e.g. "tasks.destroy"), each with
// its HTTP method and path pattern, as exported from the server's routing table.
const METHODS = ['get', 'post', 'put', 'patch', 'delete']
let table = null

export function setRoutes(routes) {
  table = routes ?? null
}

function lookup(name) {
  if (!table) throw new Error(`No routes registered; pass routes to createInertiaApp to use route('${name}')`)
  const entry = Object.hasOwn(table, name) ? table[name] : null
  if (!entry) {
    const [controller] = name.split('.')
    const similar = Object.keys(table).filter(key => key.startsWith(`${controller}.`))
    throw new Error(`Unknown route: ${name}${similar.length ? ` (did you mean ${similar.join(', ')}?)` : ''}`)
  }
  return entry
}

function paramNames(pattern) {
  return [...pattern.matchAll(/[:*]([A-Za-z_][A-Za-z0-9_]*)/g)].map(match => match[1])
}

// A scalar fills the route's only required parameter: route('tasks.show', task.id).
function normalizeParams(name, path, params) {
  if (params == null) return {}
  if (typeof params !== 'object') {
    const required = paramNames(path.replace(/\([^)]*\)/g, ''))
    if (required.length !== 1) throw new Error(`Route ${name} (${path}) needs named params, e.g. { ${required.join(', ') || 'id'}: ... }`)
    return { [required[0]]: params }
  }
  return params
}

function fill(name, pattern, params, used) {
  return pattern.replace(/([:*])([A-Za-z_][A-Za-z0-9_]*)/g, (_, kind, key) => {
    const value = params[key]
    if (value == null || value === '') throw new Error(`Missing parameter "${key}" for route ${name} (${pattern})`)
    used.add(key)
    return kind === '*' ? String(value).split('/').map(encodeURIComponent).join('/') : encodeURIComponent(String(value))
  })
}

// Optional groups such as "(/:page)" are kept only when all their params are given.
function expand(name, pattern, params, used) {
  let path = pattern
  let previous
  do {
    previous = path
    path = path.replace(/\(([^()]*)\)/g, (_, group) =>
      paramNames(group).every(key => params[key] != null && params[key] !== '') ? group : '')
  } while (path !== previous)
  return fill(name, path, params, used)
}

function query(params, used) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (used.has(key) || value == null) continue
    if (Array.isArray(value)) value.forEach(item => search.append(`${key}[]`, String(item)))
    else search.append(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

/**
 * Resolves a named route to Inertia's { url, method } pair. It also converts to
 * its URL wherever a string is expected, e.g. href=route('tasks.show', task.id).
 */
export function route(name, params) {
  const { method, path } = lookup(name)
  const values = normalizeParams(name, path, params)
  const used = new Set()
  const url = expand(name, path, values, used) + query(values, used)
  return { url, method: method.toLowerCase(), toString: () => url }
}

// "tasks.update" or "tutor/students.show"; never an HTTP method or a URL.
export function isRouteName(value) {
  return typeof value === 'string' && /^\w[\w/]*\.\w+$/.test(value) && !METHODS.includes(value.toLowerCase())
}

// Accepts submit('tasks.update', params, options) and returns core's pair form.
export function expandRouteSubmission(args) {
  if (!isRouteName(args[0])) return args
  const [name, params, options] = args
  return [route(name, params), options ?? {}]
}
