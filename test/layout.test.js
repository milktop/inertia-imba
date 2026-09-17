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
  assert.throws(() => resolveLayout({ default: Page, layout: [Shell] }, fallback, page), /nested layouts/)
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
