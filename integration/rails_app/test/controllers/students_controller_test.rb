require "test_helper"

class StudentsControllerTest < ActionDispatch::IntegrationTest
  setup do
    get students_url
    assert_response :success
    document = Nokogiri::HTML(response.body)
    @csrf_token = document.at_css('meta[name="csrf-token"]')["content"]
    @initial_page = JSON.parse(document.at_css('script[data-page="app"]').text)
  end

  test "HTML entrypoint and session survive a second request" do
    get students_url
    assert_response :success
    assert_select 'script[type="module"][src$=".js"]'
    assert_select "div#app"
    assert_select 'script[type="application/json"][data-page="app"]'
    assert_equal "students/index", @initial_page.fetch("component")
    assert_equal true, @initial_page.fetch("encryptHistory")
    assert_equal ViteRuby.digest, @initial_page.fetch("version")
  end

  test "index returns named students and query props" do
    Student.create!(name: "Katherine Johnson", email: "katherine-controller@example.test")

    get students_url(query: "Katherine"), headers: inertia_headers

    assert_response :success
    page = response.parsed_body
    assert_equal "students/index", page.fetch("component")
    assert_equal "test", page.dig("props", "environment")
    assert_equal "Katherine", page.dig("props", "query")
    assert_equal ["Katherine Johnson"], page.dig("props", "students").pluck("name")
  end

  test "optional props can disappear on a later response" do
    get students_url(diagnostics: 1), headers: inertia_headers
    assert response.parsed_body.dig("props", "diagnostics")

    get students_url, headers: inertia_headers
    assert_not response.parsed_body.fetch("props").key?("diagnostics")
  end

  test "about resolves its lowercase controller and action path automatically" do
    get about_url, headers: inertia_headers

    assert_response :success
    assert_equal "pages/about", response.parsed_body.fetch("component")
    assert_equal "0.0.1", response.parsed_body.dig("props", "adapter_version")
  end

  test "stale asset versions request a full reload" do
    get students_url, headers: inertia_headers.merge("X-Inertia-Version" => "stale-version")

    assert_response :conflict
    assert_equal students_url, response.headers["X-Inertia-Location"]
  end

  test "validation errors are stored for the redirect" do
    post students_url, params: { student: { name: "", email: "" } }, headers: inertia_headers

    assert_redirected_to students_url
    assert session[:inertia_errors].key?(:name)
    assert session[:inertia_errors].key?(:email)

    follow_redirect!(headers: inertia_headers)
    assert_response :success
    assert_equal ["can't be blank", "is too short (minimum is 4 characters)"], response.parsed_body.dig("props", "errors", "name")

    get students_url, headers: inertia_headers
    assert_equal({}, response.parsed_body.dig("props", "errors"))
  end

  test "valid submission redirects to the new list with clear errors" do
    assert_difference "Student.count", 1 do
      post students_url, params: { student: { name: "Browser Student", email: "browser@example.test" } }, headers: inertia_headers
    end
    assert_redirected_to students_url
    follow_redirect!(headers: inertia_headers)
    assert_response :success
    assert_equal({}, response.parsed_body.dig("props", "errors"))
    assert_includes response.parsed_body.dig("props", "students").pluck("email"), "browser@example.test"
    assert_equal "Student created", response.parsed_body.dig("props", "flash", "notice")

    get about_url, headers: inertia_headers
    assert_equal({}, response.parsed_body.dig("props", "flash"))
  end

  test "flash is included in the initial HTML page after a normal redirect" do
    post students_url, params: { student: { name: "HTML Student", email: "html@example.test" } },
      headers: { "X-CSRF-Token" => @csrf_token }
    follow_redirect!
    assert_response :success
    document = Nokogiri::HTML(response.body)
    page = JSON.parse(document.at_css('script[data-page="app"]').text)
    assert_equal "Student created", page.dig("props", "flash", "notice")
  end

  test "precognition validates without creating a student or redirecting" do
    headers = { "X-CSRF-Token" => @csrf_token, "Accept" => "application/json", "Precognition" => "true" }
    assert_no_difference "Student.count" do
      post students_url, params: { student: { name: "Validation Only", email: "validation-only@example.test" } }, headers: headers
    end
    assert_response :no_content
    assert_equal "true", response.headers["Precognition"]
    assert_equal "true", response.headers["Precognition-Success"]
    assert_nil flash[:notice]
  end

  test "precognition filters errors to the requested fields" do
    headers = {
      "X-CSRF-Token" => @csrf_token, "Accept" => "application/json",
      "Precognition" => "true", "Precognition-Validate-Only" => "email"
    }
    assert_no_difference "Student.count" do
      post students_url, params: { student: { name: "", email: "" } }, headers: headers
    end
    assert_response :unprocessable_entity
    assert_equal "true", response.headers["Precognition"]
    assert_equal({ "email" => ["can't be blank"] }, response.parsed_body.fetch("errors"))
    assert_nil session[:inertia_errors]

    assert_no_difference "Student.count" do
      post students_url, params: { student: { name: "Al", email: "" } },
        headers: headers.merge("Precognition-Validate-Only" => "name")
    end
    assert_response :unprocessable_entity
    assert_equal({ "name" => ["is too short (minimum is 4 characters)"] }, response.parsed_body.fetch("errors"))
  end

  test "reports supplies the student total to the nested-layout page" do
    get reports_students_url, headers: inertia_headers
    assert_response :success
    assert_equal "students/reports", response.parsed_body.fetch("component")
    assert_equal Student.count, response.parsed_body.dig("props", "student_count")
  end

  test "toggle active persists both directions without changing student details" do
    student = Student.create!(name: "Toggle Student", email: "toggle-controller@example.test")
    assert student.active?
    patch toggle_active_student_url(student), params: { query: "Toggle" }, headers: inertia_headers
    assert_response :see_other
    assert_redirected_to students_url(query: "Toggle")
    assert_not student.reload.active?
    assert_equal "Toggle Student", student.name
    assert_equal "toggle-controller@example.test", student.email
    follow_redirect!(headers: inertia_headers)
    assert_equal false, response.parsed_body.fetch("props").fetch("students").find { |item| item["id"] == student.id }.fetch("active")

    patch toggle_active_student_url(student), headers: inertia_headers
    assert_response :see_other
    assert student.reload.active?
  end

  test "toggle active cannot be triggered by a GET request" do
    student = Student.create!(name: "Toggle Student", email: "toggle-get@example.test")
    get toggle_active_student_url(student), headers: inertia_headers
    assert_response :not_found
    assert student.reload.active?
  end

  private

  def inertia_headers
    {
      "X-Inertia" => "true",
      "X-Inertia-Version" => @initial_page.fetch("version"),
      "X-CSRF-Token" => @csrf_token,
      "Accept" => "text/html, application/xhtml+xml"
    }
  end
end
