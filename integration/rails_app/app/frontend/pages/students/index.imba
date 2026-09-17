import { Head, Link, router, useForm } from '@inertiajs/imba'

import AuthenticatedLayout from '../../layouts/authenticated.imba'
import StudentsLayout from '../../layouts/students.imba'

export const layout = [AuthenticatedLayout, StudentsLayout]

export default tag StudentsIndex
	prop students = []
	prop query = ''
	prop diagnostics

	form = useForm('Students/Create', { name: '', email: '' }).withPrecognition('post', '/students').withAllErrors!

	def setup
		form.transform(do(data) { student: data })

	def unmount
		form.cancel!

	def submit
		form.submit({
			preserveScroll: true
			onSuccess: do form.reset!
		})

	def search event
		event.preventDefault!
		router.get('/students', { query }, { preserveState: true, replace: true })

	<self.students-page>

		<Head title="Students">
			<meta head-key="description" name="description" content="Manage students in the Imba adapter test app.">

		<section>

			<article>
				<h1> "Students"
				<form @submit=search>
					<input bind=query placeholder="Filter students">
					<button type="submit"> "Search"
				<p> "Named query prop: “{query}”"
				if diagnostics
					<p> "Diagnostics prop present: {diagnostics.generated_at}"
				else
					<p> "Diagnostics prop is absent"
				<Link href="/students?diagnostics=1" preserveState=true> "Add diagnostics prop"
				<span> " · "
				<Link href="/students" preserveState=true> "Remove diagnostics prop"
				<ul> for student in students
					<li> "{student.name} — {student.email}"

			<article>
				<h2> "Create a student"

				<p> "Form dirty: {form.isDirty}"
				<button type="button" @click=form.reset!> "Reset form"
				<button type="button" @click=form.resetAndClearErrors!> "Reset form + errors"

				<form @submit.prevent=submit>
					<input name="name" bind=form.name placeholder="Name" @blur=form.validate({ only: ['name'] })>
					if form.errors.name
						<p.error> form.errors.name[0]
					<input name="email" bind=form.email type="email" placeholder="Email" @blur=form.validate({ only: ['email'] })>
					if form.errors.email
						<p.error> form.errors.email[0]
					if form.validating
						<p role="status"> "Checking…"
					if form.validationError
						<p.error role="alert"> "Could not check these details. You can still submit the form."
					<button type="submit" disabled=form.processing> form.processing ? 'Saving…' : 'Create student'
