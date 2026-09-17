import assert from 'node:assert/strict'
import test from 'node:test'
import { router, http, HttpResponseError, HttpNetworkError, HttpCancelledError } from '@inertiajs/core'
import { useForm } from '../src/form.js'
import { useHttp } from '../src/http.js'

const response = (status, data) => ({status, data: JSON.stringify(data), headers: {}})
const client = (t, request) => t.mock.method(http, 'getClient', () => ({request}))

test('useForm passes page optimism once; inline options override the chained callback', t => {
  const options = []
  t.mock.method(router, 'post', (_url, _data, opts) => options.push(opts))
  const first = props => ({count: props.count + 1})
  const override = () => ({count: 100})
  const form = useForm({name: 'Ada'})
  form.optimistic(first).post('/students')
  form.post('/students')
  form.optimistic(first).post('/students', {optimistic: override})
  form.post('/students')
  assert.deepEqual(options.map(opts => opts.optimistic), [first, undefined, override, undefined])
  assert.deepEqual(form.data(), {name: 'Ada'})
})

test('HTTP optimism updates bound data and transformed payload, then becomes the successful defaults', async t => {
  t.mock.timers.enable({apis: ['setTimeout']})
  let finish
  let payload
  client(t, config => { payload = JSON.parse(config.data); return new Promise(resolve => {finish = resolve}) })
  const form = useHttp({name: 'Ada', count: 1}).transform(data => ({student: data}))
  const pending = form.optimistic(data => ({count: data.count + 1})).post('/preview')
  assert.equal(form.count, 2)
  assert.equal(form.isDirty, true)
  assert.deepEqual(payload, {student: {name: 'Ada', count: 2}})
  finish(response(200, {ok: true}))
  await pending
  assert.equal(form.isDirty, false)
  assert.equal(form.count, 2)
  const next = form.post('/preview')
  assert.equal(form.count, 2)
  finish(response(200, {}))
  await next
})

test('HTTP validation rolls back touched fields before callbacks, preserving other in-flight edits', async t => {
  let fail
  client(t, () => new Promise((_resolve, reject) => {fail = reject}))
  const form = useHttp({student: {name: 'Ada'}, note: 'before'})
  let seen
  const pending = form.post('/preview', {
    optimistic: data => ({student: {...data.student, name: ''}}),
    onError: () => { seen = form.student.name },
  })
  assert.equal(form.student.name, '')
  form.note = 'Edited while pending'
  fail(new HttpResponseError('invalid', response(422, {errors: {'student.name': ['Required']}})))
  assert.equal(await pending, undefined)
  assert.equal(seen, 'Ada')
  assert.equal(form.student.name, 'Ada')
  assert.equal(form.note, 'Edited while pending')
  assert.deepEqual(form.errors, {'student.name': 'Required'})
  assert.equal(form.processing, false)
})

test('HTTP server/network/JSON/transform failures and cancellation restore optimistic fields', async t => {
  const form = useHttp({count: 1})
  const options = {optimistic: data => ({count: data.count + 1})}
  for (const result of [
    () => response(500, {}),
    () => { throw new HttpNetworkError('offline') },
    () => ({status: 200, data: 'not JSON', headers: {}}),
  ]) {
    client(t, async () => result())
    await assert.rejects(form.post('/preview', options))
    assert.equal(form.count, 1)
    assert.equal(form.processing, false)
  }
  form.transform(() => {throw new Error('transform failed')})
  await assert.rejects(form.post('/preview', options), /transform failed/)
  assert.equal(form.count, 1)
  form.transform(data => data)
  client(t, config => new Promise((_resolve, reject) => {
    config.signal.addEventListener('abort', () => reject(new HttpCancelledError('cancelled')))
  }))
  let seen
  const pending = form.post('/preview', {...options, onCancel: () => {seen = form.count}})
  assert.equal(form.count, 2)
  form.cancel()
  await assert.rejects(pending, HttpCancelledError)
  assert.equal(seen, 1)
  assert.equal(form.count, 1)
})

test('HTTP optimistic callbacks cannot mutate live data accidentally or overwrite methods', async t => {
  const form = useHttp({student: {name: 'Ada'}})
  client(t, async () => {throw new Error('must not send')})
  await assert.rejects(form.post('/preview', {optimistic: data => {
    data.student.name = 'changed clone'
    throw new Error('callback failed')
  }}), /callback failed/)
  assert.equal(form.student.name, 'Ada')
  await assert.rejects(form.post('/preview', {optimistic: () => ({student: {name: 'changed'}, reset: true})}), /Unknown optimistic/)
  assert.equal(form.student.name, 'Ada')
  assert.equal(typeof form.reset, 'function')
  assert.equal(form.processing, false)
})

test('HTTP successful callback errors keep confirmed data and explicit defaults are respected', async t => {
  t.mock.timers.enable({apis: ['setTimeout']})
  client(t, async () => response(200, {}))
  const form = useHttp({count: 1})
  await assert.rejects(form.optimistic(() => ({count: 2})).post('/preview', {
    onSuccess: () => {throw new Error('after success')},
  }), /after success/)
  assert.equal(form.count, 2)
  assert.equal(form.wasSuccessful, true)
  await form.optimistic(() => ({count: 3})).post('/preview', {onSuccess: () => form.defaults('count', 9)})
  form.reset()
  assert.equal(form.count, 9)
})
