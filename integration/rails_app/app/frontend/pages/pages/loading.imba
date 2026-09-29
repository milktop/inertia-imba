import { Deferred, Head, Link, WhenVisible, usePoll } from '@milktop/inertia-imba'

export default tag LoadingPage
	prop checked_at
	poll = null
	polling = true

	def mount
		poll = usePoll(2000, { only: ['checked_at'] })

	def unmount
		poll.destroy! if poll

	def togglePolling
		polling = !polling
		if polling
			poll.start!
		else
			poll.stop!

	# These callbacks are evaluated only when their requested props exist.
	def summaryContent props
		<p data-testid="summary"> "Students in the database: {props.summary.total}"

	def detailsContent props
		<p data-testid="details"> props.details.message

	<self.loading-page>
		<Head title="Loading data">
		<h1> "Loading data"
		<p> "Examples of deferred data, visibility loading, and polling."
		<Link href="/students"> "Back to Students"

		<section>
			<h2> "Deferred summary"
			<Deferred data="summary" content=summaryContent>
				<p slot="fallback" data-testid="summary-fallback"> "Loading the student summary…"

		<section>
			<h2> "Live status"
			<p>
				<span> "Last checked: "
				<time data-testid="checked-at"> checked_at
			<button type="button" @click=togglePolling> polling ? 'Pause updates' : 'Resume updates'

		<section [min-height:110vh]>
			<h2> "Scroll down"
			<p> "The next section waits until you reach it."

		<section>
			<h2> "Load when visible"
			<WhenVisible data="details" buffer=100 content=detailsContent>
				<p slot="fallback" data-testid="details-fallback"> "Waiting for this section to become visible…"
