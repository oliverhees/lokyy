import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCREENSHOT_DIR = path.resolve(__dirname, './screenshots')

const OWNER = {
  email: 'oliver@lokyy.local',
  password: 'supersecure123',
}

test('Phase 4.1 — Workflows: empty → create → show in grid', async ({ page }) => {
  test.setTimeout(60_000)

  await page.goto('/login')
  await page.getByLabel('Email').fill(OWNER.email)
  await page.getByLabel('Passwort').fill(OWNER.password)
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await page.waitForURL('**/dashboard', { timeout: 15_000 })

  await page.goto('/workflows')
  await expect(page.locator('h1', { hasText: 'Workflows' })).toBeVisible()
  await expect(page.getByTestId('workflows-empty')).toBeVisible()

  await page.getByTestId('workflows-add').click()
  await page.getByTestId('workflow-form-name').fill('Daily Brief')
  await page.getByTestId('workflow-form-save').click()

  await expect(page.getByTestId('workflows-grid')).toBeVisible()
  await expect(page.getByText('Daily Brief')).toBeVisible()

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '4-1-workflows.png'),
    fullPage: true,
  })
})
