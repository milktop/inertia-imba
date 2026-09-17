# Browser compatibility and documentation pass

The browser suite originally ran only in Chromium. Add Firefox and WebKit jobs
on Linux, selected by PLAYWRIGHT_BROWSER. Keep local Chrome selection scoped to
Chromium. Precise upload-progress/cancellation tests use Chromium's CDP API and
are explicitly skipped elsewhere; real upload validation, retry and reset remain
covered in all engines.

The current Playwright builds cannot install Firefox on this development Mac's
macOS 13 arm64. Use CI for the additional engines rather than treating an OS
installation failure as an adapter failure. Review any failing native anchor/
button, binding, history and lifecycle checks before claiming compatibility.

Refresh README action-button and browser-testing descriptions. SSR remains
parked; the saved experiments and caveats are linked from the README.
