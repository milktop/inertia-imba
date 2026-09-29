# Adapter API and editor hints

The package includes TypeScript declarations for its root import and the
`@milktop/inertia-imba/form` and `@milktop/inertia-imba/http` subpaths. Names follow Inertia's
other adapters: `isDirty`, `processing`, `recentlySuccessful`, and
`resetAndClearErrors` retain their familiar spelling.

Declarations improve TypeScript and JavaScript/JSDoc tooling without changing
runtime behavior. Inline `.imba` completion depends on the Imba language extension;
this work does not add or verify an Imba language-server integration. The type
checks use `moduleResolution: "Bundler"`, matching the fixture's Vite setup.

## Forms

Data is inferred from the initial object or factory. For nullable uploads or a
shared data interface, provide an explicit type:

```ts
import { useForm } from '@milktop/inertia-imba'

interface StudentDraft {
  name: string
  email: string
  attachment: File | null
}

const form = useForm<StudentDraft>('Students/Create', {
  name: '', email: '', attachment: null,
}).withPrecognition('post', '/students')

form.name = 'Ada'
form.validate({ only: ['name'] })
form.submit({ preserveScroll: true })
```

Field names and values are checked. `reset`, `defaults`, `resetAndClearErrors`,
validation and error helpers accept dotted paths such as `profile.name` and
`students.0.email`. `defaults` checks the value type at that path, including maps
such as `{ "profile.age": 21 }`. `dontRemember` accepts top-level keys only. Use data keys
that do not collide with helper properties such as `errors` or `processing`.

Errors are typed as `string | string[] | undefined`: Rails may return arrays,
and `withAllErrors()` keeps arrays in Precognition and HTTP validation responses.
It does not normalize every server response into arrays. Narrow the value before
using string-only methods. Upload `progress` is absent before/after a request,
and its `percentage` may be undefined.

A plain form requires `submit(method, url, options)` or a verb helper such as
`post(url, options)`. `.withPrecognition(...)` enables validation methods and
allows `submit(options)` with the configured endpoint. The endpoint constructor
forms of `useForm` also enable Precognition. Validation is explicitly triggered;
`validate()` schedules a debounced request and returns the form, not a promise.

## JSON requests

`useHttp` uses the same field/reset interface but returns a promise. Its optional
second generic describes the JSON response:

```ts
import { useHttp } from '@milktop/inertia-imba'

const preview = useHttp<{ name: string }, { message: string }>({ name: '' })
const result = await preview.post('/http-preview')
if (result) console.log(result.message)
```

A successful empty response resolves to `null`; validation errors resolve to
`undefined`; cancellation and other HTTP/network failures reject. `response` is
reset to `null` at the start of each request. Guard it before accessing fields.
Binding an HTTP endpoint at construction enables `submit()` but does not enable
validation: call `.withPrecognition(...)` explicitly for that.

JavaScript supports the same hints through JSDoc:

```js
// @ts-check
import { useHttp } from '@milktop/inertia-imba'

/** @type {import('@milktop/inertia-imba').HttpForm<{ name: string }, { message: string }>} */
const preview = useHttp({ name: '' })
```

## Optimistic updates

`useForm.optimistic(callback)` returns the form and updates page props for its
next submission. `LinkButton` accepts an `optimistic` prop with the same callback.
Inertia core handles reconciliation and rollback for these visits.

`useHttp.optimistic(callback)` instead updates its own data before transforming
and submitting it. The callback returns partial data with type-checked values.
Failure or cancellation restores the changed top-level fields before callbacks;
unrelated fields keep their current values. Success keeps the update and stores
server JSON separately in `response`.

Both submission option types accept `optimistic`; this overrides a pending
chained callback. Return partial updates rather than mutating callback arguments.
See [examples and rollback details](../README.md#optimistic-updates).

## Nested persistent layouts

Declare layouts outermost first on each page in a section:

```imba
import AppLayout from '../../layouts/app.imba'
import StudentsLayout from '../../layouts/students.imba'

export const layout = [AppLayout, StudentsLayout]
```

Each layout declares `prop pageContent` and renders `<{pageContent}>`. Pages with
this same chain keep both layout instances. Navigating to a page using only
`AppLayout` removes the Students layout; returning creates fresh section state.
Changing an outer layout also recreates its inner layouts.

The array replaces the application default, so include the app shell explicitly.
Single tags still work, and `null`, `false`, or `[]` opts out. The default layout
callback can also return an array. See the [full README example](../README.md#nested-persistent-layouts)
and try Students → Student reports in the fixture.

## Action buttons

```imba
import { LinkButton } from '@milktop/inertia-imba'

<LinkButton href="/students/123" method="delete" confirm="Delete this student?" [c:gray4]>
    "Delete student"
```

This renders a native button, so inline styles and classes target the clickable
element directly. `method` defaults to POST. `data` supplies a payload. The optional
confirmation appears before a request; cancellation does nothing. Processing
sets native disabled and `data-loading`; completion clears them while respecting
any explicit disabled prop. `bind:processing=updating` exposes loading state to the parent, and `cancel()`
cancels an in-flight request. Processing is an output: parent writes do not control
the internal request lifecycle. `@error` receives a bubbling CustomEvent with
`event.detail.errors` for Inertia validation errors; network failures and server
exceptions retain core handling. Action buttons never prefetch. Use `Link` for GET anchors.

The separate export is deliberate: Imba cannot switch a native tag's element
based on props without introducing a wrapper. See [the full action-button guide](../README.md#action-buttons)
for options and styling, and use `useForm` for richer form state and callbacks.

## Supported surface

| API | Supported behavior | Differences and limits |
| --- | --- | --- |
| `createInertiaApp` | Browser mounting, async page resolver, custom setup, titles and progress | No SSR; single or nested layouts, with shared outer instances preserved |
| `useForm` | Data, dirty tracking, defaults/reset, errors, transforms, verbs, progress/cancel, remembered state, optimistic page props | Plain forms do not have Precognition-only methods; Inertia submissions return void |
| Precognition | Bound endpoints, field-specific validation, touch/valid/invalid, debounce, file opt-in, all errors | Explicit triggers; no `validator()`, wildcard paths, or full upstream callbacks |
| `useHttp` | JSON and multipart requests, callbacks, remembered drafts, optimistic data, optional Precognition | No Inertia visit options; one active request per instance |
| `useRemember` | Deep mutations of plain objects/arrays saved in history | Files become null; use serializable data |
| `getPage`, `onPageChange` | Current page and subscription | `getPage()` can be null before mounting; unsubscribe when finished |
| `Link` | GET navigation, native anchor behavior, hover/focus prefetch, cache duration/tags | No non-GET buttons or mount/click prefetch modes |
| `LinkButton` | Native POST/PUT/PATCH/DELETE buttons, payloads, optional confirmation, automatic disabling, bindable processing, validation error events, cancel, optimistic page props | Separate from GET Link; no prefetch; same-origin actions |
| `Head` | Titles and keyed head entries with cleanup | Browser-only |
| `Deferred` | One/multiple props, fallback/rescue slots, lazy `content` callback | Ordinary Imba child expressions evaluate eagerly; no reloading indicator API |
| `WhenVisible` | Partial reloads, buffer, repeat opt-in, retry, unmount cancellation | Supply data or reload params; remount when changing observer configuration |
| `usePoll` | Core polling options, start/stop/destroy, page cleanup | Destroy explicitly on component unmount within a preserved page |
| `router`, `progress` | Re-exported from Inertia core | Core's own type definitions apply |

Type exports include `Form`, `PrecognitiveForm`, `HttpForm`, `FormErrors`,
`ValidationOptions`, `HttpOptions`, `LinkProps`, `LinkButtonProps`, `LinkButtonErrorDetail`, `DeferredProps`,
`WhenVisibleProps`, `LayoutDeclaration`, and `CreateInertiaAppOptions`. These are type-only exports.
They do not add runtime helpers or components.

## Checks

Run `npm run test:types` for positive examples and expected compiler failures.
The examples import package exports (including both subpaths), so missing export
conditions or declaration files fail the check. Cases cover field inference,
callback arguments, endpoint overloads, JavaScript/JSDoc, and rejection of
unsupported features. Existing runtime tests cover the corresponding behavior.

CI also runs unit tests, Rails tests, frontend compilation, and browser regressions.
TypeScript and Axios are development dependencies; Axios is needed only to check
Inertia core's optional Axios declarations with full library checking enabled.
