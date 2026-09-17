# Rails integration fixture

This is a deliberately small Rails 8.1 application for exercising the
experimental Inertia Imba adapter in the repository root.

It covers:

- Vite resolution of `app/frontend/pages/**/*.imba`
- named page props (`students`, `query`, and `adapter_version`)
- a prop (`diagnostics`) that is present in one response and absent in another
- Rails model validation flowing back through the Imba `useForm` helper
- `preserveState: true` filtering
- `preserveState: false` page replacement
- a persistent `AuthenticatedLayout` shell configured in `createInertiaApp`

## Rails conventions

Page controllers inherit from `InertiaController`, which enables
`default_render` and `use_inertia_instance_props`. Assign `@students`, `@query`,
etc. in the action; no `render inertia:` call is needed. Keep temporary values
as local variables so they are not exposed as page props.

The default controller/action resolver uses lowercase paths:

- `StudentsController#index` → `app/frontend/pages/students/index.imba`
- `PagesController#about` → `app/frontend/pages/pages/about.imba` (URL `/about`)

`config/initializers/inertia_rails.rb` follows Tutorapp's configuration: Vite asset
versioning, encrypted history, JSON-script initial page data, empty error hashes,
and `data-inertia` head attributes. SSR remains disabled because this adapter
does not implement it. Restart Rails after initializer changes.

## Run

```sh
bin/setup
bin/rails db:seed
bin/dev
```

Then open <http://localhost:3000>.

Use the Ruby version in `.ruby-version` (3.4.1). `bin/setup` installs npm
dependencies in both the adapter root and this fixture. The JSON gem is pinned
below 3 because Rails 8.1's session decoder passes positional options to
`JSON.parse`, which JSON 3 no longer accepts.

Run the server-side and frontend checks independently:

```sh
bin/rails test
npm run build
```

Builds and unit tests do not replace browser verification. See
`../../docs/changes/2026-09-16-adapter-runtime.md` for the end-to-end checklist
and the scenarios verified against both Vite and built assets.

`entrypoints/inertia.js` imports `../inertia.imba`. Keep Imba source outside
the entrypoints directory: Vite Ruby classifies unknown extensions as static
assets. The Vite config deduplicates and prebundles the Imba and Inertia runtimes
because generated Imba imports are not visible to the initial dependency scan.

The fixture uses `@inertiajs/imba: file:../..`, so changes to the adapter can
be tested without publishing an npm package.

It also includes a deliberately narrow local Imba Vite transform. The latest
published `vite-plugin-imba` expects `parseAsset`, which current Imba alphas no
longer export. The local transform uses the public `compile` export and should
be removed once those upstream packages are compatible again.

## Layout persistence check

Click the header's layout counter, then navigate Students → About → Students.
The counter should survive while a draft in the Students form resets. Filtering
Students preserves both the draft and the layout counter. Pages use ordinary
`<self>` rendering; the layout renders the adapter-owned `pageContent` node.

## Upload check

Open About → File uploads (`/uploads`). Select a text file up to 2 MB and enter a
title. On success, Rails reports the filename and byte count and the form clears.
Submitting without a title or file displays Rails validation errors. The fixture
only inspects metadata and does not retain or serve uploaded files.

For a manual progress/cancel check, throttle the connection in browser devtools,
select a larger text file, submit, and click Cancel upload while it is sending.
The file remains selected so you can retry. Reset upload clears it and any errors.
The browser suite automates these flows with a separate database; run
`npm run test:browser` from the repository root.
