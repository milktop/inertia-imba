import { router } from '@inertiajs/core'
import { followLink, createLinkPrefetch, isCurrentLink } from './link.js'
import { getPage } from './page.js'

# An imported tag backed by a real anchor; normal attributes and child content
# stay native, including href, target, download, title, and accessibility labels.
export tag Link < a
	prop replace = false
	prop preserveState = false
	prop preserveScroll = false
	prop only = []
	prop except = []
	prop headers = {}
	prop prefetch = false
	prop cacheFor = 30000
	prop cacheTags = []

	def visitOptions
		return {
			replace
			preserveState
			preserveScroll
			only
			except
			headers
		}

	def mount
		let options = do visitOptions!
		let config = do
			return { prefetch, cacheFor, cacheTags }
		prefetcher = createLinkPrefetch(self, options, config, router)

	def unmount
		prefetcher.cancel! if prefetcher

	def warm
		prefetcher.schedule! if prefetcher

	def cool
		prefetcher.cancel! if prefetcher

	get current
		isCurrentLink(getAttribute('href'), getPage!..url, document.baseURI)

	def follow event
		cool!
		followLink(event, self, visitOptions!, router)

	# Marks links to the current page; style with [aria-current=page]. Set
	# directly: a bound attribute is written as "null"/"undefined" once cleared.
	def rendered
		if current
			setAttribute('aria-current', 'page')
		else
			removeAttribute('aria-current')

	<self @click=follow @mouseenter=warm @mouseleave=cool @focus=warm @blur=cool>

		<slot>
