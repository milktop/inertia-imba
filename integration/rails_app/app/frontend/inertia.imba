import AuthenticatedLayout from './layouts/authenticated.imba'
import { createInertiaApp } from '@inertiajs/imba'
import './styles/style.imba'

let pages = import.meta.glob('./pages/**/*.imba', { eager: true })

createInertiaApp({
	layout: do(name, page)
		AuthenticatedLayout
	resolve: do(name)
		let page = pages["./pages/{name}.imba"]
		throw new Error("Unknown Inertia page: {name}") unless page
		page
	progress: { color: '#7c3aed' }
})
