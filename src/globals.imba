import { Link } from './Link.imba'
import { LinkButton } from './LinkButton.imba'
import { Head } from './Head.imba'
import { route as resolveRoute } from './routes.js'

# Opt-in globals. Import '@milktop/inertia-imba/globals' once, e.g. in
# inertia.imba, to use these in any page or component without importing.
tag inertia-link < Link
tag inertia-button < LinkButton
tag inertia-head < Head

# route('tasks.show', task.id) in any tag. Link and LinkButton keep their own
# route prop, which takes precedence on those tags.
extend tag element
	def route name, params
		resolveRoute(name, params)
