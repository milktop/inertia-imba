import { Head, Link, useForm } from '@inertiajs/imba'

export default tag FormsPage
	form = useForm('Forms/Nested', {
		student: { name: 'Ada', email: 'ada@example.test' }
		lessons: [{ title: 'Math' }, { title: 'Art' }]
	})

	def exampleErrors
		form.setError({ 'student.name': 'Example name error', 'student.email': 'Example email error' })

	def saveNameDefault
		form.defaults('student.name', form.student.name)

	<self>
		<Head title="Nested form helpers">
		<article>
			<h1> "Nested form helpers"
			<p> "Try resetting one field while keeping your other edits. This example does not save student records."
			<Link href="/about"> "Back to About"
			<label>
				"Student name"
				<input bind=form.student.name>
			<label>
				"Student email"
				<input bind=form.student.email>
			<label>
				"First lesson"
				<input bind=form.lessons[0].title>
			<label>
				"Second lesson"
				<input bind=form.lessons[1].title>
			if form.errors['student.name']
				<p role="alert"> form.errors['student.name']
			if form.errors['student.email']
				<p role="alert"> form.errors['student.email']
			<p> "Form dirty: {form.isDirty}"
			<button type="button" @click=form.resetAndClearErrors('student.name')> "Reset name + error"
			<button type="button" @click=saveNameDefault> "Make name the default"
			<button type="button" @click=form.reset('lessons.0.title')> "Reset first lesson"
			<button type="button" @click=form.resetAndClearErrors!> "Reset everything"
			<button type="button" @click=exampleErrors> "Add example errors"
