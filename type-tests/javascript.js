// @ts-check
import { useForm, useHttp } from '@milktop/inertia-imba'

const form = useForm({ name: '', file: /** @type {File | null} */ (null) })
form.name = 'Ada'
form.file = new File(['notes'], 'notes.txt')
form.withPrecognition('post', '/students').validate({ only: ['name'] })
// @ts-expect-error field names are checked in JavaScript too
form.reset('typo')
// @ts-expect-error keep data types when using JavaScript
form.name = 10

/** @type {import('@milktop/inertia-imba').HttpForm<{ name: string }, { message: string }>} */
const preview = useHttp({ name: '' })
preview.post('/preview', { onSuccess: result => { result?.message.toUpperCase() } })
