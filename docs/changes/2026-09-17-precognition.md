# Precognition validation

## Problem and change

Forms previously needed a full submission to show Rails validation errors.
Added opt-in `withPrecognition(method, url)` to useForm/useHttp, with debounced
validation, touched/valid/invalid state, cancellation, and stale-response guards.
Requests use the configured Inertia HTTP client and the existing same-origin
Rails CSRF helper (moved into requestHeaders.js without changing its behavior).
No dependency was added. This is a focused adapter implementation of the
Precognition protocol, not the full laravel-precognition validator API.

The existing Students create action now calls `precognition!(student)` before
saving. Normal submissions retain their save/redirect behavior. Validation-only
requests never reach the save. There are no new routes.

The demo form now uses flat name/email fields and transforms them into the
Rails student parameter envelope. This keeps validation field names consistent
with Rails errors and adds blur validation. Existing remembered drafts using the
old nested student shape are not migrated. Name length >= 4 was already a model
rule; its existing redirect test expectation was updated to reflect it.

## Behavior and tradeoffs

- Validation is opt-in and separate from submission state. Default debounce is
  300ms, configured through setValidationTimeout. Touched fields are combined so
  moving quickly between inputs does not discard the first field's validation.
- Late responses cannot replace errors after newer validation, reset, submit,
  page removal, or data edits. cancel() also cancels validation; call on unmount.
- Validation errors default to strings; withAllErrors preserves arrays. The
  fixture uses arrays to match its existing Rails submission errors.
- Transport/protocol/callback failures appear as validationError and do not block
  submission. Superseded/cancelled requests do not invoke completion callbacks.
- Files are omitted unless validateFiles is enabled. Multipart conversion and
  transport come from Inertia core. Server errors must match form field paths.

## Verification and follow-up

Focused JS regressions cover debounce/coalescing, transformed payloads, 422 and
204 handling, corrections, stale requests/edits, cancellation/reset/submission,
page removal, useHttp, protocol failures, file opt-in, and callback execution.
Rails controller tests cover valid/invalid validation-only requests without
record creation, field filtering, and existing normal submission behavior.

Browser verification on localhost:3000: short-name error on blur, duplicate email
error on blur, correction clearing errors, successful 204 validation without
creating a student, reset clearing the draft, and no console errors. No record
was created during these browser checks.

Deferred: constructor-based auto-enabling, validator() access, wildcard paths,
full upstream callback parity, and browser-to-Rails upload coverage.
