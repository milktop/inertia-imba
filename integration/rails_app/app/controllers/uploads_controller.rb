class UploadsController < InertiaController
  def index
    @receipt = flash[:upload_receipt]
  end

  def create
    upload = UploadPreview.new(params.expect(upload: %i[title file]))

    if upload.valid?
      # Keep only metadata in the flash; Rails owns and cleans up the temp file.
      flash[:upload_receipt] = {
        title: upload.title,
        filename: upload.file.original_filename,
        bytes: upload.file.size,
        content_type: upload.file.content_type
      }
      redirect_to uploads_path, notice: "Upload received"
    else
      redirect_to uploads_path, inertia: { errors: upload.errors.to_hash }
    end
  end
end
