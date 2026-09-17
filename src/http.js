import {
  hasFiles, http, HttpCancelledError, HttpNetworkError, HttpResponseError,
  mergeDataIntoQueryString, objectToFormData, UseFormUtils,
} from '@inertiajs/core'
import { commit } from 'imba'
import { useForm } from './form.js'

import { requestHeaders } from './requestHeaders.js'
export { requestHeaders } from './requestHeaders.js'

export function useHttp(...args) {
  const { data, rememberKey, precognitionEndpoint: endpoint } = UseFormUtils.parseUseFormArguments(...args)
  const initial = typeof data === 'function' ? data() : data
  const form = rememberKey ? useForm(rememberKey, initial) : useForm(initial)
  const setDefaults = form.defaults
  let defaultsVersion = 0
  let active = null
  let successTimer = null
  let allErrors = false

  form.response = null
  form.defaults = (...values) => {
    defaultsVersion++
    return setDefaults(...values)
  }
  form.withAllErrors = () => { allErrors = true; return form }
  form.resetAndClearErrors = (...fields) => form.reset(...fields).clearErrors(...fields)
  form.cancel = () => active?.abort()

  form.submit = async (...submission) => {
    const { method, url, options = {} } = UseFormUtils.parseSubmitArguments(submission, endpoint)
    if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) throw new Error(`Unsupported HTTP method: ${method}`)
    if (active) throw new Error('This useHttp instance already has a pending request; cancel and await it or use a separate instance')
    if (options.optimistic) throw new Error('useHttp optimistic updates are not supported yet')
    if (options.onBefore?.() === false) throw new HttpCancelledError('Request cancelled by onBefore', url)

    const controller = new AbortController()
    active = controller
    clearTimeout(successTimer)
    form.processing = true
    form.progress = null
    form.wasSuccessful = false
    form.recentlySuccessful = false
    form.response = null
    form.clearErrors()

    try {
      options.onCancelToken?.({ cancel: () => controller.abort() })
      options.onStart?.()
      const payload = form._transform ? form._transform(form.data()) : form.data()
      let requestUrl = url
      let body
      let json = false
      if (method === 'get') {
        ;[requestUrl] = mergeDataIntoQueryString(method, url, payload)
      } else if (hasFiles(payload)) {
        body = payload instanceof FormData ? payload : objectToFormData(payload)
      } else {
        body = JSON.stringify(payload)
        json = true
      }

      let response
      // Catch transport errors separately so user callback exceptions aren't
      // misreported as network errors or validation failures.
      try {
        if (controller.signal.aborted) throw new HttpCancelledError('Request was cancelled', url)
        response = await http.getClient().request({
          method, url: requestUrl, data: body,
          headers: requestHeaders(requestUrl, json, options.headers),
          signal: controller.signal,
          onUploadProgress: event => {
            form.progress = event
            commit()
            options.onProgress?.(event)
          },
        })
        if (controller.signal.aborted) throw new HttpCancelledError('Request was cancelled', url)
        if (response.status < 200 || response.status >= 300) {
          throw new HttpResponseError(`Request failed with status ${response.status}`, response, url)
        }
      } catch (error) {
        if (error instanceof HttpResponseError) {
          if (error.response.status === 422) {
            const errors = JSON.parse(error.response.data).errors || {}
            form.setError(Object.fromEntries(Object.entries(errors).map(([field, messages]) => [
              field, allErrors ? messages : Array.isArray(messages) ? messages[0] : messages,
            ])))
            await options.onError?.(form.errors)
            return undefined
          }
          await options.onHttpException?.(error.response)
        } else if (error instanceof HttpCancelledError || error?.name === 'AbortError') {
          await options.onCancel?.()
          throw new HttpCancelledError('Request was cancelled', url)
        } else if (error instanceof HttpNetworkError) {
          await options.onNetworkError?.(error)
        }
        throw error
      }

      const result = response.data ? JSON.parse(response.data) : null
      form.response = result
      form.wasSuccessful = true
      form.recentlySuccessful = true
      successTimer = setTimeout(() => { form.recentlySuccessful = false; commit() }, 2000)
      commit()
      const version = defaultsVersion
      await options.onSuccess?.(result, response)
      if (version === defaultsVersion) form.defaults()
      return result
    } finally {
      active = null
      form.processing = false
      form.progress = null
      commit()
      await options.onFinish?.()
    }
  }

  // useForm's verb helpers call form.submit dynamically, so they now dispatch
  // plain HTTP requests while retaining the same field/reset/error interface.
  return form
}
