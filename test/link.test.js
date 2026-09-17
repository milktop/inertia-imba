import assert from 'node:assert/strict'
import test, { after } from 'node:test'
import { followLink, createLinkPrefetch } from '../src/link.js'

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
  const settings = { prefetch: true, cacheFor: '1m', cacheTags: ['students'] }
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
