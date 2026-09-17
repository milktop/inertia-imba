# Nested form fields

Selective reset/default helpers previously accepted whole top-level fields only.
They now accept dotted object paths and numeric array indices, preserving sibling
edits and file identity. Literal dotted keys already present in data take priority.
Unknown reset paths are ignored, and unsafe prototype paths/helper collisions are
rejected before default updates. Error keys remain flat, exact dotted paths.

The shared form state implementation also gives useHttp these helpers.
Type declarations check nested leaf values. dontRemember remains top-level only.

About → Nested form helpers demonstrates leaf resets, defaults, errors and
remembered drafts. Focused unit/type tests cover arrays, missing parents, literal
keys, files and unsafe paths; the browser test verifies binding and history.
