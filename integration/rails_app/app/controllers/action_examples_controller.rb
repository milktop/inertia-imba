# A session-only fixture: exercises HTTP verbs without deleting application data.
class ActionExamplesController < InertiaController
  def index
    @last_action = session[:last_action]
  end

  def create
    record_action
  end

  def update
    record_action
  end

  def destroy
    record_action
  end

  private

  def record_action
    label = params.dig(:action_demo, :label).to_s
    if label.blank?
      redirect_to action_examples_path, inertia: { errors: { label: "can't be blank" } }, status: :see_other
    else
      session[:last_action] = { method: request.request_method, label: label }
      redirect_to action_examples_path, status: :see_other
    end
  end
end
