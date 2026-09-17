# Student active toggle example

Added a non-null active boolean with default true and a PATCH member route for
Students. The model toggles inside with_lock so the read and update happen within
the same lock. The controller redirects back with the current search query and
includes active in the student props. Existing records become active on migration.

The list displays current status and standalone Activate/Deactivate LinkButtons.
Buttons expose aria-pressed and preserve scroll; LinkButton's default state
preservation retains the form draft. Browser coverage checks a real record in
both directions, persistence after reload, loading/duplicate protection, keyboard
activation, and preserving the filter/draft. Rails coverage checks persistence,
unchanged identifying fields, and rejection of GET requests for the toggle.

Removed the misleading no-op form around the action examples. The browser test
now associates a button with its own test-only form to retain submit-safety
coverage; normal usage needs no form because LinkButton sets type=button itself.
