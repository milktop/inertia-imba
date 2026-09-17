import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveLayout, updateLayout } from '../src/layout.js'

class Shell {}
class OtherShell {}
class Page {}
const page = { component: 'students/index', props: { user: 'Ada' } }

test('default callback receives the page and per-page declarations override it', () => {
  const fallback = (name, value) => {
    assert.equal(name, page.component)
    assert.equal(value, page)
    return Shell
  }
  assert.equal(resolveLayout({ default: Page }, fallback, page), Shell)
  assert.equal(resolveLayout({ default: Page, layout: OtherShell }, fallback, page), OtherShell)
  for (const layout of [null, false]) {
    assert.equal(resolveLayout({ default: Page, layout }, fallback, page), null)
  }
  assert.equal(resolveLayout(Page, undefined, page), null)
  class CustomPage { static layout = OtherShell }
  assert.equal(resolveLayout(CustomPage, fallback, page), OtherShell)
  assert.deepEqual(resolveLayout({ default: Page, layout: [Shell, OtherShell] }, fallback, page), [Shell, OtherShell])
  assert.deepEqual(resolveLayout(Page, () => [Shell, OtherShell], page), [Shell, OtherShell])
  assert.deepEqual(resolveLayout({ default: Page, layout: [] }, fallback, page), [])
  for (const layout of [[Shell, null], [[Shell]], {}, 'Shell']) {
    assert.throws(() => resolveLayout({ default: Page, layout }, fallback, page), /flat array/)
  }
})

test('layout state survives page replacement while props and child content update', () => {
  const create = Tag => new Tag()
  const firstPage = {}
  const first = updateLayout(null, Shell, { user: 'Ada', old: true }, firstPage, create)
  first.node.sidebarOpen = true
  const nextPage = {}
  const next = updateLayout(first, Shell, { user: 'Grace', pageContent: 'server value' }, nextPage, create)
  assert.equal(next.node, first.node)
  assert.equal(next.node.sidebarOpen, true)
  assert.equal(next.node.user, 'Grace')
  assert.equal(next.node.old, undefined)
  assert.equal(next.node.pageContent, nextPage)
})

test('switching layouts or opting out discards the previous instance', () => {
  const create = Tag => new Tag()
  const first = updateLayout(null, Shell, {}, {}, create)
  const second = updateLayout(first, OtherShell, {}, {}, create)
  assert.notEqual(second.node, first.node)
  const none = updateLayout(second, null, {}, {}, create)
  assert.equal(none, null)
  const returned = updateLayout(none, Shell, {}, {}, create)
  assert.notEqual(returned.node, first.node)
})


test('nested layouts preserve the shared prefix and refresh props at every level', () => {
  const create = Tag => new Tag()
  const firstPage = {}
  const first = updateLayout(null, [Shell, OtherShell], { old: true }, firstPage, create)
  const inner = first.inner
  assert.equal(first.node.pageContent, inner.node)
  assert.equal(inner.node.pageContent, firstPage)
  first.node.clicks = 2
  inner.node.sidebarOpen = false
  const nextPage = {}
  const next = updateLayout(first, [Shell, OtherShell], { user: 'Grace', pageContent: 'untrusted' }, nextPage, create)
  assert.equal(next, first)
  assert.equal(next.inner, inner)
  assert.equal(next.node.clicks, 2)
  assert.equal(next.inner.node.sidebarOpen, false)
  for (const state of [next, next.inner]) {
    assert.equal(state.node.old, undefined)
    assert.equal(state.node.user, 'Grace')
  }
  assert.equal(next.node.pageContent, inner.node)
  assert.equal(inner.node.pageContent, nextPage)
})

test('removing, appending, replacing, and reordering layouts preserve only shared ancestors', () => {
  const create = Tag => new Tag()
  class Section {}
  let state = updateLayout(null, [Shell, OtherShell], {}, {}, create)
  const outer = state.node
  const inner = state.inner.node
  state = updateLayout(state, [Shell, Section], {}, {}, create)
  assert.equal(state.node, outer)
  assert.notEqual(state.inner.node, inner)
  state = updateLayout(state, Shell, {}, {}, create)
  assert.equal(state.node, outer)
  assert.equal(state.inner, null)
  state = updateLayout(state, [Shell, OtherShell], {}, {}, create)
  assert.notEqual(state.inner.node, inner)
  const before = state
  state = updateLayout(state, [OtherShell, Shell], {}, {}, create)
  assert.notEqual(state.node, before.inner.node)
  assert.notEqual(state.inner.node, before.node)
  const parentChanged = updateLayout(state, [Section, Shell], {}, {}, create)
  assert.notEqual(parentChanged.inner.node, state.inner.node)
  assert.equal(updateLayout(parentChanged, [], {}, {}, create), null)
})
