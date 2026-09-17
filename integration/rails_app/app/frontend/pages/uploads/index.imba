import { Head, Link, useForm } from '@inertiajs/imba'

export default tag UploadsPage
	prop receipt

	form = useForm({ title: '', file: null })
	fileInput = null
	cancelled = false

	def setup
		form.transform(do(data) { upload: data })

	def chooseFile event
		fileInput = event.target
		form.file = fileInput.files[0] or null
		form.clearErrors('file')

	def reset
		form.resetAndClearErrors!
		fileInput.value = '' if fileInput
		cancelled = false

	def submit
		cancelled = false
		form.post('/uploads', {
			preserveScroll: true
			onSuccess: do reset!
			onCancel: do
				cancelled = true
				imba.commit!
		})

	def unmount
		form.cancel!

	def errorMessage field
		let error = form.errors[field]
		return Array.isArray(error) ? error[0] : error

	<self.uploads-page>
		<Head title="File uploads">
		<h1> "File uploads"
		<p> "Send a text file up to 2 MB. This example checks the upload and shows its metadata; it does not store the file."
		<Link href="/about"> "Back to About"

		<form @submit.prevent=submit>
			<label for="upload-title"> "Title"
			<input id="upload-title" bind=form.title disabled=form.processing>
			if form.errors.title
				<p.error role="alert"> errorMessage('title')

			<label for="upload-file"> "Text file"
			<input id="upload-file" type="file" accept="text/plain,.txt" @change=chooseFile disabled=form.processing>
			if form.errors.file
				<p.error role="alert"> errorMessage('file')

			if form.progress
				<progress aria-label="Upload progress" max=100 value=form.progress.percentage>
				<p data-testid="upload-progress"> "Uploaded {form.progress.percentage}%"
			if form.processing
				<p> "Sending upload…"
				<button type="button" @click=form.cancel!> "Cancel upload"
			<button type="submit" disabled=form.processing> "Send file"
			<button type="button" disabled=form.processing @click=reset!> "Reset upload"

		if cancelled
			<p role="status"> "Upload cancelled. You can retry."

		if receipt
			<section data-testid="upload-receipt">
				<h2> "Received by Rails"
				<p> receipt.title
				<p> "{receipt.filename} — {receipt.bytes} bytes ({receipt.content_type})"
