require "test_helper"

class HttpPreviewsControllerTest < ActionDispatch::IntegrationTest
  setup do
    get about_url
    @csrf_token = Nokogiri::HTML(response.body).at_css('meta[name="csrf-token"]')["content"]
  end

  test "returns JSON without navigation or database writes" do
    assert_no_difference "Student.count" do
      post http_preview_url, params: { name: "Ada" }, as: :json, headers: { "X-CSRF-Token" => @csrf_token }
    end
    assert_response :success
    assert_equal({ "message" => "Hello, Ada!" }, response.parsed_body)
    assert_nil response.headers["X-Inertia"]
  end

  test "returns JSON validation errors with 422" do
    post http_preview_url, params: { name: " " }, as: :json, headers: { "X-CSRF-Token" => @csrf_token }
    assert_response :unprocessable_entity
    assert_equal ["can't be blank"], response.parsed_body.dig("errors", "name")
  end

  test "requires a CSRF token" do
    post http_preview_url, params: { name: "Ada" }, as: :json
    assert_response :unprocessable_entity
  end
end
