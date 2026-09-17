import assert from 'node:assert/strict'
import test from 'node:test'
import { router } from '@inertiajs/core'
import { useForm } from '../src/form.js'
import { File } from 'node:buffer'

test('dirty tracking includes nested edits and defaults merge without dropping fields', () => {
  const form = useForm({ student: { name: 'Ada' }, tags: ['math'], active: true })
  assert.equal(form.isDirty, false)
  form.student.name = 'Grace'
  assert.equal(form.isDirty, true)
  form.reset('student')
  assert.equal(form.isDirty, false)
  form.tags.push('code')
  assert.equal(form.isDirty, true)
  form.defaults()
  assert.equal(form.isDirty, false)
  form.defaults('active', false)
  form.defaults({ student: { name: 'Grace' } })
  form.reset()
  assert.deepEqual(form.data(), { student: { name: 'Grace' }, tags: ['math', 'code'], active: false })
  assert.equal(form.isDirty, false)
})

test('resetAndClearErrors can target fields without clearing other edits or errors', () => {
  const form = useForm({ name: '', email: '' })
  form.name = 'Ada'
  form.email = 'invalid'
  form.setError({ name: 'Taken', email: 'Invalid' })
  assert.equal(form.resetAndClearErrors('name'), form)
  assert.equal(form.name, '')
  assert.equal(form.email, 'invalid')
  assert.deepEqual(form.errors, { email: 'Invalid' })
  assert.equal(form.hasErrors, true)
  form.resetAndClearErrors()
  assert.equal(form.hasErrors, false)
  assert.equal(form.isDirty, false)
})

test('success awaits callbacks and respects explicitly changed defaults', async t => {
  let options
  t.mock.method(router, 'post', (_url, _data, value) => { options = value })
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const form = useForm({ name: '' })
  form.name = 'Ada'
  form.post('/students', { onSuccess: async () => { await Promise.resolve(); form.name = 'Grace' } })
  await options.onSuccess({})
  assert.equal(form.isDirty, false)
  form.name = 'Other'
  form.reset()
  assert.equal(form.name, 'Grace')
  form.post('/students', { onSuccess: async () => { form.defaults('name', 'Explicit') } })
  await options.onSuccess({})
  assert.equal(form.isDirty, true)
  form.reset()
  assert.equal(form.name, 'Explicit')
})

test('cancel uses the visit token, forwards callbacks, and releases it on finish', t => {
  let options
  t.mock.method(router, 'post', (_url, _data, value) => { options = value })
  const form = useForm({ name: '' })
  let cancelled = 0
  let forwarded = 0
  const token = { cancel: () => { cancelled++; options.onCancel(); options.onFinish({}) } }
  form.cancel()
  form.post('/students', {
    onCancelToken: value => assert.equal(value, token),
    onCancel: () => forwarded++,
  })
  options.onCancelToken(token)
  options.onStart({})
  options.onProgress({ percentage: 50 })
  form.cancel()
  assert.equal(cancelled, 1)
  assert.equal(forwarded, 1)
  assert.equal(form.processing, false)
  assert.equal(form.progress, null)
  form.cancel()
  assert.equal(cancelled, 1)
})

test('files retain metadata through defaults, reset and submission', t => {
  const file = new File(['original'], 'student.txt', { type: 'text/plain' })
  const form = useForm({ attachments: [file] })
  assert.equal(form.isDirty, false)
  assert.equal(form.attachments[0], file)
  form.attachments[0] = new File(['changed!'], 'student.txt', { type: 'text/plain' })
  assert.equal(form.isDirty, true)
  form.reset()
  t.mock.method(router, 'post', (_url, data, options) => {
    assert.equal(data.attachments[0], file)
    assert.equal(data.attachments[0].name, 'student.txt')
    assert.equal(options.forceFormData, true)
    options.onProgress({ percentage: 75 })
  })
  form.post('/students', { forceFormData: true })
  assert.equal(form.progress.percentage, 75)
  assert.equal(form.isDirty, false)
})

test('validation, retry, success, and reset follow the visit lifecycle', async (t) => {
  let visit
  t.mock.method(router, 'post', (url, data, options) => { visit = { url, data, options } })
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const form = useForm({ student: { name: '', email: '' } })
  form.student.name = 'Ada'
  let starts = 0
  form.post('/students', { onStart: () => { starts++ } })
  assert.equal(form.processing, false)
  visit.options.onStart({})
  assert.equal(form.processing, true)
  assert.equal(starts, 1)
  assert.deepEqual(visit.data, { student: { name: 'Ada', email: '' } })
  visit.options.onError({ email: ["can't be blank"] })
  visit.options.onFinish({})
  assert.equal(form.hasErrors, true)
  assert.equal(form.processing, false)
  assert.equal(form.student.name, 'Ada')

  form.student.email = 'ada@example.test'
  form.post('/students', { onSuccess: () => form.reset() })
  visit.options.onStart({})
  await visit.options.onSuccess({ props: { errors: {} } })
  visit.options.onFinish({})
  assert.deepEqual(form.errors, {})
  assert.equal(form.hasErrors, false)
  assert.equal(form.processing, false)
  assert.equal(form.wasSuccessful, true)
  assert.equal(form.recentlySuccessful, true)
  assert.deepEqual(form.data(), { student: { name: '', email: '' } })
  t.mock.timers.tick(2000)
  assert.equal(form.recentlySuccessful, false)
})

test('a cancelled onBefore does not leave the form processing', (t) => {
  t.mock.method(router, 'post', (_url, _data, options) => {
    assert.equal(options.onBefore({}), false)
  })
  const form = useForm({ name: '' })
  form.post('/students', { onBefore: () => false })
  assert.equal(form.processing, false)
})

test('a prior success timer cannot clear the next success early', async (t) => {
  let options
  t.mock.method(router, 'post', (_url, _data, value) => { options = value })
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const form = useForm({ name: '' })
  form.post('/students')
  options.onStart({})
  await options.onSuccess({})
  options.onFinish({})
  t.mock.timers.tick(1500)
  form.post('/students')
  options.onStart({})
  assert.equal(form.recentlySuccessful, false)
  await options.onSuccess({})
  t.mock.timers.tick(500)
  assert.equal(form.recentlySuccessful, true)
  t.mock.timers.tick(1500)
  assert.equal(form.recentlySuccessful, false)
})
