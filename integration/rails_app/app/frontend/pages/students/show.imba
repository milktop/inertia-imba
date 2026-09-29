import { Head, useForm } from "@milktop/inertia-imba"

export default tag StudentsShow
	prop student

	def setup
		form = useForm({ name: student.name })

	def submit
		form.patch("/students/{student.id}")

	<self>
		<Head title="{student.name} | Students">
		<h1.page-title> student.name
		<form @submit.prevent=submit>
			<input type="text" name="name" bind=form.name />
			<button type="submit"> "Save"
