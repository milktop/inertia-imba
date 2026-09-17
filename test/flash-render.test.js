import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { compile } from 'imba/compiler'

test('compiled layout flash guards tolerate missing data and recognize messages', () => {
  const sourcePath = 'integration/rails_app/app/frontend/layouts/authenticated.imba'
  const { js } = compile(readFileSync(sourcePath, 'utf8'), { sourcePath })

  // Exercise the actual compiled guards: JS optional chaining syntax in Imba
  // can compile as a different property name instead of a null-safe access.
  for (const key of ['notice', 'alert']) {
    const condition = [...js.matchAll(/if \(([^\n]+)\) \{/g)]
      .map(match => match[1])
      .find(value => value.endsWith(`.${key}`))
    assert.ok(condition, `compiled ${key} condition exists`)
    const visible = new Function(`return Boolean(${condition})`)
    for (const flash of [undefined, null, {}, { [key]: '' }]) {
      assert.equal(visible.call({ flash }), false)
    }
    assert.equal(visible.call({ flash: { [key]: 'Message' } }), true)
  }
})
