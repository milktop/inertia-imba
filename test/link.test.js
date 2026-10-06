import assert from 'node:assert/strict'
import test, { after } from 'node:test'
import { followLink, createLinkPrefetch, isCurrentLink, isCurrent, currentPath } from '../src/link.js'
import { setPage } from '../src/page.js'

const originalHTMLElement = globalThis.HTMLElement
globalThis.HTMLElement = class HTMLElement {}
after(() => {
  if (originalHTMLElement === undefined) delete globalThis.HTMLElement
  else globalThis.HTMLElement = originalHTMLElement
})

function click({ href = '/students', attrs = {}, event = {}, baseTarget } = {}, options = {}) {
  const calls = []
  const document = {
    baseURI: 'https://app.test/about',
    location: { href: 'https://app.test/about' },
    querySelector: () => baseTarget ? { target: baseTarget } : null,
  }
  const anchor = {
    tagName: 'A', target: attrs.target || '', ownerDocument: document,
    href: new URL(href || '', document.baseURI).href,
    getAttribute: key => key === 'href' ? href : attrs[key] ?? null,
    hasAttribute: key => key in attrs,
  }
  const e = {
    target: new HTMLElement(), button: 0, defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true }, ...event,
  }
  followLink(e, anchor, options, { visit: (...args) => calls.push(args) })
  return { calls, event: e, anchor }
}

test('ordinary links make GET visits with the requested navigation options', () => {
  const options = { preserveState: true, preserveScroll: true, replace: true, only: ['students'], except: [], headers: { 'X-Test': 'yes' } }
  const result = click({}, options)
  assert.equal(result.event.defaultPrevented, true)
  assert.deepEqual(result.calls, [['https://app.test/students', { ...options, method: 'get' }]])
})

test('prefetch waits for intent, forwards cache options, and cancels on leave/unmount', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const calls = []
  const { anchor } = click()
  const settings = { prefetch: 'prefetch', cacheFor: '1m', cacheTags: ['students'] }
  const prefetch = createLinkPrefetch(anchor, () => ({ only: ['students'] }), () => settings, {
    prefetch: (...args) => calls.push(args),
  })
  prefetch.schedule()
  t.mock.timers.tick(74)
  assert.equal(calls.length, 0)
  prefetch.cancel()
  t.mock.timers.tick(100)
  assert.equal(calls.length, 0)
  prefetch.schedule()
  t.mock.timers.tick(75)
  assert.deepEqual(calls, [['https://app.test/students', { only: ['students'], method: 'get' }, {
    cacheFor: '1m', cacheTags: ['students'],
  }]])
  prefetch.schedule()
  settings.prefetch = false
  t.mock.timers.tick(75)
  assert.equal(calls.length, 1)
})

test('prefetch leaves external URLs, downloads and alternate targets alone', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  for (const input of [{ href: 'https://elsewhere.test' }, { href: '#section' },
    { attrs: { download: '' } }, { attrs: { target: '_blank' } }]) {
    const { anchor } = click(input)
    const prefetch = createLinkPrefetch(anchor, () => ({}), () => ({ prefetch: true }), {
      prefetch: () => assert.fail('must not prefetch native navigation'),
    })
    prefetch.schedule()
    t.mock.timers.tick(100)
  }
})

test('modified clicks, alternate buttons, prevented and editable events stay native', () => {
  for (const event of [
    { ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true },
    { button: 1 }, { button: 2 }, { defaultPrevented: true },
    { target: Object.assign(new HTMLElement(), { isContentEditable: true }) },
  ]) {
    const result = click({ event })
    assert.equal(result.calls.length, 0)
    assert.equal(result.event.defaultPrevented, !!event.defaultPrevented)
  }
})

test('external links, targets, downloads and same-page fragments stay native', () => {
  for (const input of [
    { href: 'https://elsewhere.test/students' }, { href: 'mailto:test@example.test' },
    { href: '#section' }, { href: '/about#section' }, { href: '' }, { href: null },
    { attrs: { target: '_blank' } }, { attrs: { target: 'preview' } },
    { attrs: { download: '' } }, { baseTarget: '_blank' },
  ]) {
    const result = click(input)
    assert.equal(result.calls.length, 0, JSON.stringify(input))
    assert.equal(result.event.defaultPrevented, false)
  }
  assert.equal(click({ attrs: { target: '_self' }, baseTarget: '_blank' }).calls.length, 1)
  assert.equal(click({ href: '/students#section' }).calls.length, 1)
})

test('button actions confirm before submitting, prevent duplicates, and recover on finish', async () => {
  const { createLinkAction } = await import('../src/link.js')
  let accepted = false
  let prompts = 0
  const calls = []
  const { anchor } = click()
  anchor.ownerDocument.defaultView = { confirm: message => { assert.equal(message, 'Delete student?'); prompts++; return accepted } }
  const config = { href: '/students/123', method: 'delete', data: { reason: 'duplicate' }, confirm: 'Delete student?' }
  const action = createLinkAction(anchor, () => config, { visit: (...args) => { calls.push(args); args[1].onCancelToken({ cancel() {} }) } })
  const event = () => ({ preventDefault() {} })
  action.follow(event())
  assert.equal(calls.length, 0)
  assert.equal(action.state.processing, false)
  accepted = true
  action.follow(event())
  action.follow(event())
  assert.equal(prompts, 2)
  assert.equal(calls.length, 1)
  assert.equal(calls[0][1].method, 'delete')
  assert.deepEqual(calls[0][1].data, { reason: 'duplicate' })
  assert.equal(calls[0][1].preserveState, true)
  assert.equal(action.state.processing, true)
  calls[0][1].onFinish()
  assert.equal(action.state.processing, false)
  config.disabled = true
  action.follow(event())
  assert.equal(calls.length, 1)
  action.destroy()
})

test('button actions cancel on removal and reject unsafe destinations without submitting', async () => {
  const { createLinkAction } = await import('../src/link.js')
  const { anchor } = click()
  let options
  let cancelled = 0
  const config = { href: 'https://elsewhere.test', method: 'post' }
  const action = createLinkAction(anchor, () => config, {
    visit: (_url, value) => { options = value; value.onCancelToken({ cancel: () => { cancelled++; value.onFinish() } }) },
  })
  for (const href of ['https://elsewhere.test', 'javascript:alert(1)', '#section', '']) {
    config.href = href
    action.follow({ preventDefault() {} })
    assert.equal(options, undefined)
  }
  config.href = '/students'
  action.follow({ preventDefault() {} })
  action.destroy()
  assert.equal(cancelled, 1)
  assert.equal(action.state.processing, false)
  action.follow({ preventDefault() { assert.fail('disposed') } })
})

test('button actions recover when visits are vetoed or throw before sending', async () => {
  const { createLinkAction } = await import('../src/link.js')
  const { anchor } = click()
  const config = { href: '/students', method: 'patch', options: { preserveState: false } }
  const vetoed = createLinkAction(anchor, () => config, { visit() {} })
  vetoed.follow({ preventDefault() {} })
  assert.equal(vetoed.state.processing, false)
  const broken = createLinkAction(anchor, () => config, { visit() { throw new Error('failed') } })
  assert.throws(() => broken.follow({ preventDefault() {} }), /failed/)
  assert.equal(broken.state.processing, false)
})

test('button validation errors are reported without keeping state, and late errors are ignored', async () => {
  const { createLinkAction } = await import('../src/link.js')
  const { anchor } = click()
  const requests = []
  const errors = []
  const action = createLinkAction(anchor, () => ({ href: '/students' }), {
    visit: (_url, options) => { requests.push(options); options.onCancelToken({ cancel() {} }) },
  }, () => {}, value => errors.push(value))
  action.follow({ preventDefault() {} })
  const failure = { name: ['is required'] }
  requests[0].onError(failure)
  assert.deepEqual(errors, [failure])
  requests[0].onFinish()
  assert.equal(action.state.processing, false)
  action.follow({ preventDefault() {} })
  requests[0].onError({ name: 'stale' })
  assert.equal(errors.length, 1)
  action.destroy()
  requests[1].onError({ name: 'removed' })
  assert.equal(errors.length, 1)
})

test('isCurrentLink matches the current path, ignoring query, hash and trailing slash', () => {
  const base = 'https://app.test/about'
  assert.equal(isCurrentLink('/students', '/students?page=2', base), true)
  assert.equal(isCurrentLink('/students/', '/students#top', base), true)
  assert.equal(isCurrentLink('https://app.test/students', '/students', base), true)
  assert.equal(isCurrentLink('/', '/', base), true)
  assert.equal(isCurrentLink('/students', '/students/1', base), false)
  assert.equal(isCurrentLink('https://other.test/students', '/students', base), false)
  assert.equal(isCurrentLink('#top', '/about', base), false)
  assert.equal(isCurrentLink('/students', null, base), false)
  assert.equal(isCurrentLink(null, '/students', base), false)
})

test('isCurrentLink with prefix also matches pages under href, but / only matches itself', () => {
  const base = 'https://app.test/'
  const prefix = { prefix: true }
  assert.equal(isCurrentLink('/students', '/students/1', base, prefix), true)
  assert.equal(isCurrentLink('/students/', '/students/1/edit?tab=a', base, prefix), true)
  assert.equal(isCurrentLink('/students', '/students', base, prefix), true)
  assert.equal(isCurrentLink('/students', '/students-archive', base, prefix), false)
  assert.equal(isCurrentLink('/', '/students', base, prefix), false)
  assert.equal(isCurrentLink('/', '/', base, prefix), true)
})

test('isCurrent and currentPath read the current page', () => {
  setPage(null)
  assert.equal(currentPath(), null)
  assert.equal(isCurrent('/students'), false)
  setPage({ url: '/students/1/?tab=notes#top' })
  assert.equal(currentPath(), '/students/1')
  assert.equal(isCurrent('/students'), true)
  assert.equal(isCurrent('/students', { exact: true }), false)
  assert.equal(isCurrent('/students/1', { exact: true }), true)
  assert.equal(isCurrent('/'), false)
  setPage({ url: '/' })
  assert.equal(currentPath(), '/')
  assert.equal(isCurrent('/'), true)
  setPage(null)
})
