# Upload regression coverage

File handling had unit coverage but lacked a real browser-to-Rails check.

Added a small /uploads fixture using the existing useForm API: nested File data
becomes multipart automatically, progress is visible, cancellation keeps the file
for retry, and reset/success clear both form state and the native file input.
Rails validates a title, a text/plain upload, and a 2 MB size limit. This is a
metadata-only demonstration; it stores or serves no user files. Production file
storage and content inspection are outside the fixture's scope.

Playwright tests use actual Chromium upload throttling to check progress and
cancellation, then retry without throttling. Other cases cover invalid uploads,
retaining a draft on validation errors, successful multipart metadata, and reset.
Controller tests also cover oversized files. No adapter runtime changes were
needed for these flows.

The first GitHub CI run exposed an unrelated Students test collision with db:prepare
seed data. The query test now creates a uniquely named student instead of Ada.
Verify Rails tests against a seeded database as well as the ordinary browser suite.
