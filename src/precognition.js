import { hasFiles, http, HttpResponseError, mergeDataIntoQueryString, objectToFormData, UseFormUtils } from '@inertiajs/core'
import { cloneDeepWith, isEqualWith } from 'es-toolkit'
import { get } from 'es-toolkit/compat'
import { commit } from 'imba'
import { requestHeaders } from './requestHeaders.js'
import { getPageScope } from './page.js'

const instances = new WeakMap()
const isBlob = value => typeof Blob !== 'undefined' && value instanceof Blob
const clone = value => cloneDeepWith(value, item => isBlob(item) ? item : undefined)
const equal = (a, b) => isEqualWith(a, b, (left, right) =>
  isBlob(left) || isBlob(right) ? left === right : undefined)
const fieldName = field => typeof field === 'string' ? field : field.target.name
const withoutFiles = data => {
  if (typeof Blob !== 'undefined' && data instanceof Blob) return undefined
  if (Array.isArray(data)) return data.map(value => withoutFiles(value) ?? null)
  if (data && Object.getPrototypeOf(data) === Object.prototype) {
    return Object.fromEntries(Object.entries(data).filter(([, value]) =>
      !(typeof Blob !== 'undefined' && value instanceof Blob)).map(([key, value]) => [key, withoutFiles(value)]))
  }
  return data
}

export function withPrecognition(form, ...args) {
  const endpoint = UseFormUtils.createWayfinderCallback(...args)
  if (instances.has(form)) {
    instances.get(form)(endpoint)
    return form
  }

  let resolveEndpoint = endpoint
  let timeout = 300
  let timer
  let controller
  let generation = 0
  let allErrors = false
  let files = false
  const touched = new Set()
  const validated = new Map()
  const scope = getPageScope()
  const stop = () => {
    generation++
    clearTimeout(timer)
    controller?.abort()
    controller = null
    form.validating = false
    commit()
  }
  instances.set(form, next => { stop(); resolveEndpoint = next })

  // Validation has its own request lifecycle; it never changes submission state.
  form.validating = false
  form.validationError = null
  form.cancelValidation = stop
  form.setValidationTimeout = duration => {
    if (!Number.isFinite(duration) || duration < 0) throw new Error('Validation timeout must be a non-negative number')
    timeout = duration
    return form
  }
  const previousAllErrors = form.withAllErrors
  form.withAllErrors = () => { allErrors = true; previousAllErrors?.(); return form }
  form.validateFiles = () => { files = true; return form }
  form.withoutFileValidation = () => { files = false; return form }
  form.touch = (field, ...fields) => {
    for (const name of Array.isArray(field) ? field : [fieldName(field), ...fields]) touched.add(name)
    commit()
    return form
  }
  form.touched = field => field === undefined ? touched.size > 0 : touched.has(fieldName(field))
  form.invalid = field => Object.hasOwn(form.errors, fieldName(field))
  form.valid = field => {
    const name = fieldName(field)
    return validated.has(name) && !form.invalid(name) && equal(validated.get(name), get(form.data(), name))
  }

  form.validate = (field, options = {}) => {
    if (field && typeof field === 'object' && !('target' in field)) {
      options = field
      field = undefined
    }
    if (field !== undefined) touched.add(fieldName(field))
    const only = Array.from(options.only ?? touched)
    if (!only.length) only.push(...Object.keys(form.data()))
    const fields = files ? only : only.filter(name => !hasFiles(get(form.data(), name)))
    if (!fields.length) return form
    only.forEach(name => touched.add(name))
    stop()
    form.validationError = null
    const requestGeneration = generation
    timer = setTimeout(() => run(fields, options, requestGeneration), timeout)
    return form
  }

  async function run(only, options, requestGeneration) {
    const active = () => generation === requestGeneration && scope === getPageScope()
    if (!active() || form.processing) return
    const original = clone(form.data())
    const fresh = () => active() && equal(original, form.data())
    let started = false
    try {
      if (options.onBefore?.() === false) return
      const { method, url } = resolveEndpoint()
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) throw new Error(`Unsupported validation method: ${method}`)
      let data = form._transform ? form._transform(clone(original)) : original
      if (!files) data = withoutFiles(data)
      const multipart = hasFiles(data)
      let requestUrl = url
      let body
      if (method === 'get') [requestUrl] = mergeDataIntoQueryString(method, url, data)
      else body = multipart ? objectToFormData(data) : JSON.stringify(data)
      const headers = requestHeaders(requestUrl, method !== 'get' && !multipart, options.headers)
      // These headers identify validation-only requests; never send X-Inertia.
      for (const key of Object.keys(headers)) {
        if (['x-inertia', 'precognition', 'precognition-validate-only'].includes(key.toLowerCase())) delete headers[key]
      }
      headers.Precognition = 'true'
      headers['Precognition-Validate-Only'] = only.join(',')
      controller = new AbortController()
      form.validating = true
      started = true
      commit()
      options.onStart?.()
      let response
      try {
        response = await http.getClient().request({ method, url: requestUrl, data: body, headers, signal: controller.signal, timeout: 5000 })
      } catch (error) {
        if (!(error instanceof HttpResponseError)) throw error
        response = error.response
      }
      if (!fresh()) return
      const header = name => Object.entries(response.headers ?? {}).find(([key]) => key.toLowerCase() === name)?.[1]
      if (String(header('precognition')) !== 'true') throw new Error('The endpoint did not return a Precognition response')
      if (response.status === 422) {
        const payload = typeof response.data === 'string' ? JSON.parse(response.data) : response.data
        if (!payload?.errors || typeof payload.errors !== 'object') throw new Error('Invalid Precognition error response')
        form.clearErrors(...only)
        form.setError(Object.fromEntries(Object.entries(payload.errors).map(([key, value]) =>
          [key, allErrors || !Array.isArray(value) ? value : value[0]])))
        only.forEach(name => validated.set(name, clone(get(original, name))))
        await options.onValidationError?.(response)
      } else if (response.status === 204 && String(header('precognition-success')) === 'true') {
        form.clearErrors(...only)
        only.forEach(name => validated.set(name, clone(get(original, name))))
        await options.onPrecognitionSuccess?.(response)
      } else {
        throw new HttpResponseError('Unexpected Precognition response', response, url)
      }
    } catch (error) {
      if (active()) {
        form.validationError = error
        // A transport failure is not a field validation error.
        commit()
      }
    } finally {
      if (active()) {
        controller = null
        form.validating = false
        commit()
        if (started) {
          try { await options.onFinish?.() } catch (error) { form.validationError = error; commit() }
        }
      }
    }
  }

  // Reset/submission/unmount cancellation must also invalidate queued responses.
  const reset = form.reset
  form.reset = (...fields) => {
    stop()
    form.validationError = null
    for (const key of new Set([...touched, ...validated.keys()])) {
      if (!fields.length || fields.some(field => key === field || key.startsWith(`${field}.`))) {
        touched.delete(key)
        validated.delete(key)
      }
    }
    return reset(...fields)
  }
  const cancel = form.cancel
  form.cancel = () => { stop(); cancel() }
  const submit = form.submit
  form.submit = (...submission) => {
    stop()
    const { method, url, options } = UseFormUtils.parseSubmitArguments(submission, resolveEndpoint)
    return submit(method, url, options)
  }
  return form
}
