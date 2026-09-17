import assert from 'node:assert/strict'
import test from 'node:test'
import { router } from '@inertiajs/core'
import { useForm } from '../src/form.js'
import { useHttp } from '../src/http.js'
import { useRemember } from '../src/remember.js'
import { setPage } from '../src/page.js'

function history(t) {
  const saved = new Map()
  t.mock.method(router, 'remember', (data, key) => saved.set(key, structuredClone(data)))
  t.mock.method(router, 'restore', key => saved.get(key))
  setPage({ component: 'Students', props: {} })
  return saved
}

test('keyed forms restore nested drafts and errors; reset retains original defaults', async t => {
  const saved = history(t)
  const form = useForm('Students/Create', { student: { name: '' }, tags: [] })
  form.student.name = 'Draft'
  form.tags.push('math')
  form.setError('student.name', 'Taken')
  await Promise.resolve()
  assert.equal(saved.get('Students/Create').data.student.name, 'Draft')
  const restored = useForm('Students/Create', { student: { name: '' }, tags: [] })
  assert.equal(restored.student.name, 'Draft')
  assert.equal(restored.hasErrors, true)
  assert.equal(restored.isDirty, true)
  restored.resetAndClearErrors()
  await Promise.resolve()
  assert.deepEqual(saved.get('Students/Create'), { data: { student: { name: '' }, tags: [] }, errors: {} })
  assert.equal(useForm('Other', { student: { name: '' } }).student.name, '')
})

test('dontRemember omits data and errors; files become null without changing live data', async t => {
  const saved = history(t)
  const file = new Blob(['upload'])
  const form = useForm('Login', { email: '', password: '', attachment: file }).dontRemember('password')
  form.email = 'test@example.test'
  form.password = 'secret'
  form.setError({ password: 'Invalid', email: 'Taken' })
  await Promise.resolve()
  assert.deepEqual(saved.get('Login'), {
    data: { email: 'test@example.test', attachment: null }, errors: { email: 'Taken' },
  })
  assert.equal(form.attachment, file)
  assert.equal(form.password, 'secret')
})

test('removed page callbacks cannot save into a new page; preserved pages can still save', async t => {
  const saved = history(t)
  const form = useForm('Draft', { name: '' })
  form.name = 'Pending'
  setPage({ component: 'About', props: {} })
  await Promise.resolve()
  assert.equal(saved.has('Draft'), false)
  form.name = 'Late'
  await Promise.resolve()
  assert.equal(saved.has('Draft'), false)
  const current = useForm('Current', { name: '' })
  setPage({ component: 'About', props: {} }, true)
  current.name = 'Preserved'
  await Promise.resolve()
  assert.equal(saved.get('Current').data.name, 'Preserved')
})

test('useRemember batches nested assignments, replacements and deletions', async t => {
  const saved = history(t)
  const state = useRemember({ filters: { name: '' }, tags: [] }, 'Filters')
  state.filters.name = 'Ada'
  state.tags.push('math')
  await Promise.resolve()
  assert.deepEqual(useRemember({}, 'Filters'), { filters: { name: 'Ada' }, tags: ['math'] })
  state.filters = { active: true }
  delete state.filters.active
  await Promise.resolve()
  assert.deepEqual(saved.get('Filters'), { filters: {}, tags: ['math'] })
})

test('keyed useHttp restores fields/errors without remembering response or processing', async t => {
  const saved = history(t)
  const request = useHttp('Lookup', { query: '' })
  request.query = 'Ada'
  request.setError('query', 'Try again')
  request.response = { privateResult: true }
  request.processing = true
  await Promise.resolve()
  assert.deepEqual(saved.get('Lookup'), { data: { query: 'Ada' }, errors: { query: 'Try again' } })
  const restored = useHttp('Lookup', { query: '' })
  assert.equal(restored.query, 'Ada')
  assert.equal(restored.hasErrors, true)
  assert.equal(restored.response, null)
  assert.equal(restored.processing, false)
  await Promise.resolve()
})
