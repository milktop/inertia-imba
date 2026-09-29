import { Link } from '@milktop/inertia-imba'

export default tag StudentsLayout
	prop pageContent
	sidebarOpen = true
	sectionNote = ''

	<self.students-layout>
		<section>
			<h2> "Students section"
			<button type="button" @click=(sidebarOpen = !sidebarOpen)> sidebarOpen ? 'Hide student navigation' : 'Show student navigation'
			if sidebarOpen
				<nav aria-label="Student navigation">
					<Link href="/students"> "Student list"
					<Link href="/students/reports"> "Student reports"
			<label>
				<span> "Section note"
				<input aria-label="Section note" bind=sectionNote>
			<p> "This note and navigation toggle persist between student pages. Leaving the section resets them."

		<div>
			<{pageContent}>
