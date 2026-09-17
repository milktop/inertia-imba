import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => { throw error })
  await page.goto('/action_examples')
})

test('actions are native styled buttons and send POST/PATCH data without submitting the surrounding form', async ({ page }) => {
  const button = page.getByRole('button', { name: 'POST example', exact: true })
  expect(await button.evaluate(node => node.tagName)).toBe('BUTTON')
  await expect(button).toHaveAttribute('type', 'button')
  await expect(button).toHaveCSS('color', 'rgb(80, 80, 80)')
  await expect(button).toHaveCSS('border-radius', '9px')
  let formSubmits = 0
  await page.exposeFunction('recordFormSubmit', () => formSubmits++)
  await page.locator('form').evaluate(form => form.addEventListener('submit', () => window.recordFormSubmit()))
  await button.click()
  await expect(page.getByTestId('last-action')).toHaveText('POST: Created')
  await expect(button).toBeEnabled()
  await expect(button).not.toHaveAttribute('data-loading')
  await page.getByRole('button', { name: 'PATCH example', exact: true }).focus()
  await page.keyboard.press('Space')
  await expect(page.getByTestId('last-action')).toHaveText('PATCH: Updated')
  expect(formSubmits).toBe(0)
})

test('confirmation cancellation sends nothing; accepted DELETE is disabled and blocks duplicates until finish', async ({ page }) => {
  const button = page.getByRole('button', { name: 'DELETE example', exact: true })
  let requests = 0
  let prompts = 0
  let accept = false
  page.on('dialog', async dialog => {
    prompts++
    expect(dialog.message()).toBe('Delete this example?')
    if (accept) await dialog.accept()
    else await dialog.dismiss()
  })
  page.on('request', request => { if (request.method() === 'DELETE') requests++ })
  await button.click()
  await expect(button).toBeEnabled()
  expect(requests).toBe(0)
  await expect(button).not.toHaveAttribute('data-loading')

  let release
  const gate = new Promise(resolve => { release = resolve })
  await page.route('**/action_examples/demo', async route => {
    if (route.request().method() === 'DELETE') await gate
    await route.continue()
  })
  accept = true
  await button.click()
  await expect(button).toBeDisabled()
  await expect(button).toHaveAttribute('data-loading', '')
  await button.dispatchEvent('click')
  expect(prompts).toBe(2)
  expect(requests).toBe(1)
  await button.evaluate(node => { node.disabled = true })
  release()
  await expect(page.getByTestId('last-action')).toHaveText('DELETE: Deleted')
  await expect(button).toBeDisabled()
  await button.evaluate(node => { node.disabled = false })
  await expect(button).toBeEnabled()
  await expect(button).not.toHaveAttribute('data-loading')
})

test('explicit disabled state, validation failures, and global visit cancellation recover correctly', async ({ page }) => {
  const locked = page.getByRole('button', { name: 'Locked example', exact: true })
  await expect(locked).toBeDisabled()
  await page.getByRole('button', { name: 'Unlock example', exact: true }).click()
  await expect(locked).toBeEnabled()
  await locked.click()
  await expect(page.getByTestId('last-action')).toHaveText('POST: Unlocked')
  await page.getByRole('button', { name: 'Lock example', exact: true }).click()
  await expect(locked).toBeDisabled()
  const invalid = page.getByRole('button', { name: 'Validation example', exact: true })
  await invalid.click()
  await expect(page.getByRole('alert')).toHaveText("can't be blank")
  await expect(invalid).toBeEnabled()
  await expect(invalid).not.toHaveAttribute('data-loading')
  await page.evaluate(() => document.addEventListener('inertia:before', event => event.preventDefault(), { once: true }))
  const post = page.getByRole('button', { name: 'POST example', exact: true })
  await post.click()
  await expect(post).toBeEnabled()
  await expect(post).not.toHaveAttribute('data-loading')
  await post.click()
  await expect(page.getByTestId('last-action')).toHaveText('POST: Created')
})

test('cancelling a pending action clears loading and allows retry', async ({ page }) => {
  let release
  const gate = new Promise(resolve => { release = resolve })
  let first = true
  await page.route('**/action_examples', async route => {
    if (route.request().method() === 'POST' && first) {
      first = false
      await gate
      await route.abort()
    } else await route.continue()
  })
  const button = page.getByRole('button', { name: 'POST example', exact: true })
  await button.click()
  await expect(button).toBeDisabled()
  await button.evaluate(node => node.cancel())
  await expect(button).toBeEnabled()
  await expect(button).not.toHaveAttribute('data-loading')
  release()
  await button.click()
  await expect(page.getByTestId('last-action')).toHaveText('POST: Created')
})
