# Remembered state, Head, and Link prefetching

## Problem and implementation

Drafts previously disappeared on history navigation; titles needed application
code to reset them; links could not opt into Inertia's prefetch cache.

- Keyed `useForm` and `useHttp` save data/errors through core history APIs.
  `useRemember` handles other page-local objects/arrays. Proxy observation catches
  nested binding edits and batches writes. Page scopes stop late callbacks from
  removed pages from saving into the next page, while preserved pages keep saving.
- `dontRemember` excludes top-level fields and related error keys. Files/Blobs
  become null in history snapshots without changing live form data. Status flags
  and defaults are not remembered. Use JSON-compatible state.
- `Head` registers with Inertia's head manager, serializes native child markup,
  and cleans up its provider and observer on unmount. Imba's compiled `head-key`
  property is translated into the core `data-inertia` deduplication attribute.
- `Link prefetch=true` (or `"hover"`) schedules prefetch on hover/focus after 75ms.
  Pending timers are cancelled on leave/blur/click/unmount. Native-only link
  destinations remain native. Core owns the cache and accepts cacheFor/cacheTags.

The Students fixture now uses a remembered form and page Head. The layout supplies
a fallback title and opt-in prefetch links, replacing its ad hoc title subscription.
No Rails routes or controller behavior changed.

## Verification

Unit regressions cover restoring/resetting nested drafts and errors, exclusions,
file snapshots, removed/preserved page scopes, prefetch timing and native links,
and head key translation/update cleanup. Production fixture build also passes.

Browser checks against the existing app on localhost:3000 verified draft + error
restoration on Back, dirty state, reset controls, Students → About title fallback,
description metadata insertion/removal, and no console warnings/errors. Focusing
Students on About triggered one GET; activating that link reused the response
without another GET (verified against the Rails request log). No student
record was created; only invalid submissions were used.

## Follow-up

Precognition can use the existing Students create action with a validation-only
branch and tests asserting no record creation. No separate validation route is
needed. Mount/click prefetch modes, usePrefetch, persistent-layout remembering,
and SSR remain outside this implementation.
