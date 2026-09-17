import { Head, Link } from '@inertiajs/imba'

export default tag AuthenticatedLayout
	prop pageContent
	prop flash = {}

	layoutClicks = 0

	<self.authenticated-layout>
		<Head title="Imba test app">
		<header>
			<strong> "Inertia + Imba"
			<button @click=(layoutClicks++)> "Layout clicks: {layoutClicks}"
			<nav>
				<Link href="/students" prefetch=true> "Students"
				<Link href="/about" prefetch=true> "About"
		<main>
			if flash and flash.notice
				<p.flash-notice role="status"> flash.notice
			if flash and flash.alert
				<p.flash-alert role="alert"> flash.alert
			<{pageContent}>
