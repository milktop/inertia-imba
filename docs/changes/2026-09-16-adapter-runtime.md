# Adapter runtime repair — 2026-09-16

## Problems and fixes

- The root adapter dependencies were missing. `bin/setup` now installs both npm
  projects, and the fixture declares its Inertia core peer dependency explicitly.
- Vite Ruby classified the `.imba` entrypoint as an asset while the manual Rollup
  input compiled the same file, producing conflicting manifests. A conventional
  JS entrypoint imports the Imba bootstrap outside `entrypoints`; no input override
  is needed. Linked adapter source also participates in the Ruby build cache digest.
- The Vite dependency scan cannot see imports introduced by the Imba transform.
  Explicit prebundling and deduplication prevent multiple Imba runtime instances.
- Several `do` blocks supplied functions where JS APIs expected option objects.
  Explicit object literals now configure the app, router, and form.
- `<InertiaApp(props)>` called a class as a function. Named tag attributes now
  pass bootstrap props, and setup initializes dependent state after assignment.
- Inertia 3's DOM helper only reads JSON script elements. Bootstrap also supports
  the Rails `data-page` attribute and reports missing page/root data clearly.
- The layout's `visit` method shadowed Imba's render lifecycle. It is now `navigate`.
- Page props were assigned after the first render. The adapter now constructs a
  page node, assigns named props, then lets Imba run setup/render. Preserved visits
  reuse the node and clear omitted keys; other visits create a fresh node without
  an intermediate empty-page render.
- JSON 3 broke Rails 8.1 cookie deserialization after an initial request. Pinning
  `json < 3` selects 2.21.2. Remove the pin only after verifying Rails compatibility.
  Reference: https://api.rubyonrails.org/classes/ActiveSupport/JSON.html
- Forms now enter processing in `onStart`, so cancelled `onBefore` callbacks do not
  leave the submit button disabled. A new visit clears the prior success timer.
- Rails now always includes `errors: {}`. Controller tests obtain an actual CSRF
  token and omit a bogus empty version header (the fixture's version is null).

## Verification

Automated checks:

- `npm test`: adapter compilation and six focused JS tests, including the form
  validation/retry/reset lifecycle, cancellation before start, and success timers.
- `cd integration/rails_app && bin/rails test`: six tests / 34 assertions, covering
  repeated HTML requests with session cookies, named/omitted props, validation
  redirect consumption, successful persistence, and clear errors. CSRF stays enabled.
- `npm run test:integration`: production frontend build. This is a build check,
  not an automated browser test.

Manual browser checks against Rails on port 3100 with Vite on 3036:

1. Load Students and see seeded names on the first render.
2. Navigate to About; see the named `adapter_version` prop and inherited shell.
3. Return to Students and submit empty fields; see both Rails validation messages
   and an enabled submit button after completion.
4. Fill a draft, filter to Ada, and confirm the list and query update while the
   draft remains. Submit valid data; confirm a new row and cleared fields/errors.
5. Add and remove diagnostics with `preserveState: true`; confirm the optional prop
   disappears while draft input survives.
6. Click the Students navigation link; confirm same-class navigation resets draft
   state. Check About → Back → Forward for correct component and props.

Built-asset checks: stop Vite, build with `npm run build -- --mode development`,
reload Rails, and verify the document loads a hashed `.js` asset without a Vite
client. Repeat navigation, blank validation, duplicate-email validation, correction,
creation, and field/error reset. These scenarios passed. Two clearly named E2E
student records were created in the development database during verification.

## Follow-up scope

Keep the current adapter; these were concrete integration and lifecycle defects,
not evidence that a rewrite is needed. The next useful addition is a committed
browser regression suite running this checklist against an isolated test database.
SSR, persistent layouts, Head/Link components, remembered state, cancellation APIs,
uploads, and concurrent submissions remain outside this prototype's verified scope.
The local Vite transform supports reload-based development, not stateful Imba HMR.
