import { styles } from 'imba'
import { InertiaApp } from '../../src/App.imba'
import { Link } from '../../src/Link.imba'
import { Head } from '../../src/Head.imba'
import { useForm } from '../../src/form.js'

# No page/layout-specific hydration hooks: use the existing adapter normally.
export tag ProbePage
	prop name
	clicks = 0
	form = useForm('SSR/Probe', {name: ''})

	def setup
		form.name = name
		form.defaults!

	def mount
		globalThis.probePageMounts = (globalThis.probePageMounts or 0) + 1

	def render
		<self data-probe="page">
			<Head title="Hello {name}">
			<h1 [c:blue6]> "Hello {name}"
			<button type="button" @click=clicks++> "Clicks: {clicks}"
			<label>
				"Name"
				<input name="name" bind=form.name>
			<p data-probe="draft"> "Draft: {form.name}"
			<Link href="/teachers" preserveState=false> "Teachers"

export tag ProbeLayout
	prop pageContent
	clicks = 0

	def mount
		globalThis.probeLayoutMounts = (globalThis.probeLayoutMounts or 0) + 1

	def render
		<self data-probe="layout">
			<header> "SSR adapter prototype"
			<button type="button" @click=clicks++> "Layout clicks: {clicks}"
			<main><{pageContent}>

export tag ProbeSection
	prop pageContent
	clicks = 0

	def render
		<self data-probe="section">
			<button type="button" @click=clicks++> "Section clicks: {clicks}"
			<{pageContent}>

# Experimental boundary: the root keeps server HTML until Imba starts it,
# then creates a fresh adapter tree. This is deliberately NOT DOM hydration.
export tag ProbeHost
	prop initialPage

	def dehydrate
		setAttribute('data-page', JSON.stringify(initialPage))

	def hydrate
		initialPage = JSON.parse(getAttribute('data-page'))
		super()

	def render
		let resolve = do(name) ProbePage
		let layouts = do(name,page) [ProbeLayout, ProbeSection]
		<self data-probe="host">
			<InertiaApp initialPage=initialPage initialComponent=ProbePage resolveComponent=resolve defaultLayout=layouts>

export def render name
	let page = {component: 'Probe', props: {name}, url: '/students', version: null, clearHistory: false, encryptHistory: false}
	String(<ProbeHost initialPage=page>)

export def renderCss
	String(styles)
