# Imported Inertia Link

Manual click.prevent handlers intercepted modifier clicks. Add a capitalized
`Link` export extending Imba's native anchor tag. It preserves standard anchor
attributes and renders child content through a slot. No global lowercase tag
registration is required by applications.

Use Inertia core's shouldIntercept with the actual anchor as currentTarget,
because Imba delegates events. Downloads, external/non-HTTP URLs, same-page
fragments, and base/anchor targets remain native. Normal activation sends a GET
visit with replace, preserveState, preserveScroll, only, except, and headers.
The fixture now uses Link in its layout navigation and diagnostics links.

Verification:
- npm test: 12 tests passed, including visit options, modified/prevented/editable
  clicks, alternate buttons, targets, downloads, fragments, and external URLs.
- npm run test:integration: production build passed, compiling the Imba tag.
- Browser with local Rails and Vite: label/anchor rendering, ordinary navigation,
  Enter activation, persistent layout counter, preserveState draft retention,
  and Command-click opening About in a new tab while preserving the original
  Students page all passed. No database writes were needed.

Scope: GET links only. Keep non-GET actions in useForm/router for now. Follow-up
work can add button rendering, visit lifecycle callbacks, and prefetch support.
