# frozen_string_literal: true

class InertiaController < ApplicationController
  inertia_config default_render: true

  inertia_share environment: -> { Rails.env }
  inertia_share flash: -> { flash.to_hash }

  use_inertia_instance_props
end
