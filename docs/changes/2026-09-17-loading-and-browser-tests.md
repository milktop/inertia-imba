# Loading helpers and browser coverage

The adapter lacked UI helpers for deferred and optional props, polling cleanup,
and automated verification of its browser lifecycle.

Added Deferred (fallback/rescue slots and lazy content callback), WhenVisible
(partial reload, visibility buffer, repeat opt-in, retry and cancellation), and
usePoll (core polling controls with page replacement cleanup). Rails /loading
provides a small working example. Lazy callbacks avoid Imba evaluating missing
props before Deferred can show its fallback.

Playwright covers persistent layouts, Head cleanup, remembered drafts/errors,
reset, field-only Precognition, bound submission, prefetch reuse, deferred and
visible requests, and polling cleanup. It uses a separate test database. CI runs
these alongside unit tests, Rails tests and frontend compilation.

The browser suite also exposed Imba's bare prefetch attribute being passed as the
string "prefetch". Link now accepts that shorthand as well as true and "hover".

Follow-up: nested layouts, SSR, upload browser coverage, and additional parity
such as deferred reloading indicators remain separate work. Dynamic visibility
configuration is best handled by remounting the WhenVisible component.
