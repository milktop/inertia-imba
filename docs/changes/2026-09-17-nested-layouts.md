# Nested persistent layouts

Pages can now export a flat layout array, outermost first. The application default
callback and tag static layout property accept the same array. Existing single
layouts still work, and null/false/[] opts out. Per-page declarations replace the
default; they do not implicitly prepend it.

The adapter preserves only the matching outer sequence. Replacing a parent
recreates its descendants, even when a descendant tag class is unchanged. Each
layout receives fresh page props and a protected pageContent pointing at the next
layout or page. Removing a section releases its node through Imba's existing
render lifecycle; re-entry constructs a new instance.

Students and Student reports demonstrate this with a section note and navigation
toggle. About keeps only the outer app shell. Unit coverage checks prop updates,
content ownership, appending/removing/replacing/reordering layouts and opt-out.
Browser coverage checks the actual section node is retained across page changes,
detaches on leaving, and has fresh state on return while the outer counter persists.
Type examples cover arrays, readonly declarations, and invalid entries.

The upload regression locator also accepts both Reset and Reset upload labels.
