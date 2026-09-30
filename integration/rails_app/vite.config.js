import { defineConfig } from 'vite'
import RubyPlugin from 'vite-plugin-ruby'
import imbaPlugin from '@milktop/inertia-imba/vite'

// The adapter's plugin also configures prebundling and runtime dedupe.
export default defineConfig({
  plugins: [RubyPlugin(), imbaPlugin()],
})
