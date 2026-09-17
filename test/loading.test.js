import assert from 'node:assert/strict'
import test from 'node:test'
import { router } from '@inertiajs/core'
import { deferredState, observeVisibility } from '../src/loading.js'
import { usePoll } from '../src/poll.js'
import { setPage } from '../src/page.js'

test('Deferred waits for every prop, accepts null, and recognizes rescued props', () => {
  assert.equal(deferredState(['a', 'nested.b'], { props: { a: null, nested: { b: 0 } } }).ready, true)
  assert.equal(deferredState(['a', 'b'], { props: { a: 1 } }).ready, false)
  assert.equal(deferredState('a', { props: {}, rescuedProps: ['a'] }).rescued, true)
  for (const data of [undefined, [], '', [1]]) assert.throws(() => deferredState(data), /prop name/)
})

function visibility(options = { data: 'details' }, props = {}) {
  let callback
  let listener
  let observerOptions
  let unobserved = 0
  let disconnected = false
  let unsubscribed = false
  let cancelled = false
  const requests = []
  const page = { props }
  const result = observeVisibility({}, () => options, () => {}, {
    router: { reload: request => { requests.push(request); request.onCancelToken({ cancel: () => { cancelled = true } }) } },
    getPage: () => page,
    onPageChange: fn => { listener = fn; return () => { unsubscribed = true } },
    IntersectionObserver: class {
      constructor(fn, opts) { callback = fn; observerOptions = opts }
      observe() {}
      unobserve() { unobserved++ }
      disconnect() { disconnected = true }
    },
  })
  return {
    result, requests, page,
    enter: () => callback([{ isIntersecting: true }]),
    update: () => listener(),
    status: () => ({ observerOptions, unobserved, disconnected, unsubscribed, cancelled }),
  }
}

test('WhenVisible requests only selected props and loads once without overlapping requests', () => {
  const fixture = visibility({ data: ['details'], buffer: 120, params: { headers: { 'X-Test': 'yes' } } })
  assert.deepEqual(fixture.status().observerOptions, { rootMargin: '120px' })
  assert.equal(fixture.result.state.loaded, false)
  fixture.enter()
  fixture.enter()
  assert.equal(fixture.requests.length, 1)
  assert.deepEqual(fixture.requests[0].only, ['details'])
  assert.equal(fixture.requests[0].preserveErrors, true)
  assert.equal(fixture.requests[0].headers['X-Test'], 'yes')
  fixture.requests[0].onSuccess({ props: { details: null } })
  fixture.requests[0].onFinish({})
  fixture.enter()
  assert.equal(fixture.requests.length, 1)
  assert.equal(fixture.result.state.loaded, true)
  fixture.result.destroy()
  assert.equal(fixture.status().unsubscribed, true)
})

test('WhenVisible skips already loaded props, supports always, and cancels on unmount', () => {
  const ready = visibility({ data: 'details' }, { details: [] })
  ready.enter()
  assert.equal(ready.requests.length, 0)
  ready.result.destroy()
  const repeated = visibility({ data: 'details', always: true })
  repeated.enter()
  repeated.requests[0].onSuccess({ props: { details: [] } })
  repeated.requests[0].onFinish({})
  repeated.enter()
  assert.equal(repeated.requests.length, 2)
  repeated.result.destroy()
  assert.equal(repeated.status().cancelled, true)
  assert.equal(repeated.status().disconnected, true)
  repeated.requests[1].onSuccess({ props: { details: [] } })
  repeated.requests[1].onFinish({})
  repeated.enter()
  assert.equal(repeated.requests.length, 2)
})

test('WhenVisible permits retry after failure or cancellation before the request', () => {
  const fixture = visibility({ data: 'details', params: { onBefore: () => false } })
  fixture.enter()
  assert.equal(fixture.requests[0].onBefore({}), false)
  assert.equal(fixture.result.state.fetching, false)
  fixture.result.retry()
  fixture.requests[1].onFinish({})
  assert.equal(fixture.result.state.loaded, false)
  fixture.result.destroy()
})

test('usePoll delegates options, survives preserved visits, and destroys on page replacement', t => {
  const calls = []
  t.mock.method(router, 'poll', (...args) => {
    calls.push(args)
    return { start: () => calls.push('start'), stop: () => calls.push('stop'), destroy: () => calls.push('destroy') }
  })
  setPage({ component: 'Loading', props: {} })
  const poll = usePoll(2000, { only: ['checked_at'] }, { autoStart: false, keepAlive: true })
  poll.start()
  poll.stop()
  setPage({ component: 'Loading', props: {} }, true)
  assert.equal(calls.includes('destroy'), false)
  setPage({ component: 'Students', props: {} })
  poll.start()
  poll.destroy()
  assert.deepEqual(calls, [
    [2000, { only: ['checked_at'] }, { autoStart: false, keepAlive: true }], 'start', 'stop', 'destroy',
  ])
  assert.throws(() => usePoll(0), /positive/)
})
