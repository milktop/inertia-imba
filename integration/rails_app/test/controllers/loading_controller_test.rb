require "test_helper"

class LoadingControllerTest < ActionDispatch::IntegrationTest
  test "initial response defers summary and omits visibility-only details" do
    get loading_url, headers: { "X-Inertia" => "true", "X-Inertia-Version" => ViteRuby.digest }
    assert_response :success
    page = response.parsed_body
    assert_equal "pages/loading", page.fetch("component")
    assert_not page.fetch("props").key?("summary")
    assert_not page.fetch("props").key?("details")
    assert_includes page.fetch("deferredProps").values.flatten, "summary"
    assert page.dig("props", "checked_at")
  end

  test "partial requests return only the requested optional or deferred data" do
    headers = { "X-Inertia" => "true", "X-Inertia-Version" => ViteRuby.digest, "X-Inertia-Partial-Component" => "pages/loading" }
    get loading_url, headers: headers.merge("X-Inertia-Partial-Data" => "summary")
    assert_response :success
    assert_equal Student.count, response.parsed_body.dig("props", "summary", "total")
    assert_not response.parsed_body.fetch("props").key?("details")

    get loading_url, headers: headers.merge("X-Inertia-Partial-Data" => "details")
    assert_response :success
    assert_match "became visible", response.parsed_body.dig("props", "details", "message")
    assert_not response.parsed_body.fetch("props").key?("summary")
  end
end
