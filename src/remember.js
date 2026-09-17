import { router } from '@inertiajs/core'
import { cloneDeepWith } from 'es-toolkit'
import { getPageScope } from './page.js'

// Only plain objects/arrays are observed. Files and dates must keep native methods.
const observable = value => value && (Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype)
export const historySnapshot = value => cloneDeepWith(value, item =>
  typeof Blob !== 'undefined' && item instanceof Blob ? null : undefined)

export function rememberObject(value, key, snapshot) {
  const scope = getPageScope()
  const proxies = new WeakMap()
  let queued = false
  const save = () => {
    if (queued) return
    queued = true
    queueMicrotask(() => {
      queued = false
      // A removed page's late callbacks must not overwrite the next page's history.
      if (scope === getPageScope()) router.remember(historySnapshot(snapshot ? snapshot() : proxy), key)
    })
  }
  const observe = target => {
    if (!observable(target)) return target
    if (proxies.has(target)) return proxies.get(target)
    const result = new Proxy(target, {
      get: (object, field, receiver) => observe(Reflect.get(object, field, receiver)),
      set(object, field, next) {
        const changed = object[field] !== next
        const result = Reflect.set(object, field, next)
        if (changed) save()
        return result
      },
      deleteProperty(object, field) {
        const result = Reflect.deleteProperty(object, field)
        save()
        return result
      },
    })
    proxies.set(target, result)
    proxies.set(result, result)
    return result
  }
  const proxy = observe(value)
  return { proxy, save }
}

export function useRemember(initialData, key = 'default') {
  const restored = router.restore(key)
  return rememberObject(historySnapshot(restored ?? initialData), key).proxy
}
