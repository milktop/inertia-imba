import {
	exposeInterceptors,
	getInitialPageFromDOM,
	router,
	setupProgress
} from '@inertiajs/core'
import { mount } from 'imba'
import { InertiaApp } from './App.imba'
import { setupHead } from './head.js'
import { setRoutes } from './routes.js'

export default def createInertiaApp(options = {})
	let id = options.id or 'app'
	let resolve = options.resolve
	let setup = options.setup
	let defaultLayout = options.layout
	let progress = options.progress === undefined ? {} : options.progress
	let initialPage = options.page
	setRoutes(options.routes) if options.routes
	let dev = options.dev === undefined ? import.meta.env && import.meta.env.DEV : options.dev

	if typeof window == 'undefined'
		throw new Error('@milktop/inertia-imba does not support SSR yet')

	exposeInterceptors! if dev
	let el = document.getElementById(id)
	throw new Error("Missing Inertia root element: {id}") unless el
	# Inertia 3 reads JSON script elements; inertia_rails also supports data-page.
	initialPage ||= getInitialPageFromDOM(id) or JSON.parse(el.getAttribute('data-page') or 'null')
	throw new Error("Missing initial Inertia page: {id}") unless initialPage
	let resolveComponent = do(name, currentPage)
		Promise.resolve(resolve(name, currentPage))
	let initialComponent = await resolveComponent(initialPage.component, initialPage)
	await router.decryptHistory!.catch(do nil)
	setupHead(options.title)
	let props = { initialPage, initialComponent, resolveComponent, defaultLayout }

	if setup
		await setup({ el, App: InertiaApp, props })
	else
		let app = <InertiaApp initialPage=initialPage initialComponent=initialComponent resolveComponent=resolveComponent defaultLayout=defaultLayout>
		mount(app, el)

	setupProgress(progress) if progress
