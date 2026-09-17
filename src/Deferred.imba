import { deferredState } from './loading.js'
import { onPageChange } from './page.js'

export tag Deferred
	prop data
	prop content

	def mount
		unsubscribe = onPageChange(do imba.commit!)

	def unmount
		unsubscribe! if unsubscribe

	def render
		let state = deferredState(data)
		<self aria-busy=(!state.ready and !state.rescued)>
			if state.rescued
				<slot name="rescue"> "Unable to load this content."
			elif state.ready
				if content
					<{content(state.props)}>
				else
					<slot>
			else
				<slot name="fallback"> "Loading…"
