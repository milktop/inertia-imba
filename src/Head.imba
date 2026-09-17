import { mountHead, updateHead, unmountHead } from './head.js'

export tag Head
	prop title

	def mount
		mountHead(self)

	def unmount
		unmountHead(self)

	def render
		updateHead(self)
		<self hidden=true>
			<slot>
