# Match the usual Inertia Rails conventions

Compared the fixture with tutorapp-svelte, tutorapp-react, perigovet-svelte, and
inertia-svelte-new. Follow Tutorapp's scoped base-controller pattern:

- `InertiaController < ApplicationController` enables `default_render` and
  `use_inertia_instance_props`, and shares environment and flash props.
- Students and Pages inherit from it and assign instance variables. Temporary
  model/query objects stay local so they are not inadvertently serialized.
- The gem's default resolver maps controller/action paths directly to lowercase
  page names: `students/index.imba` and `pages/about.imba`. URLs remain unchanged.
- `inertia_rails.rb` matches Tutorapp: Vite digest versioning, encrypted history,
  empty error hashes, JSON-script bootstrap data, and data-inertia head attributes.
- Leave SSR disabled: this adapter does not implement it. Do not copy auth or
  pagination helpers into a fixture that has neither feature. The head attribute
  option configures server meta tags; it does not add a client Head component.

Verification: 8 Rails tests, 47 assertions passed, including version mismatch
reloads, CSRF-protected validation and creation, and both implicit page names.
Browser checks passed for first render, About navigation, encrypted Back history,
and blank-form validation with no console errors. A temporary server on 3100 was
used and stopped; the user's existing bin/dev processes were left running.

Restart bin/dev to load the initializer changes. Future page controllers should
inherit from InertiaController and place pages at pages/<controller_path>/<action>.imba.
