import assert from 'node:assert/strict'
import test, { beforeEach } from 'node:test'
import { router, http } from '@inertiajs/core'
import { route, setRoutes, isRouteName, expandRouteSubmission } from '../src/routes.js'
import { useForm } from '../src/form.js'
import { useHttp } from '../src/http.js'

const routes = {
  'tasks.index': { method: 'get', path: '/tasks' },
  'tasks.show': { method: 'get', path: '/tasks/:id' },
  'tasks.update': { method: 'patch', path: '/tasks/:id' },
  'tasks.destroy': { method: 'delete', path: '/tasks/:id' },
  'tutor/students.show': { method: 'get', path: '/tutor/students/:id' },
  'reports.show': { method: 'get', path: '/reports(/:year(/:month))' },
  'files.show': { method: 'get', path: '/files/*path' },
  'memberships.show': { method: 'get', path: '/teams/:team_id/members/:id' },
}

beforeEach(() => setRoutes(routes))

test('route resolves to a url/method pair that stringifies to its url', () => {
  const target = route('tasks.destroy', { id: 7 })
  assert.equal(target.url, '/tasks/7')
  assert.equal(target.method, 'delete')
  assert.equal(String(target), '/tasks/7')
  assert.equal(`${route('tasks.index')}`, '/tasks')
})

test('a scalar fills the only required param; namespaces keep their slash', () => {
  assert.equal(route('tasks.show', 3).url, '/tasks/3')
  assert.equal(route('tutor/students.show', 'ab c').url, '/tutor/students/ab%20c')
  assert.throws(() => route('memberships.show', 1), /needs named params, e\.g\. \{ team_id, id/)
})

test('extra params become the query string; optional groups and globs', () => {
  assert.equal(route('tasks.index', { page: 2, tag: ['a', 'b'], skip: null }).url, '/tasks?page=2&tag%5B%5D=a&tag%5B%5D=b')
  assert.equal(route('reports.show').url, '/reports')
  assert.equal(route('reports.show', { year: 2026 }).url, '/reports/2026')
  assert.equal(route('reports.show', { year: 2026, month: 9 }).url, '/reports/2026/9')
  assert.equal(route('files.show', { path: 'a b/c.txt' }).url, '/files/a%20b/c.txt')
})

test('unknown routes, missing params and missing registration throw clearly', () => {
  assert.throws(() => route('tasks.edit', 1), /Unknown route: tasks\.edit \(did you mean tasks\.index, tasks\.show/)
  assert.throws(() => route('tasks.show', {}), /Missing parameter "id" for route tasks\.show \(\/tasks\/:id\)/)
  setRoutes(null)
  assert.throws(() => route('tasks.index'), /No routes registered/)
})

test('route names are distinguished from HTTP methods and URLs', () => {
  for (const name of ['tasks.update', 'tutor/students.show']) assert.equal(isRouteName(name), true)
  for (const value of ['post', 'PATCH', '/tasks.json', 'https://x.test/a.b', 'tasks', undefined, {}]) assert.equal(isRouteName(value), false)
  assert.deepEqual(expandRouteSubmission(['post', '/tasks', {}]), ['post', '/tasks', {}])
})

test('useForm submits named routes, pairs and plain method/url alike', t => {
  const visits = []
  for (const method of ['patch', 'delete', 'post']) {
    t.mock.method(router, method, (url, ...rest) => { visits.push({ method, url, options: rest.at(-1) }) })
  }
  const form = useForm({ title: 'Write' })
  form.submit('tasks.update', { id: 4 }, { preserveScroll: true })
  form.submit(route('tasks.destroy', 5))
  form.submit('post', '/tasks')
  assert.deepEqual(visits.map(({ method, url }) => [method, url]), [['patch', '/tasks/4'], ['delete', '/tasks/5'], ['post', '/tasks']])
  assert.equal(visits[0].options.preserveScroll, true)
})

test('precognitive forms and useHttp accept named routes too', async t => {
  let visit
  t.mock.method(router, 'patch', (url, data) => { visit = { url, data } })
  useForm({ title: '' }).withPrecognition('post', '/tasks').submit('tasks.update', { id: 9 })
  assert.deepEqual(visit, { url: '/tasks/9', data: { title: '' } })

  let request
  t.mock.method(http, 'getClient', () => ({ request: async config => { request = config; return { status: 200, data: '{}', headers: {} } } }))
  await useHttp({ title: 'x' }).submit('tasks.update', { id: 2 })
  assert.equal(request.method, 'patch')
  assert.match(request.url, /\/tasks\/2$/)
})
