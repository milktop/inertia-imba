import type { UrlMethodPair } from '@inertiajs/core'

/** "controller.action" → method and path pattern, as exported by the server. */
export type RouteTable = Record<string, { method: string; path: string }>
/** Named params, or a scalar for a route's only required param. */
export type RouteParams = Record<string, unknown> | string | number
/** Inertia's url/method pair; converts to its URL where a string is expected. */
export interface RouteTarget extends UrlMethodPair {
  toString(): string
}
export function route(name: string, params?: RouteParams): RouteTarget
