# SSR investigation

**Result:** initial server-rendered HTML followed by a controlled client remount
is achievable with this adapter. The expanded prototype passes in Chrome with
experimental Imba runtime fixes. DOM-preserving hydration is not demonstrated.
Neither the published adapter nor the Rails fixture enables SSR yet.

## Run

From the repository root, with the existing development dependencies installed:

```sh
# Expanded prototype; failure of a remount requirement fails the command.
PLAYWRIGHT_CHANNEL=chrome node experiments/ssr/run.mjs --adapter --patch-runtime --strict

# Original, unpatched runtime baseline: prints the known failures.
PLAYWRIGHT_CHANNEL=chrome node experiments/ssr/run.mjs

# Compile the runtime source too, to rule out a stale prebuilt runtime.
PLAYWRIGHT_CHANNEL=chrome node experiments/ssr/run.mjs --source-runtime

# Negative control: demonstrates discarded components mounting again.
# With --strict, this is expected to exit unsuccessfully.
PLAYWRIGHT_CHANNEL=chrome node experiments/ssr/run.mjs --adapter --patch-runtime --keep-detached --strict
```

Omit `PLAYWRIGHT_CHANNEL` to use Playwright's bundled Chromium. The harness uses
esbuild supplied by the installed Imba toolchain. It builds under ignored
`dist/ssr-poc`, starts a temporary loopback server, and closes the browser/server
when finished. No files in `node_modules` are changed.

Without `--strict`, the command reports diagnostic gates; a successful exit does
not mean SSR is ready. Baseline strict mode requires DOM-preserving hydration;
adapter strict mode deliberately requires the more limited remount behaviour.

## What works in the expanded prototype

`adapter.imba` uses the real `InertiaApp`, `Link`, `Head`, `useForm`, and nested
persistent-layout implementation. The test server returns Inertia JSON for the
subsequent visit. It does not simulate the adapter's component lifecycle.

Verified with Imba 2.0.0-alpha.253 and Chrome:

- The initial page, two layouts, CSS, and bound text-input value display with
  JavaScript disabled.
- Interpolated text, input attributes, and JSON props round-trip script-shaped
  text, quotes, literal HTML entities, ampersands, and Unicode correctly after
  the experimental serialization fixes. This is focused regression coverage,
  not a general security audit of Imba's server DOM.
- Browser startup produces one page with working click handlers and form binding.
- The live page and outer layout mount exactly once. Without the disconnected
  component guard, the outer layout mounts twice and stale Head processing can
  overwrite the live title with “undefined”.
- A real Inertia Link visit replaces the page while preserving both layouts'
  counters. Head updates the browser title correctly.
- No browser page errors or console errors occur in the passing run.
- DOM identity checks confirm that the initial page tree is replaced, not reused.
- Delaying the JavaScript response and editing the initial input proves a real
  limitation: text entered before startup is reset by the remount.

Server-side Head collection is **not** implemented: the HTML document uses a
fixed test title until the browser starts. No Rails SSR transport, concurrent
request isolation, or broader control/browser coverage is claimed by this probe.

## Why the original baseline fails

`page.imba` restores one prop and captures its existing child through Imba's
hydrate/dehydrate hooks. With both prebuilt and source-built runtimes, startup
leaves duplicate content. The original button remains inactive; the new button
works. Surviving DOM references alone were therefore misleading.

The installed component runtime's `#beforeReconcile` explicitly clears initial
SSR contents. It is not a general DOM-adoption implementation. Reusing nested
SSR nodes through these hooks can also let them render before their own hydration
initializes them. Solving general hydration involves runtime/compiler integration,
not just changing the adapter's `mount` call.

The current upstream component source matched the installed implementation during
this investigation. Its server Text serializer also retains the relevant
unescaped-text behaviour:

- https://github.com/imba/imba/blob/main/packages/imba/src/imba/dom/component.imba
- https://github.com/imba/imba/blob/main/packages/imba/src/imba/dom/core.imba

## Experimental fixes

`runtime-patches.mjs` changes compiler input **only in memory**. Exact-match guards
fail when the expected source changes. These patches need upstream review or a
maintained, pinned dependency before production use:

1. Escape Text-node output, and escape ampersands in ordinary text/attributes.
   Raw script/style text keeps its existing special treatment.
2. Ignore disconnected components in the browser hydration queue. A detached
   descendant can still have a parentNode; checking that alone runs stale hooks.
3. Normalize the server's lowercase node names when checking the binding table,
   whose keys are uppercase. Otherwise the bound input value is omitted.

`ProbeHost` is a separate experimental root. It reads the serialized initial page
and renders a fresh adapter tree. Pages/layouts need no special hydration hooks.
This is intentionally SSR with a client remount, not full hydration.

## Recommendation

Pursue opt-in SSR with a documented client remount as the first milestone if
initial HTML is the priority. First resolve the runtime fixes upstream or decide
explicitly how to maintain them. Then add request-local page/head state, server
Head output, the public renderer API, Vite/Rails wiring, and broader controls,
error/fallback, deployment, and browser checks. Measure startup and address
pre-startup form input loss before calling the feature production-ready.

Treat DOM-preserving hydration as a separate, larger upstream collaboration. Do
not build a general DOM reconciler inside this adapter merely to ship SSR.
