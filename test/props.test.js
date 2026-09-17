import assert from 'node:assert/strict'
import test from 'node:test'
import { applyPageProps } from '../src/props.js'

test('page props are assigned as named component properties', () => {
  const page = {}
  const keys = applyPageProps(page, { students: [{ id: 1 }], query: 'Ada' })

  assert.deepEqual(page.students, [{ id: 1 }])
  assert.equal(page.query, 'Ada')
  assert.deepEqual(keys, ['students', 'query'])
})

test('props omitted by a later response are cleared', () => {
  const page = { students: [{ id: 1 }], query: 'Ada' }
  const keys = applyPageProps(page, { students: [] }, ['students', 'query'])

  assert.deepEqual(page.students, [])
  assert.equal(page.query, undefined)
  assert.deepEqual(keys, ['students'])
})
