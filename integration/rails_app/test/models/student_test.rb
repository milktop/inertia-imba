require "test_helper"

class StudentTest < ActiveSupport::TestCase
  test "requires a name and email" do
    student = Student.new

    assert_not student.valid?
    assert_includes student.errors[:name], "can't be blank"
    assert_includes student.errors[:email], "can't be blank"
  end
end
