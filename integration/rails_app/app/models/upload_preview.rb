# This fixture validates an upload without storing or serving user files.
class UploadPreview
  include ActiveModel::Model

  MAX_BYTES = 2.megabytes

  attr_accessor :title, :file

  validates :title, presence: true
  validate :valid_file

  private

  def valid_file
    unless file.is_a?(ActionDispatch::Http::UploadedFile)
      errors.add(:file, "must be selected")
      return
    end

    errors.add(:file, "must be a text file") unless file.content_type == "text/plain"
    errors.add(:file, "must be 2 MB or smaller") if file.size > MAX_BYTES
  end
end
