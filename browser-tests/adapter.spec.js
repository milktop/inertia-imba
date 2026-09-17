import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => { throw error })
})

test('navigation preserves the layout and cleans up page head entries', async ({ page }) => {
  await page.goto('/students')
  await page.getByRole('button', { name: 'Layout clicks: 0' }).click()
  await expect(page).toHaveTitle('Students')
  await expect(page.locator('head meta[name="description"]')).toHaveCount(1)
  await page.getByRole('link', { name: 'About', exact: true }).click()
  await expect(page).toHaveTitle('Imba test app')
  await expect(page.getByRole('button', { name: 'Layout clicks: 1' })).toBeVisible()
  await expect(page.locator('head meta[name="description"]')).toHaveCount(0)
  await page.goBack()
  await expect(page).toHaveTitle('Students')
  await expect(page.locator('head meta[name="description"]')).toHaveCount(1)
})

test('Back restores drafts and errors, and reset clears both', async ({ page }) => {
  await page.goto('/students')
  const name = page.getByPlaceholder('Name', { exact: true })
  await name.fill('Al')
  await name.press('Tab')
  await expect(page.getByText('is too short (minimum is 4 characters)', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'About', exact: true }).click()
  await expect(page).toHaveURL(/\/about$/)
  await page.goBack()
  await expect(name).toHaveValue('Al')
  await expect(page.getByText('is too short (minimum is 4 characters)', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Reset form + errors', exact: true }).click()
  await expect(name).toHaveValue('')
  await expect(page.locator('p.error')).toHaveCount(0)
  await expect(page.getByText('Form dirty: false', { exact: true })).toBeVisible()
})

test('Precognition checks only the blurred field without creating a student', async ({ page }) => {
  await page.goto('/students')
  const name = page.getByPlaceholder('Name', { exact: true })
  await name.fill('Al')
  const response = page.waitForResponse(response => response.request().headers().precognition === 'true')
  await name.press('Tab')
  const result = await response
  expect(result.status()).toBe(422)
  expect(result.request().headers()['precognition-validate-only']).toBe('name')
  expect(Object.keys((await result.json()).errors)).toEqual(['name'])
  await expect(page.getByText("can't be blank", { exact: true })).toHaveCount(0)
  await name.fill('Validation Only')
  const corrected = page.waitForResponse(response => response.request().headers().precognition === 'true')
  await name.press('Tab')
  expect((await corrected).status()).toBe(204)
  await expect(page.locator('p.error')).toHaveCount(0)
  await expect(page.locator('li').filter({ hasText: 'Validation Only' })).toHaveCount(0)
})

test('bound submit saves normally and clears the draft after success', async ({ page }) => {
  await page.goto('/students')
  const email = `browser-${Date.now()}@example.test`
  await page.getByPlaceholder('Name', { exact: true }).fill('Browser Regression')
  await page.getByPlaceholder('Email', { exact: true }).fill(email)
  await page.getByRole('button', { name: 'Create student', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('Student created')
  await expect(page.locator('li').filter({ hasText: email })).toHaveCount(1)
  await expect(page.getByPlaceholder('Name', { exact: true })).toHaveValue('')
  await expect(page.getByPlaceholder('Email', { exact: true })).toHaveValue('')
})

test('prefetch is reused when the link is activated', async ({ page }) => {
  await page.goto('/students')
  let requests = 0
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/about') requests++
  })
  const about = page.getByRole('link', { name: 'About', exact: true })
  const prefetched = page.waitForResponse(response => new URL(response.url()).pathname === '/about')
  await about.focus()
  await prefetched
  await about.click()
  await expect(page.getByRole('heading', { name: 'About this fixture' })).toBeVisible()
  expect(requests).toBe(1)
})

test('deferred and visible props load in separate partial requests', async ({ page }) => {
  let release
  const gate = new Promise(resolve => { release = resolve })
  const requested = []
  await page.route('**/loading', async route => {
    const only = route.request().headers()['x-inertia-partial-data']
    if (only) requested.push(only)
    if (only === 'summary') await gate
    await route.continue()
  })
  await page.goto('/loading')
  await expect(page.getByTestId('summary-fallback')).toBeVisible()
  await expect(page.getByTestId('summary')).toHaveCount(0)
  expect(requested).not.toContain('details')
  release()
  await expect(page.getByTestId('summary')).toContainText('Students in the database:')
  await expect(page.getByTestId('summary-fallback')).toHaveCount(0)
  await page.getByTestId('details-fallback').scrollIntoViewIfNeeded()
  await expect(page.getByTestId('details')).toContainText('loaded when it became visible')
  expect(requested.filter(key => key === 'details')).toHaveLength(1)
})

test('polling updates partial props, pauses/resumes, and stops on navigation', async ({ page }) => {
  await page.goto('/loading')
  const time = page.getByTestId('checked-at')
  const initial = await time.textContent()
  await expect(time).not.toHaveText(initial)
  await page.getByRole('button', { name: 'Pause updates' }).click()
  const paused = await time.textContent()
  // A negative timer assertion needs to span at least one configured interval.
  await page.waitForTimeout(2300)
  await expect(time).toHaveText(paused)
  await page.getByRole('button', { name: 'Resume updates' }).click()
  await expect(time).not.toHaveText(paused)
  await page.getByRole('link', { name: 'Back to Students' }).click()
  await expect(page).toHaveURL(/\/students$/)
  let pollsAfterLeaving = 0
  page.on('request', request => {
    if (request.headers()['x-inertia-partial-data'] === 'checked_at') pollsAfterLeaving++
  })
  await page.waitForTimeout(2300)
  expect(pollsAfterLeaving).toBe(0)
})
