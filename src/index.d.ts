import type { Page, PageProps, ProgressOptions, VisitOptions, PrefetchOptions, Router } from '@inertiajs/core'
export { router, progress } from '@inertiajs/core'
export { useForm } from './form.js'
export type { Form, PrecognitiveForm, FormState, FormErrors, ErrorMessage, ValidationOptions, Precognition } from './form.js'
export { useHttp } from './http.js'
export type { HttpForm, HttpOptions } from './http.js'

/** Browser-only setup. The resolver may return a tag class or a page module. */
export function createInertiaApp(options: CreateInertiaAppOptions): Promise<void>
export interface TagConstructor {
  new (...args: any[]): object
  layout?: TagConstructor | null | false
}
export type PageComponent = TagConstructor | { default: TagConstructor; layout?: TagConstructor | null | false }
export interface AppProps {
  initialPage: Page
  initialComponent: PageComponent
  resolveComponent(name: string, page: Page): Promise<PageComponent>
  defaultLayout?: CreateInertiaAppOptions['layout']
}
export interface CreateInertiaAppOptions {
  resolve(name: string, page: Page): PageComponent | Promise<PageComponent>
  id?: string
  page?: Page
  dev?: boolean
  title?: (title: string, page: Page | null) => string
  progress?: ProgressOptions | false
  layout?: (name: string, page: Page) => TagConstructor | null | false | undefined
  setup?: (context: { el: HTMLElement; App: TagConstructor; props: AppProps }) => unknown | Promise<unknown>
}

export function getPage<T extends PageProps = PageProps>(): Page<T> | null
export function onPageChange<T extends PageProps = PageProps>(listener: (page: Page<T>) => void): () => void
/** Mutate the returned object; the key identifies its history entry. Files restore as null. */
export type Remembered<T> = T extends Blob ? null
  : T extends Date | Function ? T
  : T extends object ? { [K in keyof T]: Remembered<T[K]> } : T
export function useRemember<T extends object>(initialData: T, key?: string): Remembered<T>
export function usePoll(...args: Parameters<Router['poll']>): ReturnType<Router['poll']>

export interface LinkProps {
  href?: string
  replace?: boolean
  preserveState?: VisitOptions['preserveState']
  preserveScroll?: VisitOptions['preserveScroll']
  only?: string[]
  except?: string[]
  headers?: Record<string, string>
  prefetch?: boolean | 'prefetch' | 'hover'
  cacheFor?: PrefetchOptions['cacheFor']
  cacheTags?: string[]
}
/** An Imba anchor tag; navigation is GET-only. Native anchor attributes also work. */
export declare class Link extends HTMLAnchorElement {}
export interface Link extends Omit<LinkProps, 'href'> {}
export declare class Head { title?: string }
export interface DeferredProps {
  data: string | string[]
  /** Evaluated only when all requested props exist; ordinary slots evaluate eagerly. */
  content?: (props: PageProps) => unknown
}
export declare class Deferred implements DeferredProps {
  data: string | string[]
  content?: DeferredProps['content']
}
export interface WhenVisibleProps {
  data?: string | string[]
  params?: Parameters<Router['reload']>[0]
  buffer?: number
  always?: boolean
  content?: (props: PageProps) => unknown
}
export declare class WhenVisible implements WhenVisibleProps {
  data?: string | string[]
  params?: WhenVisibleProps['params']
  buffer?: number
  always?: boolean
  content?: WhenVisibleProps['content']
  retry(): void
}
