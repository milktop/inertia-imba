import type {
  FormDataKeys, FormDataValues, FormDataType, HttpResponse, Method, Progress,
  OptimisticCallback, Page, UrlMethodPair, UseFormSubmitOptions, UseFormWithPrecognitionArguments,
} from '@inertiajs/core'

/** Rails may return arrays; Precognition simplifies them unless withAllErrors() is enabled. */
export type ErrorMessage = string | string[]
export type FormErrors<T> = Partial<Record<FormDataKeys<T>, ErrorMessage>>
export type FormKey<T> = Extract<keyof T, string>
export type InitialData<T> = T | (() => T)
export type Endpoint = UrlMethodPair | (() => UrlMethodPair)
export type NamedInput = { target: { name: string } }

export interface FormState<T extends object> {
  errors: FormErrors<T>
  hasErrors: boolean
  /** True while a submission is in flight; validation has its own validating flag. */
  processing: boolean
  /** Upload progress, cleared when the request finishes or is cancelled. */
  progress: Progress | null | undefined
  wasSuccessful: boolean
  recentlySuccessful: boolean
  /** Includes nested edits compared with the current defaults. */
  readonly isDirty: boolean
  data(): T
  transform<U extends FormDataType<U>>(callback: (data: T) => U | FormData): this
  /** Make the current data the defaults used by reset(). */
  defaults(): this
  defaults<K extends FormDataKeys<T>>(field: K, value: FormDataValues<T, K>): this
  defaults(values: { [K in FormDataKeys<T>]?: FormDataValues<T, K> }): this
  /** Reset whole fields or dotted paths, including numeric array indices. */
  reset(...fields: FormDataKeys<T>[]): this
  resetAndClearErrors(...fields: FormDataKeys<T>[]): this
  setError(field: FormDataKeys<T>, message: ErrorMessage): this
  setError(errors: FormErrors<T>): this
  clearErrors(...fields: FormDataKeys<T>[]): this
  /** Exclude these top-level fields and their errors from keyed history state. */
  dontRemember(...fields: FormKey<T>[]): this
  cancel(): void
}

export interface ValidationOptions<T> {
  only?: FormDataKeys<T>[]
  headers?: Record<string, string>
  onBefore?: () => boolean | void
  onStart?: () => void
  onValidationError?: (response: HttpResponse) => void | Promise<void>
  onPrecognitionSuccess?: (response: HttpResponse) => void | Promise<void>
  onFinish?: () => void | Promise<void>
}

export interface Precognition<T> {
  validating: boolean
  validationError: unknown | null
  /** Debounced validation; returns the form, not a request promise. */
  validate(options?: ValidationOptions<T>): this
  validate(field: FormDataKeys<T> | NamedInput, options?: ValidationOptions<T>): this
  touch(field: FormDataKeys<T> | NamedInput, ...fields: FormDataKeys<T>[]): this
  touch(fields: FormDataKeys<T>[]): this
  touched(field?: FormDataKeys<T> | NamedInput): boolean
  valid(field: FormDataKeys<T> | NamedInput): boolean
  invalid(field: FormDataKeys<T> | NamedInput): boolean
  setValidationTimeout(milliseconds: number): this
  validateFiles(): this
  withoutFileValidation(): this
  withAllErrors(): this
  cancelValidation(): void
}

export type FormSubmitArguments<Bound extends boolean> =
  | [method: Method, url: string, options?: UseFormSubmitOptions]
  | [endpoint: UrlMethodPair, options?: UseFormSubmitOptions]
  | [route: `${string}.${string}`, params?: import('./routes.js').RouteParams, options?: UseFormSubmitOptions]
  | (Bound extends true ? [endpoint: UrlMethodPair, options?: UseFormSubmitOptions] | [options?: UseFormSubmitOptions] : never)

export interface FormMethods<T extends object, Bound extends boolean> extends FormState<T> {
  /** Apply page-prop changes for the next submission; Inertia handles rollback. */
  optimistic<TProps = Page['props']>(callback: OptimisticCallback<TProps>): this
  withPrecognition(...endpoint: UseFormWithPrecognitionArguments): PrecognitiveForm<T>
  submit(...args: FormSubmitArguments<Bound>): void
  get(url: string, options?: UseFormSubmitOptions): void
  post(url: string, options?: UseFormSubmitOptions): void
  put(url: string, options?: UseFormSubmitOptions): void
  patch(url: string, options?: UseFormSubmitOptions): void
  delete(url: string, options?: UseFormSubmitOptions): void
}

export type Form<T extends object> = T & FormMethods<T, false>
export type PrecognitiveForm<T extends object> = T & FormMethods<T, true> & Precognition<T>

export function useForm(): Form<Record<never, never>>
export function useForm<T extends FormDataType<T>>(endpoint: () => UrlMethodPair, data: InitialData<T>): PrecognitiveForm<T>
export function useForm<T extends FormDataType<T>>(data: InitialData<T>): Form<T>
export function useForm<T extends FormDataType<T>>(rememberKey: string, data: InitialData<T>): Form<T>
export function useForm<T extends FormDataType<T>>(endpoint: Endpoint, data: InitialData<T>): PrecognitiveForm<T>
export function useForm<T extends FormDataType<T>>(method: Method | (() => Method), url: string | (() => string), data: InitialData<T>): PrecognitiveForm<T>
