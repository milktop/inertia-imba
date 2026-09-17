import assert from 'node:assert/strict'
import test from 'node:test'
import { headElements, updateHead, unmountHead } from '../src/head.js'

test('head-key uses the Imba property and removes the source attribute', () => {
  let key
  let removed
  const clone = {
    setAttribute: (name, value) => { assert.equal(name, 'data-inertia'); key = value },
    removeAttribute: name => { removed = name },
    get outerHTML() { return `<meta data-inertia="${key}">` },
  }
  const child = { 'headΞkey': 'description', getAttribute: () => null, cloneNode: () => clone }
  assert.deepEqual(headElements({ children: [child] }), ['<meta data-inertia="description">'])
  assert.equal(removed, 'head-key')
})

test('Head batches updates, skips unchanged markup, and disconnects on removal', async () => {
  let updates = 0
  let disconnected = 0
  const host = {
    children: [],
    headProvider: { update: () => updates++, disconnect: () => disconnected++ },
    headObserver: { disconnect: () => disconnected++ },
  }
  updateHead(host)
  updateHead(host)
  await Promise.resolve()
  assert.equal(updates, 1)
  updateHead(host)
  await Promise.resolve()
  assert.equal(updates, 1)
  updateHead(host)
  unmountHead(host)
  await Promise.resolve()
  assert.equal(disconnected, 2)
  assert.equal(updates, 1)
})
