# Native action buttons with confirmation

Added LinkButton for POST/PUT/PATCH/DELETE requests, with payloads, native optional
window.confirm, temporary disabled state, data-loading, and cancellation. The
existing GET Link remains a native anchor. Imba chooses the native element before
assigning props; a separate export keeps [] styles and classes on the clickable
button without a wrapper or unsupported DOM replacement.

Explicit disabled intent is stored separately from processing so completion does
not accidentally enable a caller-disabled button. The synchronous request guard
blocks duplicate dispatch even before rendering. Global Inertia before-event
vetoes and synchronous errors release the guard. Unmount cancels pending work.
Actions are same-origin and never prefetched; preserveState defaults to true.

A session-only Rails fixture under /action_examples exercises verbs and payloads
without changing student records. Unit/browser coverage includes confirmation
cancellation, accepted DELETE, payloads, inline/class styling, keyboard activation,
accidental surrounding form submission, duplicate clicks, explicit disabled state,
validation, global vetoes, cancellation, and retry. Declarations and docs cover the
separate LinkButton API. Existing user edits to fixture pages/styles are preserved.
