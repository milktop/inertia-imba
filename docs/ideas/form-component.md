# Idea: a `Form` component

Status: not planned. `useForm` with `bind` covers current needs. Revisit if apps
accumulate throwaway `useForm` instances for trivial forms (search, filters,
single-field actions).

## What it would be

An equivalent of the `<Form>` component in the React/Vue/Svelte adapters: a tag
extending a native `<form>` that reads named inputs from the DOM on submit and
visits with Inertia's router. No field data is held in JavaScript.

## Exposing state without render props

Imba has no scoped slots, but a named reference does the same job. Slot content
is rendered by the enclosing page, so it can read the form tag's state directly:

```imba
<Form$f action="/students" method="post" resetOnSuccess>
	<input name="name">
	if $f.errors.name
		<p> $f.errors.name
	<button disabled=$f.processing> "Save"
```

Verified on 2026-09-30 with a stub form tag under the Vite dev server: `processing`
disabled the button during submission, and `errors` displayed after a
failure. The same pattern suits any stateful component (modal `open`, tabs
`current`, upload `progress`).

## Sketch (about 60 lines)

- `tag Form < form` with props `action`, `method`, `resetOnSuccess`, `options`
  (visit options such as `preserveScroll`, `only`, `headers`).
- On submit: `new FormData(self)`, then `router.visit(action, { method, data })`.
  Use the same state handling as `useForm` for `errors`, `hasErrors`,
  `processing`, `progress`, `wasSuccessful` and `recentlySuccessful`, and call
  `commit()` after each change.
- On success with `resetOnSuccess`: call `self.reset()`, the native form reset.
- Expose `submit()`, `reset()` and `clearErrors()` for use via `$f`.

## Trade-offs versus `useForm`

- No `isDirty`, remembered state or Precognition: these need field data in JS.
- Values are strings. Nested data relies on Rails-style names such as
  `student[name]`. Numbers and booleans need server-side casting.
- Progressive enhancement only helps with SSR, which this adapter doesn't support.

## Rules for the `$ref` pattern

- Change state in handlers or async callbacks, then `commit()`; never during
  render, or the page reads a value one render behind.
- Avoid a `$ref` on a tag inside `if` or `for`; it can be undefined, stale, or
  point at only one loop instance.
- Keep getters read during render cheap.
- Document which fields are public (`errors`, `processing`, ...).
