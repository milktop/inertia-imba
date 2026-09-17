import { Link, useHttp } from '@inertiajs/imba'

export default tag AboutPage
	prop adapter_version

	count = 0

	preview = useHttp({ name: '' })
	requestFailure = ''
	hopeful = useHttp({ name: 'Ada' })

	def submitPreview
		requestFailure = ''
		try
			await preview.post('/http-preview')
		catch error
			requestFailure = 'Unable to load the preview. Please try again.'
			imba.commit!

	def optimisticPreview fail = false
		try
			await hopeful.optimistic(do(data) { name: fail ? '' : "{data.name}!" }).post('/http-preview')
		catch error
			requestFailure = 'Unable to load the preview. Please try again.'
			imba.commit!

	def unmount
		hopeful.cancel!
		preview.cancel!

	<self.about-page>

		<article>
			<h1> "About this fixture"
			<p> "Adapter version {adapter_version}"
			<p> "Navigating here swaps the page class and keeps the shared layout mounted."
			<Link href="/forms"> "Nested form helpers"
			<Link href="/loading"> "Loading examples"
			<Link href="/uploads"> "File uploads"
			<Link href="/action_examples"> "Action buttons"
			<button @click=count++> "Click"

		<article>
			<h2> "HTTP preview"
			<p> "Get a JSON response without leaving this page."
			<form @submit.prevent=submitPreview>
				<input bind=preview.name placeholder="Preview name" aria-label="Preview name">
				if preview.errors.name
					<p.error> preview.errors.name
				<button type="submit" disabled=preview.processing> preview.processing ? 'Loading…' : 'Preview greeting'
			if preview.response
				<p role="status"> preview.response.message
			if requestFailure
				<p.error> requestFailure

		<article>
			<h2> "Optimistic HTTP updates"
			<p> "The name changes immediately. A rejected update restores its previous value."
			<label>
				"Optimistic preview name"
				<input bind=hopeful.name>
			<p data-testid="optimistic-name"> hopeful.name or '(blank)'
			<button type="button" disabled=hopeful.processing @click=optimisticPreview(false)> "Try successful update"
			<button type="button" disabled=hopeful.processing @click=optimisticPreview(true)> "Try rejected update"
			if hopeful.errors.name
				<p role="alert"> hopeful.errors.name
			if hopeful.response
				<p> hopeful.response.message
