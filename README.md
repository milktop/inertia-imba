# Inertia.js Imba adapter (prototype)

An experimental client-side adapter for Inertia 3 and Imba 2.

## Rails setup

Keep using `inertia_rails` on the server. Put Imba pages in
`app/frontend/pages`. Use a JavaScript entrypoint so Vite Ruby discovers a
script rather than emitting the Imba source as a static asset:

```js
// app/frontend/entrypoints/inertia.js
import '../inertia.imba'
```

Then create `app/frontend/inertia.imba`:

```imba
import { createInertiaApp } from '@inertiajs/imba'

createInertiaApp({
  resolve: do(name)
    let pages = import.meta.glob('./pages/**/*.imba', { eager: true })
    pages["./pages/{name}.imba"]
})
```

Use an Inertia base controller for automatic rendering and instance-variable props:

```ruby
class InertiaController < ApplicationController
  inertia_config default_render: true
  use_inertia_instance_props
end

class StudentsController < InertiaController
  def index
    @students = Student.all.as_json(only: %i[id name email])
    @query = params[:query].to_s
  end
end
```

The default resolver maps this to `app/frontend/pages/students/index.imba`.
The page receives named Imba props, not a single `props` prop:

```imba
export default tag StudentsIndex
  prop students
  prop query

  <self>
    <h1> "Students"
    <p> "Searching for {query}"
    <ul> for student in students
      <li> student.name
```

## Links

`Link` is an imported, capitalized tag backed by a native `<a>` element. It does
not require a globally named lowercase tag or Imba's `route-to` router.

```imba
import { Link } from '@inertiajs/imba'

<Link href="/students"> "Students"
<Link href="/students?diagnostics=1" preserveState=true preserveScroll=true> "Details"
<Link href="/about" target="_blank"> "Open About in a new tab"
```

Normal left clicks and Enter activation perform Inertia GET visits. Modifier
keys, other mouse buttons, downloads, external URLs, other browsing targets,
and same-page fragments retain browser behaviour. Labels and nested markup use
Imba's normal child content, rendered through the tag's slot.

Supported visit props: `replace`, `preserveState`, `preserveScroll`, `only`,
`except`, and `headers`. Native anchor attributes such as `title`, `target`,
`download`, and accessibility attributes remain available. Query data belongs
in `href`, so opening a new tab follows the same URL.

This first version is for GET navigation. Use `useForm` or the exported router
for POST/PATCH/DELETE actions. Visit callbacks, loading indicators,
and an `as`/button variant are not implemented yet.

Enable prefetching explicitly with `<Link href="/students" prefetch=true>`.
`prefetch="hover"` is equivalent. Hover or keyboard focus starts a request after
75ms; leaving, blurring, clicking, or unmounting cancels the pending timer.
`cacheFor` defaults to 30000ms and accepts core cache durations (e.g. `'1m'`);
`cacheTags` passes through to Inertia's cache. External links, downloads, alternate
targets and same-page fragments are never prefetched. Mount/click prefetch modes
and `usePrefetch` are not implemented yet.

## Forms

```imba
import { useForm } from '@inertiajs/imba'

export tag StudentForm
  form = useForm({ name: '', email: '' })

  def submit event
    event.preventDefault!
    form.post('/students')

  <form @submit=submit>
    <input bind=form.name>
    if form.errors.name
      <p> form.errors.name
    <button disabled=form.processing> "Save"
```

The helper commits Imba updates after Inertia callbacks, so validation errors and
processing state update without application-level `imba.commit()` calls.

- `isDirty` compares current fields (including nested objects and arrays) with
  defaults. It is read-only and updates when read during rendering.
- `defaults()` accepts current values as defaults; `defaults('name', value)` or
  `defaults({ name: value })` updates selected top-level defaults without dropping
  other fields. Successful submissions update defaults after awaiting `onSuccess`,
  unless that callback explicitly calls `defaults`. Calling `reset()` inside
  `onSuccess` still resets to the previous defaults.
- `resetAndClearErrors(...fields)` resets selected top-level fields and clears
  their errors; omit fields to reset everything.
- `cancel()` cancels the current visit using Inertia's cancellation token. The
  supplied `onCancelToken`, `onCancel`, and `onFinish` callbacks remain available.
- File values retain their identity and metadata through defaults and reset.
  Upload conversion remains handled by Inertia core; `forceFormData` and progress
  callbacks pass through. Selecting a different file marks the form dirty.

Nested field-path methods are still pending. Use separate form instances for
independently concurrent submissions.

## Remembered state

Give each form a stable, unique key to restore its data and validation errors
when returning through browser history:

```imba
form = useForm('Students/Create', { student: { name: '', email: '' } })
```

Nested object/array edits are observed and saves are batched within a microtask.
Restored drafts remain dirty relative to the initial defaults; processing and
success flags are not restored. `resetAndClearErrors!` clears the saved draft too.
This is per-history-entry state, not persistent storage or a global draft cache.

Use `.dontRemember('password')` to exclude top-level data fields and their error
keys. Blob/File values are saved as `null`; users must reselect uploads. Use
JSON-compatible data and replace Date/class instances rather than mutating them.

For other page-local state, import `useRemember`:

```imba
filters = useRemember({ query: '', expanded: [] }, 'Students/Filters')
```

Keep the returned object and edit its properties. These helpers are scoped to
the page instance; removed pages cannot write into a later page's history.
Use `router.remember`/`router.restore` explicitly for persistent-layout state.

## Head

```imba
import { Head } from '@inertiajs/imba'

<Head title="Students">
  <meta head-key="description" name="description" content="Manage students.">
```

Use native head elements as direct children. `head-key` deduplicates entries
across mounted Head components; titles are deduplicated automatically. Place a
default Head in the persistent layout and page-specific overrides in pages.
Unmounting a page removes its entries and restores layout defaults. Updates to
title and child markup are reflected automatically. The source tag is hidden.

`createInertiaApp({ title: (title, page) => ... })` can format titles globally.
Head currently supports client rendering only; SSR remains unsupported.

## Precognition

Opt into validation-only requests using the same endpoint as the real form:

The endpoint also becomes the default for `form.submit()` / `form.submit(options)`.
Explicit calls such as `form.patch('/students/1')` still override it. Alternatively,
`useForm('post', '/students', data)` configures the endpoint and enables
Precognition at construction. For remembered forms, keep
`useForm('Students/Create', data).withPrecognition('post', '/students')`.

```imba
form = useForm({ name: '', email: '' }).withPrecognition('post', '/students').withAllErrors!

def setup
  form.transform(do(data) { student: data })

def unmount
  form.cancel!

<input name="name" bind=form.name @blur=form.validate('name')>
if form.errors.name
  <p> form.errors.name[0]
```

In the existing Rails action, place `precognition!(student)` immediately after
constructing the model and before `student.save` or other side effects. Rails
runs validation and halts validation-only requests with a 204 or 422 response.
Normal submissions continue through the existing save/redirect flow. No separate
route is necessary. The Students fixture demonstrates this setup.

- `validate('name')` or `validate(event)` touches the field and validates touched
  fields after a 300ms debounce. `validate({ only: ['email'] })` limits the request.
  To check name alone, use `validate({ only: ['name'] })`, even if email was
  previously touched. The fixture now uses this explicit per-field form on blur.
  Rails still runs model validation but filters returned errors to requested fields;
  unrelated displayed errors remain unchanged.
  `setValidationTimeout(ms)` changes the debounce. `validate()` uses touched
  fields, or all top-level fields if none have been touched.
- `touch`, `touched`, `valid`, `invalid`, and `validating` expose field status.
  Validation does not set `processing`, `wasSuccessful`, or change defaults.
  Field names refer to form data; transforms may wrap the request body for Rails.
  Server error keys must match those field names (including dotted nested paths).
- Validation errors are strings by default; `withAllErrors()` retains arrays.
  Existing normal Inertia submissions retain their server error format. The
  fixture opts into arrays to match its Rails redirect errors.
- New validation, reset, cancel, and real submission invalidate pending results.
  Responses for data edited since the request are ignored. Call `form.cancel!`
  on unmount to abort transport and timers; page scopes also reject late results.
- `validationError` contains transport/protocol failures, separate from field
  errors. It clears on another validation or reset. A failed check does not block
  normal submission. `cancelValidation()` cancels validation alone.
- Validation uses Inertia's configured HTTP client, the same-origin Rails CSRF
  meta token, and Precognition headers without `X-Inertia`. Files are omitted by
  default; `validateFiles()` opts into multipart validation, and
  `withoutFileValidation()` turns it off again.
- Supported per-validation options: `only`, `headers`, `onBefore`, `onStart`,
  `onPrecognitionSuccess`, `onValidationError`, and `onFinish`. Superseded or
  cancelled requests do not run completion callbacks. Callback failures also
  appear in `validationError`.

`useHttp(...).withPrecognition(method, url)` uses the same validation API. This is
an initial subset: `validator()` access, wildcard field paths, and the full
upstream callback surface are not implemented. `useHttp` still requires explicit
`withPrecognition()` to enable validation when its endpoint is prebound.

## Plain HTTP requests

`useHttp` uses Inertia's configured HTTP client to request JSON without visiting
an Inertia page or changing the URL. Fields bind just like `useForm`:

```imba
import { useHttp } from '@inertiajs/imba'

export default tag GreetingPreview
  preview = useHttp({ name: '' })

  def submit
    try
      await preview.post('/http-preview')
    catch error
      console.error(error)

  def unmount
    preview.cancel!

  <self>
    <form @submit.prevent=submit>
      <input bind=preview.name>
      if preview.errors.name
        <p> preview.errors.name
      <button disabled=preview.processing> "Preview"
    if preview.response
      <p> preview.response.message
```

The fixture's About page has a working example. Endpoints should return JSON:
`{ message: "Hello!" }` on success, or `{ errors: { name: ["can't be blank"] } }`
with status 422 for validation. Existing Inertia redirect endpoints should keep
using `useForm`.

- `get`, `post`, `put`, `patch`, `delete`, and `submit(method, url, options)` return
  promises with parsed response data (`null` for an empty successful response).
  GET fields become query parameters; other methods send JSON or multipart data
  when files are present. `response` stores the successful result.
- `useHttp('post', '/http-preview', { name: '' })` also allows `submit()` with a
  prebound endpoint. URL/method pairs use the core argument parser as well.
- `processing`, `progress`, `errors`, `hasErrors`, `wasSuccessful`, and
  `recentlySuccessful` update Imba automatically. Validation uses the first error
  per field by default; `withAllErrors()` keeps arrays. A 422 resolves `undefined`.
- `data`, `transform`, `defaults`, `reset`, `setError`, `clearErrors`, and
  `resetAndClearErrors` use the same top-level field conventions as our form helper.
  Successful requests update defaults unless `onSuccess` explicitly sets them.
- Options include `headers`, `onBefore`, `onStart`, `onProgress`, `onSuccess`,
  `onError`, `onHttpException`, `onNetworkError`, `onCancel`, `onCancelToken`, and
  `onFinish`. Success receives `(data, rawResponse)`; validation receives errors.
  Non-validation failures and cancellations reject: await/catch the promise.
- `cancel()` aborts the active request. One request per instance may be pending;
  use separate instances for independent requests, or cancel and await before
  reusing one. Call `cancel()` on component unmount if appropriate.
- Rails' CSRF meta token is included automatically for same-origin requests only.
  No `X-Inertia` header is added. CSRF protection remains enabled on the server.

The shared form helper also provides `isDirty` and the defaults overloads above.
`useHttp('Search', { query: '' })` remembers data/errors like keyed `useForm`.
This is an initial implementation, not full adapter parity: optimistic updates
and nested field-path reset/default helpers are not implemented. Prebinding an
endpoint does not enable Precognition; use `withPrecognition()` explicitly.

## Persistent layouts

Configure a default layout in `createInertiaApp`:

```imba
import AuthenticatedLayout from './layouts/AuthenticatedLayout.imba'

createInertiaApp({
  layout: do(name, page)
    AuthenticatedLayout
  resolve: do(name)
    let pages = import.meta.glob('./pages/**/*.imba', { eager: true })
    pages["./pages/{name}.imba"]
})
```

A layout is an ordinary tag with a reserved `pageContent` prop:

```imba
export default tag AuthenticatedLayout
  prop pageContent
  sidebarOpen = true

  <self>
    <header> "My app"
    <main>
      <{pageContent}>
```

Pages use their normal `<self>` render, without inheriting the layout. The same
layout instance stays mounted across visits even when page state resets. It
receives current page props as named properties; omitted props are cleared.
`pageContent` always contains the page node and cannot be overridden by server props.
Avoid page prop names that collide with DOM properties or layout-local state.

The callback receives `(name, page)` and may return a layout tag, `null`, or
`false`. A page module can override the default with `export const layout =
OtherLayout`, or opt out with `export const layout = null`. A tag class's static
`layout` property is also supported. An undefined declaration uses the default.
Changing layouts or opting out unmounts the previous layout; returning later
creates a fresh instance. Full browser reloads reset layout state too.

This first version supports a single layout. Nested layouts and Inertia's advanced
layout-prop APIs are not implemented yet.

## Current scope

- Client-side page mounting and Inertia navigation
- Vite `import.meta.glob` page resolution
- Named page props assigned before Imba's setup/render lifecycle
- A first `useForm` implementation

SSR, nested layouts, full Precognition parity, and end-to-end upload tests
are intentionally left for the next iteration.

## Rails integration fixture

`integration/rails_app` contains a small Rails 8.1 application with Students
index/create actions, model validation, two Imba pages, named and removable
props, and a persistent authenticated shell. Its frontend can be built from
the repository root:

```sh
npm run test:integration
```

See `integration/rails_app/README.md` for the Rails setup and test commands.

## Rails flash messages

The Rails fixture shares `flash` using `inertia_share flash: -> { flash.to_hash }`.
Both pages and persistent layouts receive it as a named prop:

```imba
prop flash = {}

<self>
    if flash and flash.notice
        <p role="status"> flash.notice
    if flash and flash.alert
        <p role="alert"> flash.alert
```

The sample layout renders these messages centrally. A page can declare the same
prop if it needs message-specific behavior. JavaScript helpers can read
`getPage()?.props.flash`; use `onPageChange` to subscribe to later page updates
(and unsubscribe when finished). Rails clears the flash on the following request,
and the next full Inertia response replaces it with `{}`. This is ordinary shared
page data, not Inertia's separate top-level flash API. Partial reloads only refresh
requested props, so include `flash` when using `only` if it needs refreshing.
