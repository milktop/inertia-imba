import {
  useForm, useHttp, useRemember, usePoll, getPage, onPageChange,
  createInertiaApp, Link, LinkButton, Head, Deferred, WhenVisible, router, progress,
} from '@inertiajs/imba'
import { useForm as subpathForm } from '@inertiajs/imba/form'
import { useHttp as subpathHttp, requestHeaders } from '@inertiajs/imba/http'
import type { Form, PrecognitiveForm, HttpForm, LinkProps, CreateInertiaAppOptions } from '@inertiajs/imba'

interface Student { name: string; email: string; profile: { age: number }; attachment: File | null }
const data: Student = { name: '', email: '', profile: { age: 20 }, attachment: null }
const form: Form<Student> = useForm('Students/Create', () => data)
form.name = 'Ada'
form.attachment = new File(['notes'], 'notes.txt')
form.defaults('profile', { age: 21 }).reset('profile').clearErrors('profile.age')
form.setError('profile.age', ['Too young']).resetAndClearErrors('name')
form.transform(student => ({ student })).dontRemember('attachment')
const name: string = form.data().name
const dirty: boolean = form.isDirty
const percentage: number | undefined = form.progress?.percentage
const error: string | string[] | undefined = form.errors.email
form.post('/students', { onProgress: event => event?.percentage, onSuccess: page => { void page.props } })
form.submit('post', '/students', { preserveScroll: true })
// @ts-expect-error plain forms require an endpoint at submission
form.submit()
// @ts-expect-error Precognition is opt-in
form.validate('name')
// @ts-expect-error field value types are retained
form.name = 42
// @ts-expect-error defaults preserve field types
form.defaults('name', false)
form.reset('profile.age').defaults('profile.age', 22).defaults({'profile.age': 23})
// @ts-expect-error nested defaults retain the leaf type
form.defaults('profile.age', 'old')
// @ts-expect-error nested map values retain the leaf type
form.defaults({'profile.age': 'old'})
// @ts-expect-error unknown reset field
form.reset('profile.missing')
// @ts-expect-error unknown field
form.clearErrors('missing')
// @ts-expect-error unknown option
form.post('/students', { imaginary: true })

const validation: PrecognitiveForm<Student> = form.withPrecognition('post', '/students')
validation.withAllErrors().touch(['name', 'email']).setValidationTimeout(100).validate({ only: ['name'] })
validation.validate('profile.age', { onPrecognitionSuccess: response => { void response.status } })
validation.validate({ target: { name: 'name' } })
validation.validateFiles().withoutFileValidation().reset().validate('name')
validation.submit({ preserveScroll: true })
validation.submit({ method: 'post', url: '/students' })
validation.cancelValidation()
// @ts-expect-error unknown validation field
validation.validate({ only: ['typo'] })
useForm('post', '/students', data).submit()
useForm(() => 'post', () => '/students', data).validate('name')
useForm({ method: 'post', url: '/students' }, data).submit()
useForm(() => ({ method: 'post', url: '/students' }), data).submit()
subpathForm({ name: '' }).post('/students')

interface Greeting { message: string }
const http: HttpForm<Student, Greeting> = useHttp<Student, Greeting>(data)
const response: Promise<Greeting | null | undefined> = http.post('/preview', {
  onSuccess: (result, raw) => { const message: string | undefined = result?.message; void [message, raw.status] },
})
http.withAllErrors().setError('name', ['Invalid'])
http.submit({ method: 'post', url: '/preview' })
http.withPrecognition('post', '/preview').validate('email').submit()
// @ts-expect-error HTTP options do not support Inertia visits
http.post('/preview', { preserveState: true })
http.post('/preview', { optimistic: data => ({ name: data.name + '!' }) })
http.optimistic(data => ({profile: {age: data.profile.age + 1}})).post('/preview')
// @ts-expect-error optimistic HTTP data retains its types
http.optimistic(() => ({name: 123}))
form.optimistic<{ students: Student[] }>(props => ({students: [...props.students, data]})).post('/students')
// @ts-expect-error no configured endpoint
http.submit()
const boundHttp = useHttp<Student, Greeting>('post', '/preview', data)
boundHttp.submit()
// @ts-expect-error HTTP constructor binds submission only, not validation
boundHttp.validate('name')
subpathHttp({ name: '' }).post('/preview')
requestHeaders('/preview', true, { 'X-Test': 'yes' })

const remembered = useRemember({ query: '', filters: { active: true } }, 'Search')
remembered.filters.active = false
// @ts-expect-error remembers field types
remembered.query = 123
const rememberedFile: null = useRemember({ file: new File([], 'notes.txt') }).file
const page = getPage<{ students: Student[] }>()
const students: Student[] | undefined = page?.props.students
const unsubscribe = onPageChange<{ students: Student[] }>(page => { page.props.students[0]?.email })
unsubscribe()
const poll = usePoll(2000, () => ({ only: ['students'] }), { autoStart: false })
poll.start(); poll.stop(); poll.destroy()

class PageTag {}
const options: CreateInertiaAppOptions = {
  resolve: async () => ({ default: PageTag }),
  layout: () => PageTag,
  progress: { color: '#333' },
  title: title => `${title} — App`,
}
createInertiaApp(options)
// @ts-expect-error SSR is not implemented
createInertiaApp({ ...options, render: () => '' })
createInertiaApp({ ...options, layout: () => [PageTag, PageTag] })
createInertiaApp({ ...options, resolve: () => ({ default: PageTag, layout: [PageTag] as const }) })
// @ts-expect-error layout arrays must be flat tag classes
createInertiaApp({ ...options, layout: () => [PageTag, null] })
const link: LinkProps = { href: '/students', prefetch: 'hover', cacheFor: '1m' }
// @ts-expect-error Links are GET anchors, not form buttons
const postLink: LinkProps = { href: '/students', method: 'post' }
// @ts-expect-error mount prefetch is not implemented
const mountPrefetch: LinkProps = { prefetch: 'mount' }
const deferred = new Deferred()
deferred.data = ['summary']
const visible = new WhenVisible()
visible.buffer = 100
visible.retry()
void [name, dirty, percentage, error, response, students, link, postLink, mountPrefetch, Link, Head, router, progress]

const actionButton = new LinkButton()
actionButton.href = '/students/123'
actionButton.method = 'delete'
actionButton.confirm = 'Delete student?'
actionButton.disabled = true
actionButton.data = { reason: 'duplicate' }
actionButton.cancel()
// @ts-expect-error use Link for GET navigation
actionButton.method = 'get'
// @ts-expect-error actions cannot be prefetched
actionButton.prefetch = true
// @ts-expect-error native confirmation takes a message, not a callback
actionButton.confirm = () => true

// Processing is a bindable output, not a command to start or finish a request.
actionButton.processing = false
const validationEvent = new CustomEvent<import('@inertiajs/imba').LinkButtonErrorDetail>('error', { detail: { errors: { name: ['Required'] } } })
const actionErrors: Record<string, string | string[]> = validationEvent.detail.errors
void actionErrors
