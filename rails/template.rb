# frozen_string_literal: true

# Rails application template for Inertia + Imba.
#
#   rails new myapp --skip-javascript \
#     -m https://raw.githubusercontent.com/milktop/inertia-imba/main/rails/template.rb
#
# Environment overrides:
#   INERTIA_IMBA_REF=v0.1.1          adapter tag, branch or commit to install
#   INERTIA_IMBA_PATH=/path/to/repo  link a local checkout via file: instead
#   INERTIA_IMBA_SOURCE=<npm spec>   any other npm source, e.g. git+file:///repo#v0.1.1

ADAPTER_REF = ENV.fetch("INERTIA_IMBA_REF", "v0.1.1")
ADAPTER_PATH = ENV["INERTIA_IMBA_PATH"]
ADAPTER_SOURCE = ENV["INERTIA_IMBA_SOURCE"] ||
  (ADAPTER_PATH ? "file:#{File.expand_path(ADAPTER_PATH)}" : "github:milktop/inertia-imba##{ADAPTER_REF}")

unless system("npm --version", out: File::NULL, err: File::NULL)
  say "npm is required. Install Node.js 20+ and try again.", :red
  exit 1
end

gem "inertia_rails"
gem "vite_rails"

after_bundle do
  # Vite replaces importmap when rails new ran without --skip-javascript.
  if File.exist?("config/importmap.rb")
    run "bundle remove importmap-rails turbo-rails stimulus-rails", abort_on_failure: false
    remove_file "config/importmap.rb"
    remove_file "bin/importmap"
    remove_dir "app/javascript"
    remove_dir "vendor/javascript"
  end

  # Creates binstubs, config/vite.json, Procfile.dev and package.json.
  run "bundle exec vite install"
  remove_file "vite.config.ts"
  remove_file "vite.config.mts"
  remove_file "app/frontend/entrypoints/application.js"

  run "npm install imba @inertiajs/core #{ADAPTER_SOURCE}"
  create_file ".node-version", "#{`node --version`.strip.delete_prefix("v")}\n", force: true

  # bin/setup installs npm packages alongside gems.
  inject_into_file "bin/setup", after: /system\("bundle check"\).*\n/ do
    "  system! \"npm install\"\n"
  end

  # Run Rails and the Vite dev server together from Procfile.dev.
  create_file "bin/dev", <<~'SH', force: true
    #!/usr/bin/env sh

    if ! gem list foreman -i --silent; then
      echo "Installing foreman..."
      gem install foreman
    fi

    export PORT="${PORT:-3000}"
    exec foreman start -f Procfile.dev "$@"
  SH
  chmod "bin/dev", 0o755

  create_file "vite.config.js", <<~'JS', force: true
    import { defineConfig } from 'vite'
    import RubyPlugin from 'vite-plugin-ruby'
    import { fileURLToPath } from 'node:url'
    import imba from '@milktop/inertia-imba/vite'

    export default defineConfig({
      // The Imba plugin also configures prebundling and a shared Imba runtime.
      plugins: [RubyPlugin(), imba()],
      // `@/components/button.imba` imports from app/frontend.
      resolve: {
        alias: { '@': fileURLToPath(new URL('./app/frontend', import.meta.url)) },
      },
    })
  JS

  # Lets editors resolve the @ alias.
  create_file "jsconfig.json", <<~'JSON'
    {
      "compilerOptions": {
        "baseUrl": ".",
        "paths": { "@/*": ["app/frontend/*"] }
      },
      "include": ["app/frontend/**/*"]
    }
  JSON

  create_file "config/initializers/inertia_rails.rb", <<~'RUBY', force: true
    # frozen_string_literal: true

    InertiaRails.configure do |config|
      config.version = ViteRuby.digest
      config.encrypt_history = true
      config.always_include_errors_hash = true
      config.use_script_element_for_initial_page = true
      config.use_data_inertia_head_attribute = true
    end
  RUBY

  create_file "app/views/layouts/application.html.erb", <<~'ERB', force: true
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <%= csrf_meta_tags %>
        <%= csp_meta_tag %>
        <%= inertia_meta_tags %>
        <%= vite_client_tag %>
        <%= vite_javascript_tag "inertia.js" %>
      </head>
      <body>
        <%= yield %>
      </body>
    </html>
  ERB

  create_file "app/controllers/inertia_controller.rb", <<~'RUBY'
    # frozen_string_literal: true

    # Actions render app/frontend/pages/<controller>/<action>.imba with
    # instance variables as props.
    class InertiaController < ApplicationController
      inertia_config default_render: true
      use_inertia_instance_props

      inertia_share flash: -> { flash.to_hash }
    end
  RUBY

  create_file "app/controllers/pages_controller.rb", <<~'RUBY'
    # frozen_string_literal: true

    class PagesController < InertiaController
      def index
        @greeting = "Hello from Rails"
      end

      def about
      end
    end
  RUBY

  route 'get "about", to: "pages#about"'
  route 'root "pages#index"'

  create_file "app/frontend/entrypoints/inertia.js", <<~'JS'
    // Vite Ruby discovers JavaScript entrypoints; Imba is compiled as an import.
    import '../inertia.imba'
  JS

  create_file "app/frontend/inertia.imba", <<~'IMBA'
import { createInertiaApp } from '@milktop/inertia-imba'
import AppLayout from '@/layouts/app.imba'
import 'imba/preflight.css'

let pages = import.meta.glob('./pages/**/*.imba', { eager: true })

# Registers global tags in components/ so pages can use them without imports.
# A component extending another custom tag must import its parent directly.
import.meta.glob('./components/**/*.imba', { eager: true })

createInertiaApp({
	layout: do(name, page)
		AppLayout
	resolve: do(name)
		let page = pages["./pages/{name}.imba"]
		throw new Error("Unknown Inertia page: {name}") unless page
		page
	title: do(title) title ? "{title} | APP_TITLE" : "APP_TITLE"
	progress: { color: '#4f46e5' }
})
  IMBA
  gsub_file "app/frontend/inertia.imba", "APP_TITLE", app_const_base.titleize

  create_file "app/frontend/layouts/app.imba", <<~'IMBA'
import { Link } from '@milktop/inertia-imba'

# Persistent layout: its state survives page visits.
export default tag AppLayout
	prop pageContent
	prop flash = {}

	css header a c:gray6 td:none
		&[aria-current="page"] c:gray9 fw:600

	<self>
		<header [d:flex g:4 p:4 bdb:1px solid gray3]>
			<Link href="/" prefetch> "Home"
			<Link href="/about" prefetch> "About"
		<main [p:4]>
			if flash.notice
				<p role="status" [c:green7]> flash.notice
			if flash.alert
				<p role="alert" [c:red7]> flash.alert
			<{pageContent}>
  IMBA

  create_file "app/frontend/pages/pages/index.imba", <<~'IMBA'
import { Head } from '@milktop/inertia-imba'

export default tag HomePage
	prop greeting
	count = 0

	<self>
		<Head title="Home">
		<h1 [fs:xl fw:bold]> greeting
		<p> "Edit app/frontend/pages/pages/index.imba to get started."
		<button @click=count++> "Clicked {count} times"
  IMBA

  create_file "app/frontend/pages/pages/about.imba", <<~'IMBA'
import { Head } from '@milktop/inertia-imba'

export default tag AboutPage
	<self>
		<Head title="About">
		<h1 [fs:xl fw:bold]> "About"
		<p> "Rails, Inertia and Imba."
  IMBA

  create_file "app/frontend/components/.keep", ""

  # Rails generates a Node-free Dockerfile with --skip-javascript, but
  # assets:precompile runs vite build. Install Node and npm packages in the
  # build stage only; node_modules is removed before the final image.
  if File.exist?("Dockerfile")
    inject_into_file "Dockerfile", before: "# Copy application code\n" do
      <<~DOCKER
        # Install Node.js and npm packages for the Vite build
        ARG NODE_VERSION=#{`node --version`.strip.delete_prefix("v")}
        ENV PATH=/usr/local/node/bin:$PATH
        RUN curl -sL https://github.com/nodenv/node-build/archive/master.tar.gz | tar xz -C /tmp/ && \\
            /tmp/node-build-master/bin/node-build "${NODE_VERSION}" /usr/local/node && \\
            rm -rf /tmp/node-build-master

        COPY package.json package-lock.json ./
        RUN npm ci

      DOCKER
    end
    inject_into_file "Dockerfile", after: "./bin/rails assets:precompile\n" do
      "\nRUN rm -rf node_modules\n"
    end
  end
  if File.exist?(".dockerignore")
    append_to_file ".dockerignore", "\n# Ignore local Vite builds.\n/public/vite*\n"
  end

  unless options[:skip_test]
    create_file "test/controllers/pages_controller_test.rb", <<~'RUBY'
      require "test_helper"

      class PagesControllerTest < ActionDispatch::IntegrationTest
        test "first load renders the Inertia page with props" do
          get root_url

          assert_response :success
          page = JSON.parse(Nokogiri::HTML(response.body).at_css('script[data-page="app"]').text)
          assert_equal "pages/index", page.fetch("component")
          assert_equal "Hello from Rails", page.dig("props", "greeting")
        end

        test "Inertia visits return JSON" do
          get about_url, headers: { "X-Inertia" => "true", "X-Inertia-Version" => ViteRuby.digest }

          assert_response :success
          assert_equal "pages/about", response.parsed_body.fetch("component")
        end
      end
    RUBY
  end

  say "\nInertia + Imba is ready. Run bin/dev and open http://localhost:3000", :green
end
