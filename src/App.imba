import { router } from '@inertiajs/core'
import { createComponent } from 'imba'
import { setPage } from './page.js'
import { applyPageProps } from './props.js'
import { resolveLayout, updateLayout } from './layout.js'

export tag InertiaApp
	prop initialPage
	prop initialComponent
	prop resolveComponent
	prop defaultLayout

	component = null
	page = null
	pageNode = null
	previousPropKeys = []
	layoutState = null
	rootNode = null

	def setup
		updatePage(initialComponent, initialPage, false)

	def updatePage nextComponent, nextPage, preserveState
		let Page = nextComponent.default or nextComponent
		setPage(nextPage, preserveState and component == Page)
		# A new node resets local state even when the page class stays the same.
		if !preserveState or component != Page
			pageNode = createComponent(Page, null, null, null, null)
			previousPropKeys = []

		component = Page
		page = nextPage
		# Assign before Imba's visit/render lifecycle, including the first render.
		previousPropKeys = applyPageProps(pageNode, page.props, previousPropKeys)

		# Layout identity is independent of page preserveState.
		let Layout = resolveLayout(nextComponent, defaultLayout, page)
		layoutState = updateLayout(layoutState, Layout, page.props, pageNode, do(Tag)
			createComponent(Tag, null, null, null, null)
		)
		rootNode = layoutState ? layoutState.node : pageNode

	def mount
		router.init({
			initialPage: page
			resolveComponent: resolveComponent
			swapComponent: do(args)
				updatePage(args.component, args.page, args.preserveState)
				imba.commit!
		})

	def render
		<self>
			<div data-inertia-page-host>
				<{rootNode}>
