class HttpPreviewsController < ApplicationController
  # A JSON-only fixture endpoint: validates input without persisting anything.
  def create
    name = params[:name].to_s.strip

    if name.blank?
      render json: { errors: { name: ["can't be blank"] } }, status: :unprocessable_entity
    else
      render json: { message: "Hello, #{name}!" }
    end
  end
end
