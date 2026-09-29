import { Head, Link, LinkButton } from '@milktop/inertia-imba'

export default tag ActionExamples
	prop last_action
	prop errors = {}
	locked = true
	updating = false
	actionError = ''

	def showActionError event
		actionError = event.detail.errors.label


	<self.action-examples>
		css .action-button
			border-radius: 9px

		<Head title="Action buttons">
		<h1> "Action buttons"
		<p> "These buttons record an example action in your session. They do not change student records."
		<Link href="/about"> "Back to About"

		<div>
			<LinkButton.action-button href="/action_examples" data={ action_demo: { label: 'Created' } } [bg:yellow5 c:yellow9]> "POST example"
			<LinkButton href="/action_examples/demo" method="patch" data={ action_demo: { label: 'Updated' } }> "PATCH example"
			<LinkButton href="/action_examples/demo" method="delete" data={ action_demo: { label: 'Deleted' } } confirm="Delete this example?"> "DELETE example"
			<LinkButton href="/action_examples" data={ action_demo: { label: '' } }> "Validation example"
			<LinkButton href="/action_examples" data={ action_demo: { label: 'Unlocked' } } disabled=locked> "Locked example"

		<button type="button" @click=(locked = !locked)> locked ? 'Unlock example' : 'Lock example'

		<section>
			<h2> "Bound processing and errors"
			<LinkButton href="/action_examples" data={ action_demo: { label: 'Bound action' } } bind:processing=updating aria-label="Bound action">
				updating ? 'Saving…' : 'Save example'
			<p data-testid="bound-processing"> "Updating: {updating}"
			<LinkButton href="/action_examples" data={ action_demo: { label: '' } } @error=showActionError> "Handled validation example"
			if actionError
				<p data-testid="action-error"> "Button event: {actionError}"

		if errors.label
			<p role="alert"> errors.label
		if last_action
			<p data-testid="last-action"> "{last_action.method}: {last_action.label}"
