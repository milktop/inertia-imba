import { router } from '@inertiajs/core'
import { createLinkAction } from './link.js'

# A native button keeps caller classes and [] styles on the interactive element.
export tag LinkButton < button
	prop href
	prop method = 'post'
	prop data = {}
	prop confirm
	prop processing = false
	prop replace = false
	prop preserveState = true
	prop preserveScroll = false
	prop only = []
	prop except = []
	prop headers = {}

	action = null
	disabledByUser = false

	# Keep caller intent separate from the temporary disabled state of a request.
	get disabled
		disabledByUser or (action and action.state.processing) or false

	set disabled value
		disabledByUser = !!value
		syncState!

	def syncState
		# Publish an output for bind:processing; internal request state stays authoritative.
		let active = action and action.state.processing or false
		processing = active
		toggleAttribute('disabled', disabled)
		toggleAttribute('data-loading', active)
		imba.commit!

	def mount
		let settings = do
			return {
				href, method, data, confirm
				disabled: disabledByUser
				options: { replace, preserveState, preserveScroll, only, except, headers }
			}
		let changed = do syncState!
		let reportError = do(errors) emit('error', { errors })
		action = createLinkAction(self, settings, router, changed, reportError)
		syncState!

	def unmount
		action.destroy! if action
		action = null
		syncState!

	def follow event
		action.follow(event) if action

	def cancel
		action.cancel! if action

	<self type="button" @click=follow>
		<slot>
