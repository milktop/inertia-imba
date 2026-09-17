# SSR preliminary assessment

SSR looks achievable, but hydration needs a focused prototype before committing
to full support. This investigation does not enable SSR in the adapter.

## Evidence

- Installed Imba 2.0.0-alpha.253 includes a Node DOM implementation, HTML
  serialization, SSR markers, and a browser hydration queue.
- A small component compiled with `platform: 'node'` successfully rendered
  `<ssr-probe class="_ssr_"><h1>Hello Students</h1></ssr-probe>` in Node without
  a browser. This proves basic serialization, not adapter hydration.
- Inertia core provides the SSR server bridge. Rails already supports calling
  that server and falling back to client rendering on failure:
  https://inertia-rails.dev/guide/server-side-rendering

## Work required

1. Add a server rendering path to `createInertiaApp`, which currently explicitly
   rejects Node execution. Return Inertia's head/body response.
2. Prove browser startup can adopt the server-rendered page and layout tree
   without recreating it, duplicating content, or losing event bindings.
   Our current startup creates and mounts new component instances.
3. Make page state and head collection request-local. `page.js` and `head.js`
   currently keep module-global state, unsuitable for concurrent SSR requests.
4. Collect Head synchronously on the server instead of relying on browser
   mounting and MutationObserver. Audit remembered forms and browser-only
   lifecycle effects such as polling and visibility observers.
5. Teach the fixture's Imba Vite plugin to target Node for SSR; it currently
   always targets the browser. Verify matching component identities and CSS
   across client/server builds, then add an SSR entry and Rails configuration.
6. Cover rendered HTML with JavaScript disabled, hydration DOM reuse, working
   forms/links, nested layouts, head output, concurrent request isolation, and
   fallback when the SSR process is unavailable.

## Recommended next step

Start with one page, one layout, a prop, and a clickable counter. Prove HTML
serialization and hydration against the same compiled application before
expanding to forms and Head. If that succeeds cleanly, SSR is a medium-to-large
adapter feature; if Imba hydration requires upstream changes, reassess scope.

SSR is most useful for public, indexable pages and initial content delivery.
It is lower priority for an authenticated student-management interface. It
also adds a production JavaScript rendering process to operate. Existing
page components should remain reusable, provided render/setup code is safe
to execute without browser APIs.

## Proof-of-concept results

The runnable probe is in `experiments/ssr/` (see its README for the command).
It verifies real HTML with JavaScript disabled and browser startup in Chrome.
With the installed runtime, the probe currently fails the SSR readiness gate:

- Interpolated `<script>` text is not escaped in the serialized heading.
- Browser startup duplicates the heading/button; only the new button works.
  Existing DOM references survive, but this is not successful hydration.

These are blockers for this implementation path, not a conclusion that SSR is
impossible. Investigate the supported Imba build/runtime combination or upstream
fixes next. No adapter APIs or Rails configuration were changed by the probe.

## Follow-up: achievable with a client remount

The expanded experiment now uses the actual adapter, two nested layouts, Link,
Head, and a remembered form. Its strict remount checks pass in Chrome with
in-memory runtime fixes. Initial HTML/CSS/input values display without JavaScript;
subsequent Inertia navigation, form binding, title updates, and layout persistence
work. See `experiments/ssr/README.md` for commands and the tested scope.

Three runtime areas needed fixes: escaped text/attributes, ignoring disconnected
components during browser startup, and lowercase server node names missing the
uppercase form-binding lookup. Source-built and prebuilt unpatched runtimes show
the same original failures. This is not solely a Vite configuration problem.

DOM-preserving hydration remains unproven. The working approach replaces the
initial component tree once. A deliberately delayed-script test confirms that
input typed before startup is lost on replacement. Server Head collection,
request isolation, Rails transport, broader controls, and other browsers remain
follow-up work; these runtime patches are experimental, not shipped adapter fixes.

Recommendation: SSR with a documented remount is a realistic first milestone,
subject to resolving/maintaining the Imba runtime fixes. Full hydration is a
larger runtime/compiler task and should be discussed upstream separately.
