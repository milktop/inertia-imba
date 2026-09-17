class StudentsController < InertiaController
  def index
    students = Student.order(:name)
    students = students.where("name LIKE ?", "%#{Student.sanitize_sql_like(params[:query])}%") if params[:query].present?

    @students = students.as_json(only: %i[id name email active])
    @query = params[:query].to_s
    @diagnostics = { generated_at: Time.current.iso8601 } if params[:diagnostics] == "1"
  end

  def toggle_active
    student = Student.find(params[:id])
    student.toggle_active!
    redirect_to students_path(query: params[:query].presence), status: :see_other
  end

  def reports
    @student_count = Student.count
  end

  def create
    student = Student.new(student_params)
    precognition!(student)

    if student.save
      redirect_to students_path, notice: "Student created"
    else
      redirect_to students_path, inertia: { errors: student.errors.to_hash }
    end
  end

  private

  def student_params
    params.expect(student: %i[name email])
  end
end
