import { compile } from 'imba/compiler'

// The published vite-plugin-imba currently expects compiler exports that were
// removed from newer Imba alphas. This narrow plugin is enough for application
// modules while the upstream packages converge again.
export default function imbaPlugin() {
  return {
    name: 'inertia-imba',
    enforce: 'pre',

    // Merged with the app's own config. Excluding the adapter from prebundling
    // keeps its JS and compiled Imba modules on one page-state module; without
    // it, getPage() returns null under the dev server. Imba imports are added
    // by the transform, after Vite's initial dependency scan.
    config() {
      return {
        optimizeDeps: {
          exclude: ['@milktop/inertia-imba'],
          include: ['imba', 'imba/runtime', '@inertiajs/core'],
        },
        resolve: { dedupe: ['imba', '@inertiajs/core'] },
      }
    },

    transform(source, id) {
      const filename = id.split('?')[0]
      if (!filename.endsWith('.imba')) return null

      const result = compile(source, {
        sourcePath: filename,
        platform: 'browser',
        sourcemap: true,
      })

      const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === 1)
      if (errors.length) {
        this.error(errors.map((error) => error.message).join('\n'))
      }

      return { code: result.js, map: result.sourcemap }
    },
  }
}
