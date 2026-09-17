import assert from 'node:assert/strict'
import test from 'node:test'
import { getPage, onPageChange, setPage } from '../src/page.js'

test('page state is updated and subscribers are notified', () => {
  const seen = []
  const unsubscribe = onPageChange((page) => seen.push(page))
  const page = { component: 'Students/Index', props: { query: 'Ada' } }

  setPage(page)
  unsubscribe()

  assert.equal(getPage(), page)
  assert.deepEqual(seen, [page])
})

test('shared flash reaches pages, persistent layouts and page readers, then clears', async () => {
  const { applyPageProps } = await import('../src/props.js')
  const { updateLayout } = await import('../src/layout.js')
  class Layout {}
  const node = {}
  const seen = []
  const unsubscribe = onPageChange(page => seen.push(page.props.flash))
  let keys = []
  let layout = null

  try {
    for (const flash of [{ notice: 'Student created' }, { alert: 'Please try again' }, {}]) {
      const page = { component: 'students/index', props: { flash } }
      keys = applyPageProps(node, page.props, keys)
      const previous = layout
      layout = updateLayout(layout, Layout, page.props, node, Tag => new Tag())
      setPage(page)
      assert.deepEqual(node.flash, flash)
      assert.deepEqual(layout.node.flash, flash)
      assert.deepEqual(getPage().props.flash, flash)
      if (previous) assert.equal(layout.node, previous.node)
    }
    assert.deepEqual(seen, [{ notice: 'Student created' }, { alert: 'Please try again' }, {}])
  } finally {
    unsubscribe()
  }
})
