# Deliberately small: isolate Imba's SSR lifecycle before changing the adapter.
export tag SsrProbePage
	prop name
	clicks = 0

	def dehydrate
		setAttribute('data-name', name)

	def hydrate
		name = getAttribute('data-name')
		super()

	def render
		<self data-probe="page">
			<h1> "Hello {name}"
			<button type="button" @click=clicks++> "Clicks: {clicks}"

export tag SsrProbeLayout
	prop pageContent

	def hydrate
		pageContent = querySelector('[data-probe=page]')
		super()

	def render
		<self data-probe="layout">
			<header> "SSR prototype"
			<main><{pageContent}>

export def render name
	let page = <SsrProbePage name=name>
	String(<SsrProbeLayout pageContent=page>)
