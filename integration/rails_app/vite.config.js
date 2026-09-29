import { defineConfig } from 'vite'
import RubyPlugin from 'vite-plugin-ruby'
import imbaPlugin from '@milktop/inertia-imba/vite'

export default defineConfig({
  plugins: [RubyPlugin(), imbaPlugin()],
  optimizeDeps: {
    // Imba imports are introduced by the transform, after Vite's initial scan.
    include: ['imba', 'imba/runtime', '@inertiajs/core'],
  },
  resolve: {
    // The adapter is linked from the repository root. Share one Imba runtime.
    dedupe: ['imba', '@inertiajs/core'],
  },
})
