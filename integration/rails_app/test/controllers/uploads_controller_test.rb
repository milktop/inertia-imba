require "test_helper"

class UploadsControllerTest < ActionDispatch::IntegrationTest
  setup do
    get uploads_url
    assert_response :success
    document = Nokogiri::HTML(response.body)
    page = JSON.parse(document.at_css('script[data-page="app"]').text)
    @headers = {
      "X-Inertia" => "true",
      "X-Inertia-Version" => page.fetch("version"),
      "X-CSRF-Token" => document.at_css('meta[name="csrf-token"]')["content"]
    }
  end

  test "multipart upload returns only metadata after redirect" do
    with_upload("hello\n") do |file|
      post uploads_url, params: { upload: { title: "Notes", file: file } }, headers: @headers
    end
    assert_redirected_to uploads_url
    follow_redirect!(headers: @headers)
    assert_response :success
    assert_equal({ "title" => "Notes", "filename" => "notes.txt", "bytes" => 6, "content_type" => "text/plain" },
      response.parsed_body.dig("props", "receipt"))
  end

  test "missing file and title return Inertia validation errors" do
    post uploads_url, params: { upload: { title: "" } }, headers: @headers
    assert_redirected_to uploads_url
    assert_equal ["must be selected"], session[:inertia_errors][:file]
    assert_equal ["can't be blank"], session[:inertia_errors][:title]
    assert_nil flash[:upload_receipt]
  end

  test "wrong file type is rejected" do
    with_upload("image", "image/png") do |file|
      post uploads_url, params: { upload: { title: "Notes", file: file } }, headers: @headers
    end
    assert_redirected_to uploads_url
    assert_equal ["must be a text file"], session[:inertia_errors][:file]
    assert_nil flash[:upload_receipt]
  end

  test "oversized file is rejected" do
    with_upload("a" * (UploadPreview::MAX_BYTES + 1)) do |file|
      post uploads_url, params: { upload: { title: "Notes", file: file } }, headers: @headers
    end
    assert_redirected_to uploads_url
    assert_equal ["must be 2 MB or smaller"], session[:inertia_errors][:file]
    assert_nil flash[:upload_receipt]
  end

  private

  def with_upload(contents, type = "text/plain")
    Tempfile.create(["notes", ".txt"]) do |temp|
      temp.binmode
      temp.write(contents)
      temp.flush
      yield Rack::Test::UploadedFile.new(temp.path, type, original_filename: "notes.txt")
    end
  end
end
