import { test, expect } from '@playwright/test'

test('a standalone LinkButton toggles persisted student state and preserves the filter and draft', async ({ page }) => {
  page.on('pageerror', error => { throw error })
  await page.goto('/students')
  const email = `toggle-${Date.now()}@example.test`
  await page.getByPlaceholder('Name', { exact: true }).fill('Toggle Student')
  await page.getByPlaceholder('Email', { exact: true }).fill(email)
  await page.getByRole('button', { name: 'Create student', exact: true }).click()
  const row = page.locator('li').filter({ hasText: email })
  await expect(row).toBeVisible()
  await expect(row.getByTestId('student-status')).toHaveText('Active')

  await page.getByPlaceholder('Filter students', { exact: true }).fill('Toggle Student')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(page).toHaveURL(/query=Toggle(?:\+|%20)Student/)
  await page.getByPlaceholder('Name', { exact: true }).fill('Unsubmitted draft')
  const toggle = row.getByRole('button', { name: 'Toggle active for Toggle Student' })
  expect(await toggle.evaluate(node => node.closest('form'))).toBeNull()
  await expect(toggle).toHaveAttribute('type', 'button')
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')

  let release
  const gate = new Promise(resolve => { release = resolve })
  let requests = 0
  await page.route('**/students/*/toggle_active', async route => {
    requests++
    expect(route.request().method()).toBe('PATCH')
    await gate
    await route.continue()
  })
  await toggle.click()
  await expect(toggle).toBeDisabled()
  await expect(toggle).toHaveAttribute('data-loading', '')
  await toggle.dispatchEvent('click')
  expect(requests).toBe(1)
  release()
  await expect(row.getByTestId('student-status')).toHaveText('Inactive')
  await expect(toggle).toHaveText('Activate')
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await expect(toggle).toBeEnabled()
  await expect(toggle).not.toHaveAttribute('data-loading')
  await expect(page.getByPlaceholder('Name', { exact: true })).toHaveValue('Unsubmitted draft')
  await expect(page.getByPlaceholder('Filter students', { exact: true })).toHaveValue('Toggle Student')
  await expect(page).toHaveURL(/query=Toggle(?:\+|%20)Student/)

  await page.reload()
  await expect(row.getByTestId('student-status')).toHaveText('Inactive')
  await toggle.focus()
  await page.keyboard.press('Space')
  await expect(row.getByTestId('student-status')).toHaveText('Active')
  await expect(toggle).toHaveText('Deactivate')
  expect(requests).toBe(2)
  await page.reload()
  await expect(row.getByTestId('student-status')).toHaveText('Active')
})
