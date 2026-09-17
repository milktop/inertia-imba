import { test, expect } from '@playwright/test'

const textFile = (size = 128 * 1024) => ({
  name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.alloc(size, 'a'),
})

async function throttleUploads(page) {
  const client = await page.context().newCDPSession(page)
  await client.send('Network.enable')
  await client.send('Network.emulateNetworkConditions', {
    offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: 32 * 1024,
  })
  return client
}

async function unthrottle(client) {
  await client.send('Network.emulateNetworkConditions', {
    offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
  })
  await client.detach()
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => { throw error })
  await page.goto('/uploads')
})

test('multipart upload reports real progress, reaches Rails, and resets both inputs', async ({ page }) => {
  await page.getByLabel('Title', { exact: true }).fill('Class notes')
  await page.getByLabel('Text file', { exact: true }).setInputFiles(textFile())
  const client = await throttleUploads(page)
  const request = page.waitForRequest(request => request.method() === 'POST' && new URL(request.url()).pathname === '/uploads')
  await page.getByRole('button', { name: 'Send file', exact: true }).click()
  expect((await request).headers()['content-type']).toContain('multipart/form-data; boundary=')
  await expect(page.getByRole('button', { name: 'Send file', exact: true })).toBeDisabled()
  const progress = page.getByRole('progressbar', { name: 'Upload progress' })
  await expect.poll(async () => Number(await progress.getAttribute('value'))).toBeGreaterThan(0)
  expect(Number(await progress.getAttribute('value'))).toBeLessThan(100)
  await unthrottle(client)
  await expect(page.getByTestId('upload-receipt')).toContainText('notes.txt — 131072 bytes (text/plain)')
  await expect(page.getByTestId('upload-receipt')).toContainText('Class notes')
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('')
  await expect(page.getByLabel('Text file', { exact: true })).toHaveValue('')
  await expect(progress).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Send file', exact: true })).toBeEnabled()
})

test('Rails rejects invalid uploads, preserves the draft, and accepts a corrected file', async ({ page }) => {
  await page.getByRole('button', { name: 'Send file', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: "can't be blank" })).toBeVisible()
  await expect(page.getByRole('alert').filter({ hasText: 'must be selected' })).toBeVisible()
  await page.getByLabel('Title', { exact: true }).fill('Keep this title')
  await page.getByLabel('Text file', { exact: true }).setInputFiles({
    name: 'image.png', mimeType: 'image/png', buffer: Buffer.from('not a text upload'),
  })
  await page.getByRole('button', { name: 'Send file', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('must be a text file')
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Keep this title')
  await expect(page.getByLabel('Text file', { exact: true })).toHaveValue(/image\.png$/)
  await expect(page.getByTestId('upload-receipt')).toHaveCount(0)
  await page.getByLabel('Text file', { exact: true }).setInputFiles(textFile(24))
  await page.getByRole('button', { name: 'Send file', exact: true }).click()
  await expect(page.getByTestId('upload-receipt')).toContainText('notes.txt — 24 bytes')
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('cancelling an in-flight upload clears progress and permits retry', async ({ page }) => {
  await page.getByLabel('Title', { exact: true }).fill('Retry notes')
  await page.getByLabel('Text file', { exact: true }).setInputFiles(textFile())
  const client = await throttleUploads(page)
  await page.getByRole('button', { name: 'Send file', exact: true }).click()
  const progress = page.getByRole('progressbar', { name: 'Upload progress' })
  await expect.poll(async () => Number(await progress.getAttribute('value'))).toBeGreaterThan(0)
  const failed = page.waitForEvent('requestfailed', request => request.method() === 'POST' && new URL(request.url()).pathname === '/uploads')
  await page.getByRole('button', { name: 'Cancel upload', exact: true }).click()
  await failed
  await expect(page.getByRole('status')).toHaveText('Upload cancelled. You can retry.')
  await expect(progress).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Send file', exact: true })).toBeEnabled()
  await expect(page.getByLabel('Text file', { exact: true })).toHaveValue(/notes\.txt$/)
  await expect(page.getByTestId('upload-receipt')).toHaveCount(0)
  await unthrottle(client)
  await page.getByRole('button', { name: 'Send file', exact: true }).click()
  await expect(page.getByTestId('upload-receipt')).toContainText('Retry notes')
  await expect(page.getByText('Upload cancelled. You can retry.', { exact: true })).toHaveCount(0)
})

test('reset clears the selected file and Rails errors', async ({ page }) => {
  await page.getByLabel('Text file', { exact: true }).setInputFiles(textFile(12))
  await page.getByRole('button', { name: 'Send file', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText("can't be blank")
  await page.getByRole('button', { name: 'Reset upload', exact: true }).click()
  await expect(page.getByLabel('Text file', { exact: true })).toHaveValue('')
  await expect(page.getByRole('alert')).toHaveCount(0)
})
