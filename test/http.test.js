import assert from 'node:assert/strict'
import test from 'node:test'
import { http, HttpCancelledError, HttpNetworkError, HttpResponseError, router } from '@inertiajs/core'
import { useHttp, requestHeaders } from '../src/http.js'

const response = (status, data) => ({ status, data: data === undefined ? '' : JSON.stringify(data), headers: {} })
function client(t, request) { t.mock.method(http, 'getClient', () => ({ request })) }

test('GET serializes data without navigating, returns JSON, and updates reactive state', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  t.mock.method(router, 'visit', () => assert.fail('HTTP must not navigate'))
  let config
  client(t, async value => { config = value; return response(200, { found: 3 }) })
  const request = useHttp({ query: 'Ada' })
  let finished = 0
  const result = await request.get('/lookup', {
    onStart: () => assert.equal(request.processing, true),
    onSuccess: (data, raw) => { assert.equal(data.found, 3); assert.equal(raw.status, 200) },
    onFinish: () => finished++,
  })
  assert.equal(config.url, '/lookup?query=Ada')
  assert.equal(config.data, undefined)
  assert.equal(config.headers['X-Inertia'], undefined)
  assert.deepEqual(result, { found: 3 })
  assert.equal(request.response, result)
  assert.equal(request.processing, false)
  assert.equal(request.wasSuccessful, true)
  assert.equal(finished, 1)
  t.mock.timers.tick(2000)
  assert.equal(request.recentlySuccessful, false)
})

test('422 validation resolves undefined, simplifies errors, and clears on a successful retry', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let valid = false
  client(t, async config => {
    assert.equal(config.headers['Content-Type'], 'application/json')
    if (!valid) throw new HttpResponseError('validation', response(422, { errors: { name: ['Required', 'Too short'] } }))
    assert.deepEqual(JSON.parse(config.data), { name: 'Ada' })
    return response(201, { id: 1 })
  })
  const request = useHttp({ name: '' })
  assert.equal(await request.post('/lookup'), undefined)
  assert.equal(request.errors.name, 'Required')
  assert.equal(request.hasErrors, true)
  request.withAllErrors()
  await request.post('/lookup')
  assert.deepEqual(request.errors.name, ['Required', 'Too short'])
  request.name = 'Ada'
  valid = true
  await request.post('/lookup')
  assert.deepEqual(request.errors, {})
  assert.equal(request.hasErrors, false)
  request.name = 'changed'
  request.reset()
  assert.equal(request.name, 'Ada')
})

test('prebound endpoints, transforms, empty responses and all verbs work', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const configs = []
  client(t, async config => { configs.push(config); return response(204) })
  const request = useHttp('post', '/lookup', { name: 'Ada' }).transform(data => ({ ...data, checked: true }))
  assert.equal(await request.submit(), null)
  for (const method of ['put', 'patch', 'delete']) await request[method]('/lookup')
  assert.deepEqual(configs.map(c => c.method), ['post', 'put', 'patch', 'delete'])
  assert.deepEqual(JSON.parse(configs[0].data), { name: 'Ada', checked: true })
})

test('cancellation and duplicate submissions do not corrupt request state', async t => {
  let signal
  client(t, config => {
    signal = config.signal
    return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new HttpCancelledError('cancelled'))))
  })
  const request = useHttp()
  let cancelled = 0
  let finished = 0
  const pending = request.get('/lookup', { onCancel: () => cancelled++, onFinish: () => finished++ })
  await assert.rejects(request.get('/other'), /pending request/)
  assert.equal(request.processing, true)
  request.cancel()
  await assert.rejects(pending, HttpCancelledError)
  assert.equal(signal.aborted, true)
  assert.equal(request.processing, false)
  assert.equal(cancelled, 1)
  assert.equal(finished, 1)
  await assert.rejects(request.get('/lookup', { onBefore: () => false }), HttpCancelledError)
  assert.equal(request.processing, false)
})

test('HTTP/network failures reject and callback or transform failures still clean up', async t => {
  const request = useHttp()
  let exceptions = 0
  let networks = 0
  client(t, async () => response(500, { error: 'failed' }))
  await assert.rejects(request.get('/lookup', { onHttpException: () => exceptions++ }), HttpResponseError)
  assert.equal(exceptions, 1)
  client(t, async () => { throw new HttpNetworkError('offline') })
  await assert.rejects(request.get('/lookup', { onNetworkError: () => networks++ }), HttpNetworkError)
  assert.equal(networks, 1)
  request.transform(() => { throw new Error('bad transform') })
  let finished = false
  await assert.rejects(request.post('/lookup', { onFinish: () => { finished = true } }), /bad transform/)
  assert.equal(finished, true)
  assert.equal(request.processing, false)
})

test('multipart requests forward progress without a JSON content type', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  client(t, async config => {
    assert.ok(config.data instanceof FormData)
    assert.equal(config.headers['Content-Type'], undefined)
    config.onUploadProgress({ percentage: 50, loaded: 1, total: 2 })
    return response(200, {})
  })
  const request = useHttp({ file: null })
  request.file = new File(['hello'], 'hello.txt')
  let percentage
  await request.post('/upload', { onProgress: progress => { percentage = progress.percentage; assert.equal(request.progress, progress) } })
  assert.equal(percentage, 50)
  assert.equal(request.progress, null)
})

test('Rails CSRF meta header is same-origin only, with case-insensitive overrides', () => {
  const document = { baseURI: 'https://app.test/', location: { href: 'https://app.test/' }, querySelector: () => ({ content: 'token' }) }
  assert.equal(requestHeaders('/lookup', true, {}, document)['X-CSRF-Token'], 'token')
  assert.equal(requestHeaders('https://other.test/lookup', true, {}, document)['X-CSRF-Token'], undefined)
  const headers = requestHeaders('/lookup', true, { 'x-csrf-token': 'explicit' }, document)
  assert.equal(headers['X-CSRF-Token'], undefined)
  assert.equal(headers['x-csrf-token'], 'explicit')
})

test('success callback errors are not network errors and explicit defaults are respected', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  client(t, async () => response(200, { ok: true }))
  const request = useHttp({ name: 'Ada' })
  let networkErrors = 0
  await assert.rejects(request.post('/lookup', {
    onSuccess: () => { throw new Error('callback failed') },
    onNetworkError: () => networkErrors++,
  }), /callback failed/)
  assert.equal(networkErrors, 0)
  assert.equal(request.processing, false)
  await request.post('/lookup', { onSuccess: () => request.defaults({ name: 'Grace' }) })
  request.reset()
  assert.equal(request.name, 'Grace')
})

test('new requests clear old success timers and malformed JSON still finishes', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  client(t, async () => response(200, {}))
  const request = useHttp()
  await request.get('/lookup')
  t.mock.timers.tick(1500)
  await request.get('/lookup')
  t.mock.timers.tick(500)
  assert.equal(request.recentlySuccessful, true)
  t.mock.timers.tick(1500)
  assert.equal(request.recentlySuccessful, false)
  client(t, async () => ({ status: 200, data: '<html>not JSON</html>', headers: {} }))
  await assert.rejects(request.get('/lookup'), SyntaxError)
  assert.equal(request.processing, false)
  assert.equal(request.wasSuccessful, false)
  assert.equal(request.response, null)
})
