# Flash messages in layouts and pages

Rails already shared its flash hash as `props.flash`, but the fixture did not
render it. The persistent layout now declares `prop flash = {}` and renders
notice/status and alert messages. Pages can declare the same prop; helpers can
read `getPage().props.flash` or subscribe with `onPageChange`.

Regression coverage verifies a successful POST exposes its notice in the Inertia
redirect response and in initial HTML after a normal redirect. The next request
returns an empty flash hash. Adapter coverage checks notice, alert, and clearing
on the same page and persistent layout instances, plus page-reader subscribers.

Validation: 20 JavaScript tests passed; Rails on Ruby 3.4.1 ran 12 tests / 60 assertions
successfully; the integration Vite production build passed. Browser rendering
was not checked in this change.

Follow-up check: create a student and confirm “Student created” appears above the
page, then navigate to About and confirm it disappears. For partial reloads,
include `flash` in `only` when the message must refresh. Shared flash is ordinary
page data; it does not implement Inertia's separate top-level flash/history API.

## Render guard correction

The first implementation used `flash?.notice` in Imba. In the pinned compiler,
that becomes `this.flashΦ.notice` and throws during rendering. Both guards now
use `flash and flash.notice` / `flash and flash.alert`; the README example is
corrected too. A regression test compiles the actual layout and evaluates its
message conditions with missing, null, empty, and populated flash values.
Validation after correction: all 23 JavaScript tests and the integration
production build passed. Browser rendering has not been rechecked.
