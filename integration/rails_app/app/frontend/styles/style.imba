import 'imba/preflight.css'

global css
	html
		$bg:white $surface:gray1 $text:gray9 $muted:gray6 $border:gray3 $accent:violet6
		color-scheme:light
	html.dark
		$bg:gray9 $surface:gray8 $text:gray1 $muted:gray4 $border:gray7 $accent:violet4
		color-scheme:dark
	body bg:$bg c:$text
	a c:$accent
	.page-title fs:lg fw:bold
