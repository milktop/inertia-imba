# First persistent layout support

The inherited fixture shell was recreated with each page. The adapter now accepts
`createInertiaApp({ layout: (name, page) => Layout })` and manages a separate
layout instance. Page module `layout` declarations (or static tag properties)
override the default; null/false opt out. Only the same active layout class is
reused. Page preserveState continues to control page reuse independently.

Layouts receive updated named page props, clear omitted props, and render the
reserved `pageContent` node. Do not use `children` as an Imba prop: tags inherit
the DOM Element's read-only children getter. The fixture uses AuthenticatedLayout
and normal page `<self>` rendering, with a counter demonstrating persistence.

Verification:
- npm test: nine tests passed, including layout resolution, state preservation,
  prop refresh/removal, content ownership, layout changes and opt-out.
- npm run test:integration: production frontend build passed.
- Browser against Rails on 3100 and the existing Vite server: layout counter
  survived Students → About → Students and Back navigation; page draft reset
  across page switches, remained during filtering, and server validation errors
  still rendered with the submit button enabled. No valid records were created.

Limits and follow-up:
- Single layouts only; nested layouts and advanced layout-prop APIs remain out
  of scope. Invalid layout arrays report a clear error.
- Layout state resets when leaving that layout or reloading the document.
- Browser checks are manual; add automated browser coverage for mount/unmount
  identity, opt-out, and layout switching in a future browser-test harness.
- Build success is not a deployed-production browser test.
