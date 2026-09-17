import { observeVisibility } from './loading.js'
import { getPage } from './page.js'

export tag WhenVisible
	prop data
	prop params
	prop buffer = 0
	prop always = false
	prop content

	visibility = null

	def mount
		let options = do
			return { data, params, buffer, always }
		visibility = observeVisibility(self, options, do imba.commit!)

	def unmount
		visibility.destroy! if visibility
		visibility = null

	def retry
		visibility.retry! if visibility

	def render
		<self aria-busy=(visibility and visibility.state.fetching)>
			if visibility and visibility.state.loaded
				if content
					<{content(getPage!.props)}>
				else
					<slot>
			else
				<slot name="fallback"> "Loading when visible…"
