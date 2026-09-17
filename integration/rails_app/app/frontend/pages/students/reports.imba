import { Head, Link } from '@inertiajs/imba'
import AuthenticatedLayout from '../../layouts/authenticated.imba'
import StudentsLayout from '../../layouts/students.imba'

export const layout = [AuthenticatedLayout, StudentsLayout]

export default tag StudentReports
	prop student_count

	<self.student-reports>
		<Head title="Student reports">
		<h1> "Student reports"
		<p> "Total students: {student_count}"
		<Link href="/students"> "Return to student list"
