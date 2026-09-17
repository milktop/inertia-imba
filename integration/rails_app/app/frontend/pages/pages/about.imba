import { Link, useHttp } from '@inertiajs/imba'

export default tag AboutPage
	prop adapter_version

	count = 0

	preview = useHttp({ name: '' })
	requestFailure = ''

	def submitPreview
		requestFailure = ''
		try
			await preview.post('/http-preview')
		catch error
			requestFailure = 'Unable to load the preview. Please try again.'
			imba.commit!

	def unmount
		preview.cancel!

	<self.about-page>

		<article>
			<h1> "About this fixture"
			<p> "Adapter version {adapter_version}"
			<p> "Navigating here swaps the page class and keeps the shared layout mounted."
			<Link href="/loading"> "Loading examples"
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
