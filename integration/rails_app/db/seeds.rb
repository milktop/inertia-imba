Student.find_or_create_by!(email: "ada@example.test") { |student| student.name = "Ada Lovelace" }
Student.find_or_create_by!(email: "grace@example.test") { |student| student.name = "Grace Hopper" }
