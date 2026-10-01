# frozen_string_literal: true

# Rails application template for Inertia + Imba.
#
#   rails new myapp --skip-javascript \
#     -m https://raw.githubusercontent.com/milktop/inertia-imba/main/rails/template.rb
#
# Environment overrides:
#   INERTIA_IMBA_REF=v0.1.3          adapter tag, branch or commit to install
#   INERTIA_IMBA_PATH=/path/to/repo  link a local checkout via file: instead
#   INERTIA_IMBA_SOURCE=<npm spec>   any other npm source, e.g. git+file:///repo#v0.1.3
#   INERTIA_IMBA_AUTH=1|0            add authentication without prompting

ADAPTER_REF = ENV.fetch("INERTIA_IMBA_REF", "v0.1.3")
ADAPTER_PATH = ENV["INERTIA_IMBA_PATH"]
ADAPTER_SOURCE = ENV["INERTIA_IMBA_SOURCE"] ||
  (ADAPTER_PATH ? "file:#{File.expand_path(ADAPTER_PATH)}" : "github:milktop/inertia-imba##{ADAPTER_REF}")

unless system("npm --version", out: File::NULL, err: File::NULL)
  say "npm is required. Install Node.js 20+ and try again.", :red
  exit 1
end

AUTH = if ENV.key?("INERTIA_IMBA_AUTH")
  ENV["INERTIA_IMBA_AUTH"] == "1"
else
  yes?("Add authentication (Rails generator with Imba login pages)? [y/N]")
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

  # Rails 8.1.4 adds this importmap-only call even with --skip-javascript.
  gsub_file "app/controllers/application_controller.rb",
    /\n\s*# Changes to the importmap will invalidate the etag for HTML responses\n\s*stale_when_importmap_changes\n/, "\n"

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
        <%= javascript_tag nonce: true do %>
          // Apply the saved theme before first paint; app/frontend/theme.imba takes over after load.
          try {
            var theme = localStorage.getItem('theme') || 'system';
            if (theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches))
              document.documentElement.classList.add('dark');
          } catch (e) {}
        <% end %>
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

      # Every instance variable an action sets, including ones set by
      # before_action callbacks, is sent to the browser as a prop, serialized
      # with all of its attributes. For models with sensitive columns, pass
      # explicit props (render inertia: { ... }) or a presenter instead.
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
# <inertia-link>, <inertia-button>, <inertia-head> and route() in every tag.
import '@milktop/inertia-imba/globals'
import AppLayout from '@/layouts/app.imba'
import routes from '@/routes.json'
import '@/styles.imba'

let pages = import.meta.glob('./pages/**/*.imba', { eager: true })

# Registers global tags in components/ so pages can use them without imports.
# A component extending another custom tag must import its parent directly.
import.meta.glob('./components/**/*.imba', { eager: true })

createInertiaApp({
	# Exported from config/routes.rb; see config/initializers/inertia_routes.rb.
	routes: routes
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
# Persistent layout: its state survives page visits.
export default tag AppLayout
	prop pageContent
	prop flash = {}

	css header a c:$text-muted td:none
		&[aria-current="page"] c:$text fw:600

	<self>
		<header [d:flex ai:center g:4 p:4 bdb:1px solid $border]>
			<inertia-link route="pages.index" prefetch> "Home"
			<inertia-link route="pages.about" prefetch> "About"
			<span [ml:auto]>
			<theme-toggle>
		<main [p:4]>
			if flash.notice
				<p role="status" [c:$success]> flash.notice
			if flash.alert
				<p role="alert" [c:$danger]> flash.alert
			<{pageContent}>
  IMBA

  create_file "app/frontend/styles.imba", <<~'IMBA'
import 'imba/preflight.css'

global css
	# Colours follow the theme: use these instead of palette colours like gray6.
	# theme.imba toggles the .dark class on <html>.
	@root
		$bg:white $text:gray9 $text-muted:gray6 $border:gray3
		$success:green7 $danger:red7
		color-scheme:light
	html.dark
		$bg:gray9 $text:gray1 $text-muted:gray4 $border:gray7
		$success:green4 $danger:red4
		color-scheme:dark

	body bg:$bg c:$text
  IMBA

  create_file "app/frontend/theme.imba", <<~'IMBA'
# Theme choice is 'system', 'light' or 'dark'. The resolved theme is applied as
# a `dark` class on <html>, which the colour variables in styles.imba key off.
# The inline script in application.html.erb applies it before first paint.
const KEY = 'theme'
const media = window.matchMedia('(prefers-color-scheme: dark)')

def read
	try
		return window.localStorage.getItem(KEY) or 'system'
	catch
		return 'system'

class Theme
	choice = read!

	get dark?
		choice == 'dark' or (choice == 'system' and media.matches)

	def set value
		choice = value
		# Inside methods a bare `localStorage` would compile to self.localStorage.
		try window.localStorage.setItem(KEY, value)
		apply!

	def apply
		document.documentElement.classList.toggle('dark', dark?)
		imba.commit!

export const theme = new Theme

media.addEventListener('change', do theme.apply!)
theme.apply!
  IMBA

  create_file "app/frontend/components/theme-toggle.imba", <<~'IMBA'
import { theme } from '@/theme.imba'

tag theme-toggle
	css select bg:transparent c:inherit fs:sm px:2 py:1 bd:1px solid $border rd:md

	<self>
		<select aria-label="Theme" bind=theme.choice @change=theme.set(theme.choice)>
			<option value="system"> "System"
			<option value="light"> "Light"
			<option value="dark"> "Dark"
  IMBA

  create_file "app/frontend/pages/pages/index.imba", <<~'IMBA'
export default tag HomePage
	prop greeting
	count = 0

	<self>
		<inertia-head title="Home">
		<h1 [fs:xl fw:bold]> greeting
		<p> "Edit app/frontend/pages/pages/index.imba to get started."
		<button @click=count++> "Clicked {count} times"
  IMBA

  create_file "app/frontend/pages/pages/about.imba", <<~'IMBA'
export default tag AboutPage
	<self>
		<inertia-head title="About">
		<h1 [fs:xl fw:bold]> "About"
		<p> "Rails, Inertia and Imba."
  IMBA


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
    create_file "test/test_helpers/inertia_test_helper.rb", <<~'RUBY'
      module InertiaTestHelper
        # The Inertia page from the last response: JSON for Inertia requests,
        # or the page embedded in the HTML of a first load.
        def inertia_page
          return response.parsed_body if response.media_type == "application/json"

          JSON.parse(Nokogiri::HTML(response.body).at_css('script[data-page="app"]').text)
        end
      end

      ActiveSupport.on_load(:action_dispatch_integration_test) do
        include InertiaTestHelper
      end
    RUBY
    append_to_file "test/test_helper.rb", %(require_relative "test_helpers/inertia_test_helper"\n)

    create_file "test/controllers/pages_controller_test.rb", <<~'RUBY'
      require "test_helper"

      class PagesControllerTest < ActionDispatch::IntegrationTest
        test "first load renders the Inertia page with props" do
          get root_url

          assert_response :success
          assert_equal "pages/index", inertia_page.fetch("component")
          assert_equal "Hello from Rails", inertia_page.dig("props", "greeting")
        end

        test "Inertia visits return JSON" do
          get about_url, headers: { "X-Inertia" => "true", "X-Inertia-Version" => ViteRuby.digest }

          assert_response :success
          assert_equal "pages/about", inertia_page.fetch("component")
        end
      end
    RUBY
  end

  add_authentication if AUTH

  add_route_export

  say "\nInertia + Imba is ready. Run bin/dev and open http://localhost:3000", :green
end

# Rails 8's authentication generator, adapted for Inertia: Imba pages replace
# the ERB forms, failed submissions return Inertia errors, and the signed-in
# user is shared with every page.
def add_authentication
  generate "authentication"
  rails_command "db:migrate"

  # A safety net: a User that ends up as a prop never includes its password hash.
  inject_into_file "app/models/user.rb", before: /^end\s*\z/ do
    <<~'RUBY'.gsub(/^(?=.)/, "  ")

      # Never serialize the password hash, even if a User becomes an Inertia
      # prop or is asked for it with only:, which takes precedence over except:.
      def serializable_hash(options = nil)
        options = options ? options.dup : {}
        options[:except] = Array(options[:except]) + [ "password_digest" ]
        options[:only] &&= Array(options[:only]).map(&:to_s) - [ "password_digest" ]
        super(options)
      end
    RUBY
  end
  remove_dir "app/views/sessions"
  remove_dir "app/views/passwords"

  create_file "app/controllers/sessions_controller.rb", <<~'RUBY', force: true
    class SessionsController < InertiaController
      wrap_parameters false
      allow_unauthenticated_access only: %i[ new create ]
      rate_limit to: 10, within: 3.minutes, only: :create, with: -> { redirect_to new_session_path, alert: "Try again later." }

      def new
      end

      def create
        if user = User.authenticate_by(params.permit(:email_address, :password))
          start_new_session_for user
          redirect_to after_authentication_url
        else
          redirect_to new_session_path, inertia: { errors: { email_address: "Try another email address or password." } }
        end
      end

      def destroy
        terminate_session
        redirect_to new_session_path, status: :see_other
      end
    end
  RUBY

  create_file "app/controllers/passwords_controller.rb", <<~'RUBY', force: true
    class PasswordsController < InertiaController
      wrap_parameters false
      allow_unauthenticated_access
      before_action :set_user_by_token, only: %i[ edit update ]
      rate_limit to: 10, within: 3.minutes, only: :create, with: -> { redirect_to new_password_path, alert: "Try again later." }

      def new
      end

      def create
        if user = User.find_by(email_address: params[:email_address])
          PasswordsMailer.reset(user).deliver_later
        end

        redirect_to new_session_path, notice: "Password reset instructions sent (if user with that email address exists)."
      end

      # Explicit props: instance props would also expose @user, which is set
      # by a before_action that runs after the instance-prop snapshot.
      def edit
        render inertia: { token: params[:token] }
      end

      def update
        if @user.update(params.permit(:password, :password_confirmation))
          @user.sessions.destroy_all
          redirect_to new_session_path, notice: "Password has been reset."
        else
          redirect_to edit_password_path(params[:token]), inertia: { errors: @user.errors.to_hash(true).transform_values(&:first) }
        end
      end

      private
        def set_user_by_token
          @user = User.find_by_password_reset_token!(params[:token])
        rescue ActiveSupport::MessageVerifier::InvalidSignature
          redirect_to new_password_path, alert: "Password reset link is invalid or has expired."
        end
    end
  RUBY

  # Home stays public; About demonstrates a page that requires signing in.
  inject_into_file "app/controllers/pages_controller.rb", after: "class PagesController < InertiaController\n" do
    "  allow_unauthenticated_access only: :index\n\n"
  end

  inject_into_file "app/controllers/inertia_controller.rb", after: /inertia_share flash:.*\n/ do
    "  inertia_share user: -> { Current.user.as_json(only: %i[id email_address]) if authenticated? }\n"
  end

  gsub_file "app/frontend/layouts/app.imba", "\tprop flash = {}\n", "\tprop flash = {}\n\tprop user\n"
  nav = <<~'IMBA'.gsub(/^/, "\t\t\t")
    <span [ml:auto]>
    if user
    	<span> user.email_address
    	<inertia-button route="sessions.destroy"> "Log out"
    else
    	<inertia-link route="sessions.new"> "Log in"
  IMBA
  gsub_file "app/frontend/layouts/app.imba", %(\t\t\t<span [ml:auto]>\n), nav

  create_file "app/frontend/pages/sessions/new.imba", <<~'IMBA'
import { useForm } from '@milktop/inertia-imba'

export default tag SessionsNew
	form = useForm({ email_address: '', password: '' })

	def submit
		form.submit('sessions.create', null, { onFinish: do form.reset('password') })

	<self>
		<inertia-head title="Log in">
		<h1 [fs:xl fw:bold]> "Log in"
		<form @submit.prevent=submit [d:grid g:2 maw:24rem]>
			<input type="email" name="email_address" autocomplete="username" placeholder="Email address" required bind=form.email_address>
			<input type="password" name="password" autocomplete="current-password" placeholder="Password" required bind=form.password>
			if form.errors.email_address
				<p role="alert" [c:$danger]> form.errors.email_address
			<button type="submit" disabled=form.processing> "Log in"
		<inertia-link route="passwords.new"> "Forgot password?"
  IMBA

  create_file "app/frontend/pages/passwords/new.imba", <<~'IMBA'
import { useForm } from '@milktop/inertia-imba'

export default tag PasswordsNew
	form = useForm({ email_address: '' })

	<self>
		<inertia-head title="Forgot password">
		<h1 [fs:xl fw:bold]> "Forgot your password?"
		<form @submit.prevent=form.submit('passwords.create') [d:grid g:2 maw:24rem]>
			<input type="email" name="email_address" autocomplete="username" placeholder="Email address" required bind=form.email_address>
			<button type="submit" disabled=form.processing> "Email reset instructions"
		<inertia-link route="sessions.new"> "Back to log in"
  IMBA

  create_file "app/frontend/pages/passwords/edit.imba", <<~'IMBA'
import { useForm } from '@milktop/inertia-imba'

export default tag PasswordsEdit
	prop token
	form = useForm({ password: '', password_confirmation: '' })

	<self>
		<inertia-head title="Reset password">
		<h1 [fs:xl fw:bold]> "Update your password"
		<form @submit.prevent=form.submit('passwords.update', token) [d:grid g:2 maw:24rem]>
			<input type="password" name="password" autocomplete="new-password" placeholder="New password" required maxlength=72 bind=form.password>
			if form.errors.password
				<p role="alert" [c:$danger]> form.errors.password
			<input type="password" name="password_confirmation" autocomplete="new-password" placeholder="Repeat new password" required maxlength=72 bind=form.password_confirmation>
			if form.errors.password_confirmation
				<p role="alert" [c:$danger]> form.errors.password_confirmation
			<button type="submit" disabled=form.processing> "Save"
  IMBA

  return if options[:skip_test]

  # About now requires signing in.
  inject_into_file "test/controllers/pages_controller_test.rb", after: %(  test "Inertia visits return JSON" do\n) do
    "    sign_in_as users(:one)\n\n"
  end
  inject_into_file "test/controllers/pages_controller_test.rb", before: /^end\s*\z/ do
    <<~'RUBY'

        test "signed-out visitors are sent to log in" do
          get about_url

          assert_redirected_to new_session_path
        end
    RUBY
  end

  inject_into_file "test/models/user_test.rb", before: /^end\s*\z/ do
    <<~'RUBY'.gsub(/^(?=.)/, "  ")

      test "never serializes the password hash" do
        user = users(:one)

        assert_not_includes user.as_json.keys, "password_digest"
        assert_equal [ "email_address" ], user.as_json(only: %i[email_address password_digest]).keys
      end
    RUBY
  end

  create_file "test/controllers/sessions_controller_test.rb", <<~'RUBY', force: true
    require "test_helper"

    class SessionsControllerTest < ActionDispatch::IntegrationTest
      setup { @user = User.take }

      test "new" do
        get new_session_path

        assert_response :success
        assert_equal "sessions/new", inertia_page.fetch("component")
      end

      test "create with valid credentials" do
        post session_path, params: { email_address: @user.email_address, password: "password" }

        assert_redirected_to root_path
        assert cookies[:session_id]
      end

      test "create with invalid credentials" do
        post session_path, params: { email_address: @user.email_address, password: "wrong" }

        assert_redirected_to new_session_path
        assert_nil cookies[:session_id]
        follow_redirect!
        assert_match "Try another", inertia_page.dig("props", "errors", "email_address")
      end

      test "shares the signed-in user" do
        sign_in_as @user
        get root_path

        assert_equal @user.email_address, inertia_page.dig("props", "user", "email_address")
        assert_nil inertia_page.dig("props", "user", "password_digest")
      end

      test "destroy" do
        sign_in_as @user

        delete session_path

        assert_redirected_to new_session_path
        assert_empty cookies[:session_id]
      end
    end
  RUBY

  create_file "test/controllers/passwords_controller_test.rb", <<~'RUBY', force: true
    require "test_helper"

    class PasswordsControllerTest < ActionDispatch::IntegrationTest
      setup { @user = User.take }

      test "new" do
        get new_password_path

        assert_response :success
        assert_equal "passwords/new", inertia_page.fetch("component")
      end

      test "create" do
        post passwords_path, params: { email_address: @user.email_address }

        assert_enqueued_email_with PasswordsMailer, :reset, args: [ @user ]
        assert_redirected_to new_session_path
        follow_redirect!
        assert_match "reset instructions sent", inertia_page.dig("props", "flash", "notice")
      end

      test "create for an unknown user redirects but sends no mail" do
        post passwords_path, params: { email_address: "missing-user@example.com" }

        assert_enqueued_emails 0
        assert_redirected_to new_session_path
      end

      test "edit passes only the token" do
        token = @user.password_reset_token
        get edit_password_path(token)

        assert_response :success
        assert_equal "passwords/edit", inertia_page.fetch("component")
        assert_equal token, inertia_page.dig("props", "token")
        assert_not_includes response.body, "password_digest"
      end

      test "edit with invalid password reset token" do
        get edit_password_path("invalid token")

        assert_redirected_to new_password_path
        follow_redirect!
        assert_match "reset link is invalid", inertia_page.dig("props", "flash", "alert")
      end

      test "update" do
        assert_changes -> { @user.reload.password_digest } do
          put password_path(@user.password_reset_token), params: { password: "new", password_confirmation: "new" }
          assert_redirected_to new_session_path
        end

        follow_redirect!
        assert_match "Password has been reset", inertia_page.dig("props", "flash", "notice")
      end

      test "update with non matching passwords" do
        token = @user.password_reset_token
        assert_no_changes -> { @user.reload.password_digest } do
          put password_path(token), params: { password: "no", password_confirmation: "match" }
          assert_redirected_to edit_password_path(token)
        end

        follow_redirect!
        assert inertia_page.dig("props", "errors", "password_confirmation")
      end
    end
  RUBY
end

# Exports config/routes.rb to app/frontend/routes.json for route(), the
# route= props on links and buttons, and form.submit('tasks.update', params).
def add_route_export
  create_file "config/initializers/inertia_routes.rb", <<~'RUBY'
    # frozen_string_literal: true

    # Writes app/frontend/routes.json, keyed by "controller.action":
    #   { "tasks.destroy": { "method": "delete", "path": "/tasks/:id" } }
    # It is rewritten whenever routes load in development and before the Vite
    # production build; commit it. Every listed path ships to the browser, so
    # add controllers to EXCLUDED_CONTROLLERS to keep them out of it.
    module InertiaRoutes
      FILE = Rails.root.join("app/frontend/routes.json")
      EXCLUDED_CONTROLLERS = %r{\A(rails|active_storage|action_mailbox|turbo)/}

      def self.table
        Rails.application.routes.routes.each_with_object({}) do |route, table|
          controller, action = route.defaults.values_at(:controller, :action)
          verb = route.verb.to_s.split("|").first.to_s.downcase
          next if controller.blank? || action.blank? || verb.blank? || route.internal
          next if controller.match?(EXCLUDED_CONTROLLERS)

          # The first route for an action wins, e.g. /login over /session/new.
          table["#{controller}.#{action}"] ||= { method: verb, path: route.path.spec.to_s.delete_suffix("(.:format)") }
        end.sort.to_h
      end

      def self.write
        json = "#{JSON.pretty_generate(table)}\n"
        FILE.write(json) unless FILE.exist? && FILE.read == json
      end
    end

    Rails.application.config.after_routes_loaded { InertiaRoutes.write } if Rails.env.development?
  RUBY

  create_file "lib/tasks/inertia_routes.rake", <<~'RUBY'
    namespace :inertia do
      desc "Export named routes to app/frontend/routes.json"
      task routes: :environment do
        InertiaRoutes.write
      end
    end

    # Regenerate before Vite bundles routes.json into production assets;
    # assets:precompile runs vite:build_all.
    %w[vite:build vite:build_all].each do |name|
      Rake::Task[name].enhance([ "inertia:routes" ]) if Rake::Task.task_defined?(name)
    end
  RUBY

  rails_command "inertia:routes"

  return if options[:skip_test]

  create_file "test/lib/inertia_routes_test.rb", <<~'RUBY'
    require "test_helper"

    class InertiaRoutesTest < ActiveSupport::TestCase
      test "exports actions with their method and path" do
        assert_equal({ method: "get", path: "/" }, InertiaRoutes.table["pages.index"])
      end

      test "routes.json is up to date; run bin/rails inertia:routes" do
        assert_equal InertiaRoutes.table.as_json, JSON.parse(InertiaRoutes::FILE.read)
      end
    end
  RUBY
end
