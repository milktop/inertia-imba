# frozen_string_literal: true

# Rails application template for Inertia + Imba.
#
#   rails new myapp --skip-javascript \
#     -m https://raw.githubusercontent.com/milktop/inertia-imba/main/rails/template.rb
#
# Environment overrides:
#   INERTIA_IMBA_REF=v0.1.2          adapter tag, branch or commit to install
#   INERTIA_IMBA_PATH=/path/to/repo  link a local checkout via file: instead
#   INERTIA_IMBA_SOURCE=<npm spec>   any other npm source, e.g. git+file:///repo#v0.1.2
#   INERTIA_IMBA_AUTH=1|0            add authentication without prompting

ADAPTER_REF = ENV.fetch("INERTIA_IMBA_REF", "v0.1.2")
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

  say "\nInertia + Imba is ready. Run bin/dev and open http://localhost:3000", :green
end

# Rails 8's authentication generator, adapted for Inertia: Imba pages replace
# the ERB forms, failed submissions return Inertia errors, and the signed-in
# user is shared with every page.
def add_authentication
  generate "authentication"
  rails_command "db:migrate"
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

  gsub_file "app/frontend/layouts/app.imba", "import { Link } from '@milktop/inertia-imba'",
    "import { Link, LinkButton } from '@milktop/inertia-imba'"
  gsub_file "app/frontend/layouts/app.imba", "\tprop flash = {}\n", "\tprop flash = {}\n\tprop user\n"
  nav = <<~'IMBA'.gsub(/^/, "\t\t\t")
    <Link href="/about" prefetch> "About"
    <span [ml:auto]>
    if user
    	<span> user.email_address
    	<LinkButton href="/session" method="delete"> "Log out"
    else
    	<Link href="/session/new"> "Log in"
  IMBA
  gsub_file "app/frontend/layouts/app.imba", %(\t\t\t<Link href="/about" prefetch> "About"\n), nav

  create_file "app/frontend/pages/sessions/new.imba", <<~'IMBA'
import { Head, Link, useForm } from '@milktop/inertia-imba'

export default tag SessionsNew
	form = useForm({ email_address: '', password: '' })

	def submit
		form.post('/session', { onFinish: do form.reset('password') })

	<self>
		<Head title="Log in">
		<h1 [fs:xl fw:bold]> "Log in"
		<form @submit.prevent=submit [d:grid g:2 maw:24rem]>
			<input type="email" name="email_address" autocomplete="username" placeholder="Email address" required bind=form.email_address>
			<input type="password" name="password" autocomplete="current-password" placeholder="Password" required bind=form.password>
			if form.errors.email_address
				<p role="alert" [c:red7]> form.errors.email_address
			<button type="submit" disabled=form.processing> "Log in"
		<Link href="/passwords/new"> "Forgot password?"
  IMBA

  create_file "app/frontend/pages/passwords/new.imba", <<~'IMBA'
import { Head, Link, useForm } from '@milktop/inertia-imba'

export default tag PasswordsNew
	form = useForm({ email_address: '' })

	<self>
		<Head title="Forgot password">
		<h1 [fs:xl fw:bold]> "Forgot your password?"
		<form @submit.prevent=form.post('/passwords') [d:grid g:2 maw:24rem]>
			<input type="email" name="email_address" autocomplete="username" placeholder="Email address" required bind=form.email_address>
			<button type="submit" disabled=form.processing> "Email reset instructions"
		<Link href="/session/new"> "Back to log in"
  IMBA

  create_file "app/frontend/pages/passwords/edit.imba", <<~'IMBA'
import { Head, useForm } from '@milktop/inertia-imba'

export default tag PasswordsEdit
	prop token
	form = useForm({ password: '', password_confirmation: '' })

	<self>
		<Head title="Reset password">
		<h1 [fs:xl fw:bold]> "Update your password"
		<form @submit.prevent=form.put("/passwords/{token}") [d:grid g:2 maw:24rem]>
			<input type="password" name="password" autocomplete="new-password" placeholder="New password" required maxlength=72 bind=form.password>
			if form.errors.password
				<p role="alert" [c:red7]> form.errors.password
			<input type="password" name="password_confirmation" autocomplete="new-password" placeholder="Repeat new password" required maxlength=72 bind=form.password_confirmation>
			if form.errors.password_confirmation
				<p role="alert" [c:red7]> form.errors.password_confirmation
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
