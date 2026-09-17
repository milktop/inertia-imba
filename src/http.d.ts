import type { FormDataType, HttpResponse, HttpProgressEvent, Method, UrlMethodPair, UseFormWithPrecognitionArguments } from '@inertiajs/core'
import type { Endpoint, FormErrors, FormState, InitialData, Precognition } from './form.js'

/** Only options implemented by this adapter's JSON helper are exposed. */
export interface HttpOptions<T, Response> {
  headers?: Record<string, string>
  optimistic?: (data: T) => Partial<T> | void
  onBefore?: () => boolean | void
  onStart?: () => void
  onProgress?: (progress: HttpProgressEvent) => void
  onSuccess?: (data: Response | null, response: HttpResponse) => void | Promise<void>
  onError?: (errors: FormErrors<T>) => void | Promise<void>
  onHttpException?: (response: HttpResponse) => void | Promise<void>
  onNetworkError?: (error: Error) => void | Promise<void>
  onFinish?: () => void | Promise<void>
  onCancel?: () => void | Promise<void>
  onCancelToken?: (token: { cancel(): void }) => void
}
export type HttpSubmitArguments<T, R, Bound extends boolean> =
  | [method: Method, url: string, options?: HttpOptions<T, R>]
  | [endpoint: UrlMethodPair, options?: HttpOptions<T, R>]
  | (Bound extends true ? [options?: HttpOptions<T, R>] : never)

export interface HttpMethods<T extends object, R, Bound extends boolean> extends FormState<T> {
  /** Apply form-data changes for the next request, with rollback on failure. */
  optimistic(callback: (data: T) => Partial<T> | void): this
  response: R | null
  withAllErrors(): this
  withPrecognition(...endpoint: UseFormWithPrecognitionArguments): HttpForm<T, R, true> & Precognition<T>
  /** Resolves undefined for 422 validation, null for an empty response; other failures reject. */
  submit(...args: HttpSubmitArguments<T, R, Bound>): Promise<R | null | undefined>
  get(url: string, options?: HttpOptions<T, R>): Promise<R | null | undefined>
  post(url: string, options?: HttpOptions<T, R>): Promise<R | null | undefined>
  put(url: string, options?: HttpOptions<T, R>): Promise<R | null | undefined>
  patch(url: string, options?: HttpOptions<T, R>): Promise<R | null | undefined>
  delete(url: string, options?: HttpOptions<T, R>): Promise<R | null | undefined>
}
export type HttpForm<T extends object, R = unknown, Bound extends boolean = false> = T & HttpMethods<T, R, Bound>

export function useHttp(): HttpForm<Record<never, never>>
export function useHttp<T extends FormDataType<T>, R = unknown>(endpoint: () => UrlMethodPair, data: InitialData<T>): HttpForm<T, R, true>
export function useHttp<T extends FormDataType<T>, R = unknown>(data: InitialData<T>): HttpForm<T, R>
export function useHttp<T extends FormDataType<T>, R = unknown>(rememberKey: string, data: InitialData<T>): HttpForm<T, R>
/** A bound HTTP endpoint does not enable validation until withPrecognition() is called. */
export function useHttp<T extends FormDataType<T>, R = unknown>(endpoint: Endpoint, data: InitialData<T>): HttpForm<T, R, true>
export function useHttp<T extends FormDataType<T>, R = unknown>(method: Method | (() => Method), url: string | (() => string), data: InitialData<T>): HttpForm<T, R, true>
export function requestHeaders(url: string, json: boolean, supplied?: Record<string, string>, document?: Document): Record<string, string>
