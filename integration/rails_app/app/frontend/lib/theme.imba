# Theme choice is 'system', 'light' or 'dark'. The resolved theme is applied as
# a `dark` class on <html>, which the colour variables in styles/style.imba key off.
# The inline script in application.html.erb applies it before first paint.
const KEY = 'theme'
const media = window.matchMedia('(prefers-color-scheme: dark)')

def read
	try
		return window.localStorage.getItem(KEY) or 'system'
	catch
		return 'system'

class Theme
	choice = read!

	get dark?
		choice == 'dark' or (choice == 'system' and media.matches)

	def set value
		choice = value
		try window.localStorage.setItem(KEY, value)
		apply!

	def apply
		document.documentElement.classList.toggle('dark', dark?)
		imba.commit!

export const theme = new Theme

media.addEventListener('change', do theme.apply!)
theme.apply!

export tag theme-toggle
	<self>
		<select aria-label="Theme" bind=theme.choice @change=theme.set(theme.choice)>
			<option value="system"> "System"
			<option value="light"> "Light"
			<option value="dark"> "Dark"
