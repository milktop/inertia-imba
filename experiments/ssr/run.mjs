import assert from 'node:assert/strict'
import { readFile, mkdir } from 'node:fs/promises'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { build } from 'esbuild'
import { compile } from 'imba/compiler'
import { chromium } from '@playwright/test'
import { patchRuntimeSource } from './runtime-patches.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const adapter = process.argv.includes('--adapter')
const patchRuntime = process.argv.includes('--patch-runtime')
const sourceRuntime = process.argv.includes('--source-runtime') || patchRuntime
const variant = (adapter ? 'adapter-' : '') + (patchRuntime ? 'patched' : sourceRuntime ? 'source' : 'package')
const entry = `${root}experiments/ssr/${adapter ? 'adapter' : 'page'}.imba`
const output = `${root}dist/ssr-poc/${variant}`
await mkdir(output, { recursive: true })

// Compile exactly the same component source for both environments.
for (const platform of ['node', 'browser']) {
  await build({
    entryPoints: [entry],
    conditions: sourceRuntime ? ['imba'] : [],
    resolveExtensions: platform === 'browser' ? ['.web.imba', '.imba', '.js', '.mjs', '.json'] : ['.imba', '.js', '.mjs', '.json'],
    outfile: `${output}/${platform}.mjs`,
    bundle: true,
    format: 'esm',
    platform,
    external: platform === 'node' && !sourceRuntime ? ['imba', 'imba/runtime'] : [],
    plugins: [{ name: 'imba-ssr-probe', setup(builder) {
      builder.onLoad({ filter: /\.imba$/ }, async ({ path }) => {
        let source = await readFile(path, 'utf8')
        if (patchRuntime) source = patchRuntimeSource(source, path, platform, !process.argv.includes('--keep-detached'))
        const result = compile(source, { sourcePath: path, platform })
        const errors = result.diagnostics.filter(item => item.severity === 1)
        if (errors.length) throw new Error(JSON.stringify(errors))
        return { contents: result.js, resolveDir: dirname(path) }
      })
    } }],
  })
}

const { render, renderCss } = await import(`${output}/node.mjs`)
const html = render('Students')
assert.match(html, /Hello Students/)
assert.match(render('Teachers'), /Hello Teachers/)
assert.doesNotMatch(render('Teachers'), /Hello Students/)
const escapesText = render('<script>').includes('Hello &lt;script&gt;')
const client = await readFile(`${output}/browser.mjs`)
const server = createServer((request, response) => {
  if (request.headers['x-inertia']) {
    response.writeHead(200, { 'Content-Type': 'application/json', 'X-Inertia': 'true' })
    return response.end(JSON.stringify({ component: 'Probe', props: {name: 'Teachers'}, url: '/teachers', version: null, clearHistory: false, encryptHistory: false }))
  }
  if (request.url === '/client.mjs') {
    response.writeHead(200, { 'Content-Type': 'text/javascript' })
    return response.end(client)
  }
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  const name = new URL(request.url, 'http://localhost').searchParams.get('name')
  const body = name === null ? html : render(name)
  response.end(`<!doctype html><html><head><meta charset="utf-8"><title>SSR proof of concept</title><style>${renderCss?.() || ''}</style></head><body>${body}
<script>
window.before = Object.fromEntries(['[data-probe=layout]','[data-probe=page]','h1','[data-probe=page] button'].map(selector => [selector,document.querySelector(selector)]));
</script><script type="module" src="/client.mjs"></script></body></html>`)
})
await new Promise((resolve, reject) => {
  server.once('error', reject)
  server.listen(0, '127.0.0.1', resolve)
})
const url = `http://127.0.0.1:${server.address().port}`
let browser
try {
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined })
  const noJs = await browser.newContext({ javaScriptEnabled: false })
  const staticPage = await noJs.newPage()
  await staticPage.goto(url)
  assert.equal(await staticPage.locator('h1').textContent(), 'Hello Students')
  assert.equal(await staticPage.locator('h1').isVisible(), true)
  if (adapter) {
    assert.equal(await staticPage.getByRole('textbox', {name:'Name', exact:true}).inputValue(), patchRuntime ? 'Students' : '')
    assert.notEqual(await staticPage.locator('h1').evaluate(node => getComputedStyle(node).color), 'rgb(0, 0, 0)')
    console.log('Initial HTML, form value and CSS without JavaScript: PASS')
  }
  if (patchRuntime) {
    const names = ['<script>alert(1)</script>', 'A & B &lt;b&gt;', '" autofocus onfocus="alert(1)', '雪 — café']
    for (const name of names) {
      await staticPage.goto(`${url}/?name=${encodeURIComponent(name)}`)
      assert.equal(await staticPage.locator('h1').textContent(), `Hello ${name}`)
      assert.equal(await staticPage.locator('script:not([src])').count(), 1)
      if (adapter) {
        assert.equal(await staticPage.getByRole('textbox', {name: 'Name', exact: true}).inputValue(), name)
        assert.equal(await staticPage.locator('[autofocus], [onfocus]').count(), 0)
        const serialized = await staticPage.locator('[data-probe=host]').getAttribute('data-page')
        assert.equal(JSON.parse(serialized).props.name, name)
      }
    }
    console.log('HTML text, attribute and serialized-prop round trips: PASS')
  }
  await noJs.close()

  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto(url)
  await page.evaluate(() => window.before['[data-probe=page] button'].click())
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  const originalButtonInteractive = await page.evaluate(() => window.before['[data-probe=page] button'].textContent !== 'Clicks: 0')
  if (!originalButtonInteractive) {
    await page.getByRole('button', { name: 'Clicks: 0', exact: true }).last().click({ timeout: 5000 })
  }
  await page.getByRole('button', { name: 'Clicks: 1', exact: true }).waitFor({ timeout: 5000 })
  const reused = await page.evaluate(() => Object.fromEntries(Object.entries(window.before)
    .map(([selector, node]) => [selector, node === document.querySelector(selector)])))
  if (adapter && patchRuntime && !process.argv.includes('--keep-detached')) assert.deepEqual(errors, [])
  const headingCount = await page.locator('h1').count()
  console.log(JSON.stringify({ variant, serverHTML: html, visibleWithoutJavaScript: true,
    interactive: true, originalButtonInteractive, escapesText, headingCount, reused, browserErrors: errors }, null, 2))
  if (adapter) {
    const mounts = await page.evaluate(() => ({page: globalThis.probePageMounts, layout: globalThis.probeLayoutMounts}))
    console.log('Initial mount counts:', mounts)
    if (!process.argv.includes('--keep-detached')) assert.deepEqual(mounts, {page: 1, layout: 1})
    assert.equal(await page.title(), 'Hello Students')
    await page.getByRole('textbox', {name: 'Name', exact: true}).fill('Edited student')
    await page.getByText('Draft: Edited student', {exact: true}).waitFor({timeout: 5000})
    await page.getByRole('button', {name: 'Layout clicks: 0', exact: true}).click()
    await page.getByRole('button', {name: 'Section clicks: 0', exact: true}).click()
    await page.getByRole('link', {name: 'Teachers', exact: true}).click()
    await page.getByRole('heading', {name: 'Hello Teachers', exact: true}).waitFor({timeout: 5000})
    assert.equal(await page.getByRole('button', {name: 'Layout clicks: 1', exact: true}).count(), 1)
    assert.equal(await page.getByRole('button', {name: 'Section clicks: 1', exact: true}).count(), 1)
    assert.equal(await page.getByRole('button', {name: 'Clicks: 0', exact: true}).count(), 1)
    assert.equal(await page.title(), 'Hello Teachers')
    console.log('Inertia navigation, Head, form binding and nested persistent layouts: PASS')

    // Make the remount tradeoff observable: delay JS and type into the SSR form.
    const slowPage = await browser.newPage()
    let releaseClient
    const clientGate = new Promise(resolve => { releaseClient = resolve })
    await slowPage.route('**/client.mjs', async route => {
      await clientGate
      await route.continue()
    })
    try {
      await slowPage.goto(url, {waitUntil: 'commit'})
      await slowPage.getByRole('textbox', {name: 'Name', exact: true}).fill('Typed before startup')
      releaseClient()
      await slowPage.waitForLoadState('load')
      assert.equal(await slowPage.getByRole('textbox', {name: 'Name', exact: true}).inputValue(), 'Students')
      console.log('Known remount limitation confirmed: pre-startup input is reset')
    } finally {
      releaseClient()
      await slowPage.close()
    }
  }
  const mountsOnce = !adapter || await page.evaluate(() => globalThis.probeLayoutMounts === 1 && globalThis.probePageMounts === 2)
  const remountReady = escapesText && headingCount === 1 && errors.length === 0 && mountsOnce
  const hydrationReady = remountReady && originalButtonInteractive && Object.values(reused).every(Boolean)
  console.log(`SSR with client remount: ${remountReady ? 'PASS' : 'BLOCKED'}`)
  console.log(`DOM-preserving hydration: ${hydrationReady ? 'PASS' : 'BLOCKED'}`)
  if (process.argv.includes('--strict') && !(adapter ? remountReady : hydrationReady)) process.exitCode = 1
} finally {
  await browser?.close()
  await new Promise(resolve => server.close(resolve))
}
