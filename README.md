# Inertia.js Imba adapter (prototype)

An experimental client-side adapter for Inertia 3 and Imba 2. This is an
unofficial community package, not maintained by the Inertia.js team.

## Install

Install from a GitHub tag (the package is not published to npm):

```sh
npm install imba @inertiajs/core github:milktop/inertia-imba#v0.1.0
```

This adds `"@milktop/inertia-imba": "github:milktop/inertia-imba#v0.1.0"` to
`package.json`. For local development against a checkout, use
`"file:/path/to/inertia-imba"` instead.

## Editor hints and API reference

The package includes TypeScript declarations for its helpers and public entrypoints.
See [the API guide](docs/api.md) for typed examples, JavaScript/JSDoc usage, and a
supported-feature table. Method names stay consistent with other Inertia adapters.
Run `npm run test:types` to check the declarations and usage examples.

## New Rails app

Generate a Rails app with Inertia, Vite and Imba already configured:

```sh
rails new myapp --skip-javascript \
  -m https://raw.githubusercontent.com/milktop/inertia-imba/main/rails/template.rb
cd myapp && bin/dev
```

The [template](rails/template.rb) adds `inertia_rails` and `vite_rails`, installs
the adapter from a GitHub tag, and sets up:

- a persistent layout with flash messages, `aria-current` nav links, and Home/About pages
- dark mode: a System/Light/Dark toggle (`app/frontend/theme.imba`) and theme-aware
  colour variables in `app/frontend/styles.imba`, applied before first paint
- an `@` import alias for `app/frontend` (with `jsconfig.json` for editors)
- eager loading of global tags from `app/frontend/components/`
- `bin/dev` running Rails and Vite, and `bin/setup` installing npm packages
- `.node-version`, history encryption, and Inertia controller tests
- named routes exported from `config/routes.rb`, and the opt-in global tags
- optionally, Rails 8 authentication with Imba login and password-reset pages
  (the template asks; set `INERTIA_IMBA_AUTH=1` or `0` to skip the prompt)

Set `INERTIA_IMBA_REF=v0.1.5` to choose another tag, `INERTIA_IMBA_PATH=/path/to/repo`
to link a local checkout, or `INERTIA_IMBA_SOURCE` for any npm source. Without
`--skip-javascript` it removes importmap, Turbo and Stimulus.

## Rails setup

For an existing app, set up the pieces below by hand.

Keep using `inertia_rails` on the server. Add the bundled Imba compiler plugin
to `vite.config.js`. It compiles your pages and the adapter's own `.imba` source
(the published `vite-plugin-imba` does not support current Imba alphas), and
configures Vite's dependency optimizer and a single shared Imba runtime:

```js
import { defineConfig } from 'vite'
import RubyPlugin from 'vite-plugin-ruby'
import imba from '@milktop/inertia-imba/vite'

export default defineConfig({
  plugins: [RubyPlugin(), imba()],
})
```

Put Imba pages in
`app/frontend/pages`. Use a JavaScript entrypoint so Vite Ruby discovers a
script rather than emitting the Imba source as a static asset:

```js
// app/frontend/entrypoints/inertia.js
import '../inertia.imba'
```

Then create `app/frontend/inertia.imba`:

```imba
import { createInertiaApp } from '@milktop/inertia-imba'

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
import { Link } from '@milktop/inertia-imba'

<Link href="/students"> "Students"
<Link href="/students?diagnostics=1" preserveState=true preserveScroll=true> "Details"
<Link href="/about" target="_blank"> "Open About in a new tab"
```

A Link whose path matches the current page (ignoring query, hash and trailing
slash) gets `aria-current="page"`. Style it with `[aria-current=page]`; matching
is exact, so `/students/1` does not mark `/students`.

For navigation that should stay highlighted on sub-pages, use `isCurrent`:

```imba
import { isCurrent } from '@milktop/inertia-imba'

<a.nav-item .active=isCurrent('/students')>  # also on /students/1
<a.nav-item .active=isCurrent('/')>          # / only matches itself
```

`isCurrent(href, { exact: true })` matches the page itself only, like Link.
`currentPath()` returns the current path without query, hash or trailing slash.

Normal left clicks and Enter activation perform Inertia GET visits. Modifier
keys, other mouse buttons, downloads, external URLs, other browsing targets,
and same-page fragments retain browser behaviour. Labels and nested markup use
Imba's normal child content, rendered through the tag's slot.

Supported visit props: `replace`, `preserveState`, `preserveScroll`, `only`,
`except`, and `headers`. Native anchor attributes such as `title`, `target`,
`download`, and accessibility attributes remain available. Query data belongs
in `href`, so opening a new tab follows the same URL.

Use `Link` for GET navigation and [LinkButton](#action-buttons) for
POST/PUT/PATCH/DELETE actions with automatic disabling and optional confirmation.
Use `useForm` when you also need editable fields and form errors. `Link` does not
provide an `as` prop or visit callbacks.

Enable prefetching explicitly with `<Link href="/students" prefetch=true>`.
`prefetch="hover"` is equivalent. Hover or keyboard focus starts a request after
75ms; leaving, blurring, clicking, or unmounting cancels the pending timer.
`cacheFor` defaults to 30000ms and accepts core cache durations (e.g. `'1m'`);
`cacheTags` passes through to Inertia's cache. External links, downloads, alternate
targets and same-page fragments are never prefetched. Mount/click prefetch modes
and `usePrefetch` are not implemented yet.

## Named routes

Refer to server routes by `controller.action` name instead of hard-coding URLs.
Pass a route table to `createInertiaApp`, keyed by name, with each route's
method and path pattern:

```imba
import routes from '@/routes.json'
# { "tasks.show": { "method": "get", "path": "/tasks/:id" }, ... }

createInertiaApp({ routes, resolve: ... })
```

The [Rails template](rails/template.rb) generates this file from `config/routes.rb`
(`config/initializers/inertia_routes.rb`), rewrites it whenever routes change in
development and before the Vite production build, and tests that the committed
copy is current. Run `bin/rails inertia:routes` to regenerate it by hand.

```imba
<Link route="tasks.show" params={id: task.id}> task.title
<Link route="tasks.show" params=task.id> "Same, for a route's only param"
<LinkButton route="tasks.destroy" params=task.id confirm="Delete task?"> "Delete"

def save
	form.submit('tasks.update', task.id, { preserveScroll: true })

router.visit(route('tasks.index', { page: 2 }))   # /tasks?page=2
```

- `route(name, params)` returns Inertia's `{ url, method }` pair, so `router.visit`,
  `form.submit` and `useHttp` use the route's method. It converts to its URL
  wherever a string is expected (`href=route(...)`, `window.open`).
- `LinkButton` takes its method from the route unless `method` is given. `Link`
  is GET-only and throws for other routes.
- `form.submit('tasks.update', params, options)` works for `useForm`, precognitive
  forms and `useHttp`. Names contain a dot, so they never clash with methods.
- Params missing from the path become the query string. Optional segments such as
  `(/:page)` are included when their params are given. Unknown names and missing
  params throw with the route's pattern.

The route table lists every exported path and ships to the browser. Paths are not
secrets and the server still authorizes requests, but exclude controllers you'd
rather not advertise.

## Global tags

Import the opt-in globals once, typically in `inertia.imba`:

```imba
import '@milktop/inertia-imba/globals'
```

This registers `<inertia-link>`, `<inertia-button>` and `<inertia-head>`, which
behave exactly like `Link`, `LinkButton` and `Head`, and adds `route(name, params)`
to every tag. Pages then need no imports for navigation:

```imba
<inertia-head title="Tasks">
<inertia-link route="tasks.show" params=task.id> task.title
<button @click=router.visit(route('tasks.index'))> "Back"
```

Without the import, nothing global is defined.

## Forms

```imba
import { useForm } from '@milktop/inertia-imba'

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
  `defaults({ name: value })` updates selected defaults without dropping
  other fields. Successful submissions update defaults after awaiting `onSuccess`,
  unless that callback explicitly calls `defaults`. Calling `reset()` inside
  `onSuccess` still resets to the previous defaults.
- `resetAndClearErrors(...fields)` resets selected fields and clears
  their errors; omit fields to reset everything.
- `cancel()` cancels the current visit using Inertia's cancellation token. The
  supplied `onCancelToken`, `onCancel`, and `onFinish` callbacks remain available.
- File values retain their identity and metadata through defaults and reset.
  Upload conversion remains handled by Inertia core; `forceFormData` and progress
  callbacks pass through. Selecting a different file marks the form dirty.

`reset`, `resetAndClearErrors` and `defaults` accept dotted paths, including array
indices: `form.reset('student.name', 'lessons.0.title')` and
`form.defaults('student.email', 'ada@example.test')`. A defaults map can also use
paths: `form.defaults({ 'student.name': 'Ada' })`. Sibling values are preserved;
resetting an unknown path is a no-op. Existing literal dotted data keys take
precedence. Error clearing targets the exact specified keys. `dontRemember`
continues to accept top-level fields only.

Try About → Nested form helpers in the fixture. Use separate form instances for
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
import { Head } from '@milktop/inertia-imba'

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

## SSR: investigated and parked

SSR is a possible future feature, but is **not currently supported or enabled**.
The [runnable SSR experiments](experiments/ssr/README.md) demonstrate initial
HTML, CSS and a prefilled input without JavaScript, followed by working Inertia
navigation and nested persistent layouts in Chrome.

The working prototype requires experimental Imba runtime fixes for escaping,
input bindings and component lifecycle handling. It replaces the initial page
tree when JavaScript starts rather than preserving it through hydration; input
typed before startup is lost. Server-side Head collection, request isolation,
Rails integration and broader browser/control testing remain unfinished.

The decision is to park this work until there is a concrete need, most likely
public, content-heavy pages where crawlers and initial content delivery matter.
That use case may make a limited SSR version with a client remount worthwhile;
full DOM-preserving hydration remains a separate, larger task. See the
[feasibility notes](docs/changes/2026-09-17-ssr-feasibility.md) for the investigation
history and the experiment README for commands, findings and caveats.

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
import { useHttp } from '@milktop/inertia-imba'

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
Prebinding an endpoint does not enable Precognition; use `withPrecognition()` explicitly.

## Optimistic updates

Show an expected result immediately while the request runs. For Inertia visits,
`useForm.optimistic(callback)` updates **page props**, with reconciliation and
rollback handled by Inertia core:

```js
form.optimistic(props => ({ count: props.count + 1 })).post('/increment')
```

`LinkButton` accepts the same callback as an `optimistic` prop. For example,
the Students fixture returns a new `students` array with the selected student's
`active` flag flipped:

```imba
<LinkButton href="/students/{student.id}/toggle_active" method="patch" optimistic=optimisticToggle(student.id)>
    student.active ? 'Deactivate' : 'Activate'
```

Return partial updates from the callback; do not mutate its argument. The server
remains authoritative. Failed validation or cancellation restores the previous
page props, and the button remains disabled while the request is pending.

For `useHttp`, the callback updates **form data**, including the submitted payload:

```js
await preview.optimistic(data => ({ name: data.name.trim() })).post('/http-preview')
```

Both helpers also accept `{ optimistic: callback }` in submission options.
The chained callback applies to the next submission only; an inline option takes
precedence. HTTP rollback restores only the top-level fields changed by the
callback, before error/cancellation callbacks run, preserving edits to unrelated
fields. Editing a changed field during the request can be overwritten by rollback.
Successful JSON remains in `response`; it does not automatically replace form data.
An exception in `onSuccess` does not undo an accepted response.

Try the Students toggle, or About → Optimistic HTTP updates for success and
validation-failure examples. These updates improve perceived responsiveness;
server validation and permissions still apply.

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
`pageContent` contains the next layout or page node and cannot be overridden by server props.
Avoid page prop names that collide with DOM properties or layout-local state.

The callback receives `(name, page)` and may return a layout tag, an array of tags,
`null`, or `false`. A page module can override the default with `export const layout =
OtherLayout`, or opt out with `export const layout = null`. A tag class's static
`layout` property is also supported. An undefined declaration uses the default.
Changing layouts or opting out unmounts the previous layout; returning later
creates a fresh instance. Full browser reloads reset layout state too.

### Nested persistent layouts

For nested layouts, export a flat array **outermost first**:

```imba
import AppLayout from '../../layouts/app.imba'
import StudentsLayout from '../../layouts/students.imba'

export const layout = [AppLayout, StudentsLayout]

export default tag StudentsIndex
    <self>
        <h1> "Students"
```

Every layout declares `prop pageContent` and renders `<{pageContent}>`; the outer
layout receives the next layout, and the innermost receives the page. All levels
receive current page props, with omitted props cleared. The application `layout`
callback and a tag's static `layout` property also accept arrays.

Only the shared outer sequence is preserved: `[App, Students]` → `[App, Reports]`
keeps App and replaces the section. Changing App recreates every inner layout.
Leaving a section removes it; returning creates a fresh instance. Preservation
is independent of the page's `preserveState` setting. Page declarations replace
the application default rather than automatically appending to it, so include
the app shell in the array when needed.

A single tag still works. `null`, `false`, or `[]` opts out of all layouts. Arrays
must contain tag classes, not nested arrays or empty entries. Inertia's advanced
layout-prop APIs remain unsupported.

Try Students → Student reports in the Rails fixture. The section note and
navigation toggle survive those visits. Visit About and return to Students:
the section resets, while the outer layout's click counter stays unchanged.

## Current scope

- Client-side page mounting and Inertia navigation
- Vite `import.meta.glob` page resolution
- Named page props assigned before Imba's setup/render lifecycle
- Forms, remembered drafts, Precognition, and multipart uploads
- Head management, link prefetching, deferred/visible data, and polling
- [Single and nested persistent layouts](#persistent-layouts)
- TypeScript declarations and browser regression coverage

SSR and full Precognition parity remain future work.
Multipart uploads now have browser and Rails regression coverage.

## Rails integration fixture

`integration/rails_app` contains a small Rails 8.1 application with Students
index/create and reports actions, model validation, upload and loading examples,
named and removable props, and nested persistent layouts. Its frontend can be built from
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

## Deferred data, visibility loading, and polling

`Deferred` displays its fallback until every named prop is available. Inertia core
fetches Rails `InertiaRails.defer` props automatically. Use a `content` callback
when accessing missing data: Imba evaluates ordinary child expressions eagerly.
The callback receives the current page props only after the data arrives.

```imba
import { Deferred, WhenVisible, usePoll } from '@milktop/inertia-imba'

export default tag Dashboard
    def summaryContent props
        <p> "Students: {props.summary.total}"

    <self>
        <Deferred data="summary" content=summaryContent>
            <p slot="fallback"> "Loading summary…"
            <p slot="rescue"> "Summary could not be loaded."

        <WhenVisible data="details" buffer=100>
            <p slot="fallback"> "Waiting until visible…"
            <p> "Details are ready."
```

Both accept a prop name or an array of names. `WhenVisible` requests those props
when its wrapper approaches the viewport (`buffer` is pixels). Pair it with
Rails `InertiaRails.optional` to skip the initial payload. It loads once by
default; `always=true` permits another load on subsequent visibility entries.
Use `params` for reload options, or `content` for lazy rendering as above.
`data` overrides `params.only`. Its `retry()` method retries an unsuccessful load.

Start polling in a component's mount hook and destroy it on unmount:

```imba
    def mount
        poll = usePoll(2000, { only: ['checked_at'] })

    def unmount
        poll.destroy! if poll
```

The returned handle also exposes `start()` and `stop()`. The third argument
accepts core polling options such as `{ autoStart: false, keepAlive: true }`.
Polling is automatically destroyed when the page is replaced and is throttled
in background tabs by Inertia core. Explicit cleanup also covers components
removed while their page remains mounted.

Visit `/loading` in the Rails fixture (linked from About) to try all three.

## Browser regression tests

After installing both projects' dependencies and preparing Rails, run:

```sh
npx playwright install chromium
npm run test:browser
```

The suite builds and starts its own Rails server on port 3111 with a separate
`storage/browser-test.sqlite3` database. Set `E2E_PORT` to change the port.
On Macs unsupported by bundled Chromium, use installed Google Chrome:
`PLAYWRIGHT_CHANNEL=chrome npm run test:browser`.
GitHub Actions runs the browser suite in Chromium, Firefox and WebKit on Linux,
plus unit tests, Rails tests and frontend/type checks. Select an engine locally
with `PLAYWRIGHT_BROWSER=firefox npm run test:browser` (or `webkit`) after
installing it with `npx playwright install firefox webkit`. Current Playwright
builds require a supported OS; installed Chrome can be used on this older Mac.
The two precisely throttled upload-progress/cancellation tests require Chromium
CDP; ordinary multipart validation/retry/reset tests run in every engine. Failed
browser runs upload separate screenshots and traces for each engine.

## File uploads

`useForm` passes files to Inertia core, which automatically uses multipart
`FormData` when a field contains a `File`, including nested fields. Assign the
selected file from the input's change event; do not bind its string `value`:

```imba
    form = useForm({ title: '', file: null })

    def chooseFile event
        form.file = event.target.files[0] or null

    def submit
        form.post('/uploads')

    <self>
        <form @submit.prevent=submit>
            <input type="file" @change=chooseFile>
            if form.progress
                <progress max=100 value=form.progress.percentage>
            <button type="submit" disabled=form.processing> "Upload"
            if form.processing
                <button type="button" @click=form.cancel!> "Cancel"
```

`form.progress` is cleared when a request finishes or is cancelled. Cancellation
keeps the selected file available for retry; it cannot undo work already accepted
by a server. Resetting form data does not clear a native file picker: set that
input's `value` to `''` when resetting or after success (see the fixture).

The Rails fixture's `/uploads` page accepts a text file up to 2 MB, validates the
title and file, and displays received metadata. It discards the temporary upload
without storing or serving it. Browser tests use Chromium network throttling to
exercise actual progress and cancellation, plus multipart submission, validation,
retry, and native input reset. Rails tests also cover the size limit.

## Action buttons

Use `LinkButton` for POST, PUT, PATCH, or DELETE actions without a full form:

```imba
import { LinkButton } from '@milktop/inertia-imba'

<LinkButton.action-button href="/students/123" method="delete" confirm="Delete this student?" [c:gray4]>
    "Delete student"
```

`LinkButton` is a native `<button type="button">` with no wrapper. Both Imba `[]`
styles and classes apply to that button. Keep using `Link` for GET navigation:
Imba fixes each tag's native element before receiving props, so separate exports
preserve correct native behavior and direct styling.

- `method` defaults to `post`; `put`, `patch`, and `delete` are also supported.
- `data` supplies the request payload, for example `data={ archived: true }`.
- An optional `confirm` string calls `window.confirm` before submission. Cancel
  sends nothing and leaves the button enabled unless explicitly disabled.
- While processing, the button disables itself and carries `data-loading`.
  Completion, validation failure, or cancellation clears that temporary state.
  An explicit `disabled=true` remains effective until you change it.
- The instance exposes bindable `processing` and `cancel()`. Removal cancels
  its pending request. Cancellation cannot undo work already accepted by Rails.
- `replace`, `preserveState`, `preserveScroll`, `only`, `except`, and `headers`
  are supported. `preserveState` defaults to true for actions.
- Actions use same-origin HTTP(S) destinations and are never prefetched.

For loading styles, target `.action-button[data-loading]`. `css >>> link` does
not refer to either exported component: the actual elements are `a` and `button`.
Use explicit classes when you want the same styles on both.

Use `useForm` when you need editable fields, form errors, or submission callbacks.
Visit About → Action buttons in the Rails fixture for session-only examples that
do not change student records.

For a model toggle, the Students fixture uses a standalone action button:

```imba
<LinkButton href="/students/{student.id}/toggle_active" method="patch" preserveScroll=true>
    student.active ? 'Deactivate' : 'Activate'
```

Rails handles the toggle and redirects back; updated page props change the label.
`LinkButton` sets `type="button"` internally and does not require a form. The
fixture tests both directions, persistence after refresh, and keeping a draft and
filter while the request runs.


### Binding processing and handling validation errors

Imba supports named bindings. Use `bind:processing`, not bare `bind` (which binds
`data`, the request payload):

```imba
import { LinkButton } from '@milktop/inertia-imba'

export default tag ExamplePage
    updating = false
    message = ''

    def showError event
        message = event.detail.errors.name

    <self>
        <LinkButton href="/example" bind:processing=updating @error=showError>
            updating ? 'Saving…' : 'Save'
        if message
            <p> message
```

`processing` is an output for parent UI. It becomes false after completion,
validation failure, cancellation, or removal. Although Imba bindings are two-way,
writing that variable does not start/cancel a request or bypass the internal
loading and duplicate-click guards. Use a separate variable for each button.

`@error` receives a bubbling CustomEvent whose `detail.errors` contains Inertia
validation errors. Values may be strings or arrays, depending on the server.
It does not retain an errors object on the button or change normal page errors.
Network failures and server exceptions keep Inertia's default handling; they are
not emitted as validation errors. Use `useForm` for full form/error state.

Try the Bound processing and errors section on About → Action buttons. CSS-only
loading styling can continue to use `[data-loading]` without a binding.
