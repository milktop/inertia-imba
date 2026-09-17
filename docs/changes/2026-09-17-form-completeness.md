# Form helper completeness

The initial helper lacked dirty tracking, cancellation, and selective defaults.
Partial defaults also replaced the entire field set, and structured cloning could
lose File metadata in some runtimes.

Added a computed `isDirty`, token-based `cancel`, `resetAndClearErrors`, and
merging top-level defaults overloads. Successful visits accept the current values
after awaiting the success callback unless it explicitly changes defaults.
Reset inside that callback retains its existing clear-after-create behavior.

Use es-toolkit (now a direct dependency, already used by Inertia core) for deep
comparison and cloning. Immutable Blob/File values retain identity, so replacing
a file is dirty even when its name and size match. `useHttp` inherits the shared
field behavior while retaining its own transport and cancellation implementation.

Validation: `npm test` covers nested edits, selective resets/errors/defaults,
async success callbacks, cancellation lifecycle, and file/progress forwarding.
`npm run test:integration` checks the Rails fixture production frontend build.
Upload coverage is at the adapter boundary, not a browser-to-Rails upload test.

Next: remembered state, Head, and Link prefetching. Add browser regression
coverage for bound dirty indicators, history restoration, and multipart uploads.
Nested field-path methods and overlapping visits on one form remain out of scope.
