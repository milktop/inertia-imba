import { test, expect } from '@playwright/test'

test.beforeEach(async ({page}) => {
  page.on('pageerror', error => { throw error })
})

async function studentAction(page) {
  await page.goto('/students')
  const row = page.locator('li[data-student-id]').first()
  const id = await row.getAttribute('data-student-id')
  const stableRow = page.locator(`li[data-student-id="${id}"]`)
  const status = stableRow.getByTestId('student-status')
  const before = await status.textContent()
  return {status, button: stableRow.getByRole('button'), before, after: before === 'Active' ? 'Inactive' : 'Active'}
}

test('student status updates before the response, then keeps the confirmed result and draft', async ({page}) => {
  const {status, button, after} = await studentAction(page)
  await page.getByPlaceholder('Name', {exact: true}).fill('Keep this draft')
  await page.getByRole('button', {name: 'Layout clicks: 0'}).click()
  let release
  const gate = new Promise(resolve => {release = resolve})
  await page.route('**/students/*/toggle_active', async route => {
    await gate
    await route.continue()
  })
  await button.click()
  await expect(status).toHaveText(after)
  await expect(button).toBeDisabled()
  await expect(page.getByPlaceholder('Name', {exact: true})).toHaveValue('Keep this draft')
  release()
  await expect(button).toBeEnabled()
  await expect(status).toHaveText(after)
  await expect(page.getByRole('button', {name: 'Layout clicks: 1'})).toBeVisible()
  await page.reload()
  await expect(status).toHaveText(after)
})

test('validation failure restores the student status and releases the button', async ({page}) => {
  const {status, button, before, after} = await studentAction(page)
  const original = await page.locator('script[data-page="app"][type="application/json"]').evaluate(node => JSON.parse(node.textContent))
  let release
  const gate = new Promise(resolve => {release = resolve})
  await page.route('**/students/*/toggle_active', async route => {
    await gate
    await route.fulfill({status: 200, headers: {'X-Inertia': 'true'}, contentType: 'application/json',
      body: JSON.stringify({...original, props: {...original.props, errors: {active: 'Cannot change this student'}}})})
  })
  await button.click()
  await expect(status).toHaveText(after)
  await expect(button).toBeDisabled()
  release()
  await expect(status).toHaveText(before)
  await expect(button).toBeEnabled()
})

test('cancelling an optimistic student action rolls back without saving it', async ({page}) => {
  const {status, button, before, after} = await studentAction(page)
  let release
  const gate = new Promise(resolve => {release = resolve})
  await page.route('**/students/*/toggle_active', async route => {
    await gate
    await route.abort()
  })
  await button.click()
  await expect(status).toHaveText(after)
  await button.evaluate(node => node.cancel())
  await expect(status).toHaveText(before)
  await expect(button).toBeEnabled()
  release()
  await page.reload()
  await expect(status).toHaveText(before)
})

test('HTTP optimistic data is bound immediately and rolls back on real Rails validation', async ({page}) => {
  await page.goto('/about')
  const name = page.getByRole('textbox', {name: 'Optimistic preview name', exact: true})
  const output = page.getByTestId('optimistic-name')
  let release
  let gate = new Promise(resolve => {release = resolve})
  await page.route('**/http-preview', async route => {await gate; await route.continue()})
  await page.getByRole('button', {name: 'Try successful update'}).click()
  await expect(name).toHaveValue('Ada!')
  await expect(output).toHaveText('Ada!')
  await expect(page.getByRole('button', {name: 'Try successful update'})).toBeDisabled()
  release()
  await expect(page.getByRole('button', {name: 'Try successful update'})).toBeEnabled()
  await expect(name).toHaveValue('Ada!')
  gate = new Promise(resolve => {release = resolve})
  await page.getByRole('button', {name: 'Try rejected update'}).click()
  await expect(output).toHaveText('(blank)')
  await expect(name).toHaveValue('')
  release()
  await expect(name).toHaveValue('Ada!')
  await expect(output).toHaveText('Ada!')
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('button', {name: 'Try rejected update'})).toBeEnabled()
})
