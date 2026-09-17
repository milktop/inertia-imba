class PagesController < InertiaController

  def index
  end

  def about
    @adapter_version = "0.0.1"
  end

  def forms
  end

  def loading
    @summary = InertiaRails.defer { { total: Student.count } }
    @details = InertiaRails.optional { { message: "This section was loaded when it became visible." } }
    @checked_at = Time.current.iso8601(3)
  end

end
