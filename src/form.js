import { router, UseFormUtils } from '@inertiajs/core'
import { commit } from 'imba'
import { cloneDeepWith, isEqualWith } from 'es-toolkit'
import { get, has, set, toPath } from 'es-toolkit/compat'
import { rememberObject } from './remember.js'
import { withPrecognition } from './precognition.js'

// Files are immutable: retain their identity and metadata across defaults/reset.
const isBlob = value => typeof Blob !== 'undefined' && value instanceof Blob
const clone = value => cloneDeepWith(value, item => isBlob(item) ? item : undefined)
const equal = (left, right) => isEqualWith(left, right, (a, b) =>
  isBlob(a) || isBlob(b) ? a === b : undefined)

// Never let a caller-provided path traverse a prototype or mutate helper methods.
function checkPath(field) {
  if (typeof field !== 'string' || !field.length ||
      toPath(field).some(key => ['__proto__', 'constructor', 'prototype'].includes(key))) {
    throw new Error(`Invalid form field path: ${field}`)
  }
}

export function useForm(...args) {
  const { rememberKey, data, precognitionEndpoint } = UseFormUtils.parseUseFormArguments(...args)
  const initialData = typeof data === 'function' ? data() : data
  let defaults = clone(initialData)
  let recentlySuccessfulTimer = null
  let cancelToken = null
  let defaultsVersion = 0
  const excluded = new Set()
  let saveRemembered = () => {}

  let form = {
    ...clone(initialData),
    errors: {},
    hasErrors: false,
    processing: false,
    progress: null,
    wasSuccessful: false,
    recentlySuccessful: false,

    // A getter observes nested edits made through ordinary Imba bindings.
    get isDirty() { return !equal(form.data(), defaults) },

    data() {
      return Object.fromEntries(Object.keys(defaults).map((key) => [key, form[key]]))
    },

    transform(callback) {
      form._transform = callback
      return form
    },

    defaults(field, value) {
      const updates = typeof field === 'string' ? { [field]: value } : field
      if (arguments.length) {
        for (const path of Object.keys(updates)) {
          checkPath(path)
          const root = Object.hasOwn(defaults, path) ? path : toPath(path)[0]
          if (!Object.hasOwn(defaults, root) && Object.hasOwn(form, root)) {
            throw new Error(`Form field conflicts with a helper: ${root}`)
          }
        }
      }
      defaultsVersion++
      if (!arguments.length) defaults = clone(form.data())
      else for (const [path, next] of Object.entries(updates)) set(defaults, path, clone(next))
      commit()
      return form
    },

    reset(...fields) {
      fields.forEach(checkPath)
      const data = form.data()
      const keys = fields.length ? fields : Object.keys(defaults)
      for (const path of keys) {
        if (has(defaults, path)) set(data, path, clone(get(defaults, path)))
      }
      for (const key of Object.keys(defaults)) form[key] = data[key]
      commit()
      return form
    },

    setError(field, value) {
      Object.assign(form.errors, typeof field === 'object' ? field : { [field]: value })
      form.hasErrors = Object.keys(form.errors).length > 0
      commit()
      return form
    },

    clearErrors(...fields) {
      if (!fields.length) form.errors = {}
      else for (const field of fields) delete form.errors[field]
      form.hasErrors = Object.keys(form.errors).length > 0
      commit()
      return form
    },

    resetAndClearErrors(...fields) {
      return form.reset(...fields).clearErrors(...fields)
    },

    cancel() {
      cancelToken?.cancel()
    },

    dontRemember(...fields) {
      for (const field of fields) excluded.add(field)
      saveRemembered()
      return form
    },

    withPrecognition(...args) {
      return withPrecognition(form, ...args)
    },

    submit(method, url, options = {}) {
      const data = form._transform ? form._transform(form.data()) : form.data()
      const visitOptions = {
        ...options,
        data,
        onCancelToken: (token) => {
          cancelToken = token
          return options.onCancelToken?.(token)
        },
        onStart: (visit) => {
          clearTimeout(recentlySuccessfulTimer)
          form.processing = true
          form.progress = null
          form.wasSuccessful = false
          form.recentlySuccessful = false
          commit()
          return options.onStart?.(visit)
        },
        onProgress: (event) => {
          form.progress = event
          commit()
          return options.onProgress?.(event)
        },
        onSuccess: async (page) => {
          form.clearErrors()
          form.wasSuccessful = true
          form.recentlySuccessful = true
          clearTimeout(recentlySuccessfulTimer)
          recentlySuccessfulTimer = setTimeout(() => {
            form.recentlySuccessful = false
            commit()
          }, 2000)
          commit()
          const version = defaultsVersion
          const result = await options.onSuccess?.(page)
          if (version === defaultsVersion) form.defaults()
          return result
        },
        onError: (errors) => {
          form.errors = errors
          form.hasErrors = Object.keys(errors).length > 0
          commit()
          return options.onError?.(errors)
        },
        onFinish: (visit) => {
          cancelToken = null
          form.processing = false
          form.progress = null
          commit()
          return options.onFinish?.(visit)
        }
      }

      return method === 'delete'
        ? router.delete(url, visitOptions)
        : router[method](url, data, visitOptions)
    },

    get(url, options) { return form.submit('get', url, options) },
    post(url, options) { return form.submit('post', url, options) },
    put(url, options) { return form.submit('put', url, options) },
    patch(url, options) { return form.submit('patch', url, options) },
    delete(url, options) { return form.submit('delete', url, options) }
  }

  if (rememberKey !== null) {
    const restored = router.restore(rememberKey)
    for (const field of Object.keys(defaults)) {
      if (restored?.data && Object.hasOwn(restored.data, field)) form[field] = clone(restored.data[field])
    }
    form.errors = clone(restored?.errors ?? {})
    form.hasErrors = Object.keys(form.errors).length > 0
    const remembered = rememberObject(form, rememberKey, () => ({
      data: Object.fromEntries(Object.entries(form.data()).filter(([field]) => !excluded.has(field))),
      errors: Object.fromEntries(Object.entries(form.errors).filter(([field]) =>
        ![...excluded].some(key => field === key || field.startsWith(`${key}.`)))),
    }))
    form = remembered.proxy
    saveRemembered = remembered.save
  }
  return precognitionEndpoint ? form.withPrecognition(precognitionEndpoint) : form
}
