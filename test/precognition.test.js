import assert from 'node:assert/strict'
import test from 'node:test'
import { http, router, HttpResponseError } from '@inertiajs/core'
import { useForm } from '../src/form.js'
import { useHttp } from '../src/http.js'
import { setPage } from '../src/page.js'

const success = () => ({ status: 204, data: '', headers: { precognition: 'true', 'precognition-success': 'true' } })
const invalid = errors => ({ status: 422, data: JSON.stringify({ errors }), headers: { precognition: 'true' } })
const settle = () => new Promise(resolve => setImmediate(resolve))

test('configured endpoints support submit(), options, overrides and endpoint changes', t => {
  const calls = []
  t.mock.method(router, 'post', (...args) => calls.push(['post', ...args]))
  t.mock.method(router, 'patch', (...args) => calls.push(['patch', ...args]))
  const form = useForm({ name: 'Alice' }).withPrecognition('post', '/students')
  form.submit()
  form.submit({ preserveScroll: true })
  form.submit('patch', '/students/1')
  form.withPrecognition('patch', '/students/2').submit()
  assert.deepEqual(calls.map(([method, url]) => [method, url]), [
    ['post', '/students'], ['post', '/students'], ['patch', '/students/1'], ['patch', '/students/2'],
  ])
  assert.deepEqual(calls[0][2], { name: 'Alice' })
  assert.equal(calls[1][3].preserveScroll, true)
})

test('useForm accepts method and URL at construction, or a URL/method pair', t => {
  const calls = []
  t.mock.method(router, 'post', (...args) => calls.push(args))
  const form = useForm('post', '/students', { name: 'Alice' })
  assert.equal(typeof form.validate, 'function')
  form.submit()
  useForm({ method: 'post', url: '/other' }, () => ({ name: 'Other' })).submit()
  assert.deepEqual(calls.map(([url, data]) => [url, data]), [
    ['/students', { name: 'Alice' }], ['/other', { name: 'Other' }],
  ])
})

function setup(t, handler, create = useForm) {
  setPage({ component: 'Students', props: {} })
  t.mock.timers.enable({ apis: ['setTimeout'] })
  t.mock.method(http, 'getClient', () => ({ request: handler }))
  return create({ name: '', email: '' }).withPrecognition('post', '/students')
}

test('only=name excludes touched email and leaves its existing error untouched', async t => {
  let request
  const form = setup(t, async value => { request = value; return success() })
  form.touch('name', 'email').setError('email', 'Existing error')
  form.validate({ only: ['name'] })
  t.mock.timers.tick(300)
  await settle()
  assert.equal(request.headers['Precognition-Validate-Only'], 'name')
  assert.deepEqual(form.errors, { email: 'Existing error' })
  assert.equal(form.valid('name'), true)
  assert.equal(form.valid('email'), false)
})

test('useHttp submits to the endpoint configured with withPrecognition', async t => {
  const requests = []
  const form = setup(t, async request => {
    requests.push(request)
    return { status: 200, headers: {}, data: '{"ok":true}' }
  }, useHttp)
  assert.deepEqual(await form.submit(), { ok: true })
  assert.equal(requests[0].url, '/students')
  assert.equal(requests[0].method, 'post')
  assert.equal(requests[0].headers.Precognition, undefined)
})

test('debounces touched fields, transforms the body, and separates validation from submission', async t => {
  const requests = []
  const form = setup(t, async request => { requests.push(request); return success() })
  form.transform(data => ({ student: data }))
  form.name = 'Ada'
  form.validate('name')
  t.mock.timers.tick(200)
  form.email = 'ada@example.test'
  form.validate('email')
  t.mock.timers.tick(299)
  assert.equal(requests.length, 0)
  t.mock.timers.tick(1)
  assert.equal(form.validating, true)
  assert.equal(form.processing, false)
  await settle()
  assert.equal(requests.length, 1)
  assert.equal(requests[0].headers.Precognition, 'true')
  assert.equal(requests[0].headers['Precognition-Validate-Only'], 'name,email')
  assert.equal(requests[0].headers['X-Inertia'], undefined)
  assert.deepEqual(JSON.parse(requests[0].data), { student: { name: 'Ada', email: 'ada@example.test' } })
  assert.equal(form.validating, false)
  assert.equal(form.valid('email'), true)
  assert.equal(form.touched('name'), true)
  assert.equal(form.wasSuccessful, false)
  assert.equal(form.isDirty, true)
  form.email = 'changed@example.test'
  assert.equal(form.valid('email'), false)
})

test('422 errors are reactive, preserve unrelated errors, and clear after correction', async t => {
  let rejected = true
  const form = setup(t, async () => {
    if (rejected) throw new HttpResponseError('Validation', invalid({ name: ['Required'] }), '/students')
    return success()
  })
  form.setError('email', 'Unrelated')
  form.validate('name')
  t.mock.timers.tick(300)
  await settle()
  assert.deepEqual(form.errors, { name: 'Required', email: 'Unrelated' })
  assert.equal(form.invalid('name'), true)
  assert.equal(form.validationError, null)
  rejected = false
  form.name = 'Ada'
  form.validate('name')
  t.mock.timers.tick(300)
  await settle()
  assert.deepEqual(form.errors, { email: 'Unrelated' })
  assert.equal(form.valid('name'), true)
  form.resetAndClearErrors()
  assert.equal(form.touched(), false)
  assert.equal(form.valid('name'), false)
})

test('new requests and edits suppress stale responses even if transport ignores abort', async t => {
  const pending = []
  const form = setup(t, request => new Promise(resolve => pending.push({ request, resolve })))
  form.name = 'First'
  form.validate('name')
  t.mock.timers.tick(300)
  form.name = 'Second'
  form.validate('name')
  assert.equal(pending[0].request.signal.aborted, true)
  t.mock.timers.tick(300)
  pending[1].resolve(success())
  await settle()
  pending[0].resolve(invalid({ name: ['Stale'] }))
  await settle()
  assert.deepEqual(form.errors, {})
  assert.equal(form.valid('name'), true)
  form.validate('name')
  t.mock.timers.tick(300)
  form.name = 'Edited without another validation'
  pending[2].resolve(invalid({ name: ['Stale again'] }))
  await settle()
  assert.deepEqual(form.errors, {})
  assert.equal(form.validating, false)
})

test('cancel, reset, submit and page removal invalidate pending validation', async t => {
  const pending = []
  const form = setup(t, request => new Promise(resolve => pending.push({ request, resolve })))
  t.mock.method(router, 'post', () => {})
  for (const action of [() => form.cancel(), () => form.reset(), () => form.post('/students')]) {
    form.validate('name')
    t.mock.timers.tick(300)
    const latest = pending.at(-1)
    action()
    assert.equal(latest.request.signal.aborted, true)
    latest.resolve(invalid({ name: ['Late'] }))
    await settle()
    assert.deepEqual(form.errors, {})
    assert.equal(form.validating, false)
  }
  form.validate('name')
  t.mock.timers.tick(300)
  setPage({ component: 'About', props: {} })
  pending.at(-1).resolve(invalid({ name: ['Removed page'] }))
  await settle()
  assert.deepEqual(form.errors, {})
})

test('useHttp shares opt-in validation and all-error formatting', async t => {
  const form = setup(t, async () => invalid({ email: ['Required', 'Invalid'] }), useHttp).withAllErrors()
  form.validate({ only: ['email'] })
  t.mock.timers.tick(300)
  await settle()
  assert.deepEqual(form.errors.email, ['Required', 'Invalid'])
  assert.equal(form.response, null)
  assert.equal(form.processing, false)
})

test('transport/protocol failures do not become field errors or unhandled rejections', async t => {
  let network = true
  const form = setup(t, async () => {
    if (network) throw new Error('Offline')
    return { status: 200, data: '{}', headers: {} }
  })
  form.validate('name')
  t.mock.timers.tick(300)
  await settle()
  assert.equal(form.validationError.message, 'Offline')
  assert.equal(form.validating, false)
  assert.deepEqual(form.errors, {})
  network = false
  form.validate('name')
  t.mock.timers.tick(300)
  await settle()
  assert.match(form.validationError.message, /Precognition response/)
  assert.equal(form.valid('name'), false)
})

test('files are omitted by default and opt-in file validation uses multipart', async t => {
  const requests = []
  const form = setup(t, async request => { requests.push(request); return success() })
  // Add an upload through the supported defaults API so data() includes it.
  form.defaults({ attachment: null })
  form.attachment = new Blob(['contents'], { type: 'text/plain' })
  form.validate('name')
  t.mock.timers.tick(300)
  await settle()
  assert.deepEqual(JSON.parse(requests[0].data), { name: '', email: '' })
  form.validateFiles().validate({ only: ['attachment'] })
  t.mock.timers.tick(300)
  await settle()
  assert.ok(requests[1].data instanceof FormData)
  assert.equal(await requests[1].data.get('attachment').text(), 'contents')
  assert.equal(requests[1].headers['Content-Type'], undefined)
  assert.equal(form.valid('attachment'), true)
})

test('validation callbacks and named input events work without submitting', async t => {
  const form = setup(t, async () => success()).setValidationTimeout(0)
  const calls = []
  form.validate({ target: { name: 'name' } }, {
    onBefore: () => { calls.push('before') },
    onStart: () => calls.push('start'),
    onPrecognitionSuccess: () => calls.push('success'),
    onFinish: () => calls.push('finish'),
  })
  t.mock.timers.tick(0)
  await settle()
  assert.deepEqual(calls, ['before', 'start', 'success', 'finish'])
  form.validate('name', { onBefore: () => false, onStart: () => assert.fail('cancelled') })
  t.mock.timers.tick(0)
  await settle()
  assert.equal(form.validating, false)
})
