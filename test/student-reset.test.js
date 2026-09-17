import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { compile } from 'imba/compiler'
import { useForm } from '../src/form.js'

test('Students reset buttons discard the click event instead of treating it as a field', () => {
  const sourcePath = 'integration/rails_app/app/frontend/pages/students/index.imba'
  const { js } = compile(readFileSync(sourcePath, 'utf8'), { sourcePath })
  const handlers = [...js.matchAll(/function\(e,\$\$\) \{\s*(return self\.form\.reset(?:AndClearErrors)?\(\);)\s*\}/g)]
  assert.equal(handlers.length, 2)

  for (const [, body] of handlers) {
    const form = useForm({ student: { name: '', email: '' } })
    form.student.name = 'Ada'
    form.setError('name', 'Taken')
    new Function('self', 'e', body)({ form }, { type: 'click' })
    assert.deepEqual(form.student, { name: '', email: '' })
    assert.equal(form.isDirty, false)
    assert.equal(form.hasErrors, !body.includes('AndClearErrors'))
  }
})
