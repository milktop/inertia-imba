# Optimistic updates

Actions previously waited for responses before displaying their expected result.
useForm now forwards one-shot optimistic callbacks to Inertia core, and LinkButton
accepts its optimistic visit option. Core owns page-prop reconciliation and
rollback, avoiding a second adapter-specific page state mechanism.

useHttp applies partial updates to declared form data before transformation and
submission, matching the upstream API. It snapshots only changed top-level
fields, preserving unrelated edits on rollback. Files retain identity. Validation,
transport errors, cancellation and pre-success exceptions restore the snapshot
before callbacks. Exceptions after a confirmed success do not undo accepted state.
Nested fields within a changed top-level object are restored together.

The Students toggle demonstrates page-prop updates; About demonstrates HTTP
success and Rails validation rollback. Unit tests cover one-shot options,
payload timing, failures, cancellation, callback exceptions and protected helper
keys. Browser coverage holds requests to verify immediate rendering and rollback.
Future work should follow upstream core concurrency behavior rather than adding
an independent page rollback queue.
