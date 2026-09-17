require "test_helper"

class ActionExamplesControllerTest < ActionDispatch::IntegrationTest
  setup do
    get action_examples_url
    assert_response :success
    document = Nokogiri::HTML(response.body)
    page = JSON.parse(document.at_css('script[data-page="app"]').text)
    @headers = {
      "X-Inertia" => "true",
      "X-Inertia-Version" => page.fetch("version"),
      "X-CSRF-Token" => document.at_css('meta[name="csrf-token"]')["content"]
    }
  end

  test "action verbs receive payloads and redirect back with session metadata" do
    %i[post patch put delete].each do |method|
      path = method == :post ? action_examples_url : action_example_url("demo")
      public_send(method, path, params: { action_demo: { label: "Example" } }, headers: @headers)
      assert_response :see_other
      follow_redirect!(headers: @headers)
      assert_response :success
      assert_equal method.to_s.upcase, response.parsed_body.dig("props", "last_action", "method")
      assert_equal "Example", response.parsed_body.dig("props", "last_action", "label")
    end
  end

  test "invalid action returns Inertia errors" do
    post action_examples_url, params: { action_demo: { label: "" } }, headers: @headers
    assert_response :see_other
    follow_redirect!(headers: @headers)
    assert_equal "can't be blank", response.parsed_body.dig("props", "errors", "label")
  end
end
