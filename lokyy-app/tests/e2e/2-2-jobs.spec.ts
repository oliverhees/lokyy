import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCREENSHOT_DIR = path.resolve(__dirname, './screenshots')

const OWNER = {
  email: 'oliver@lokyy.local',
  password: 'supersecure123',
}

test('Phase 2.2 — Jobs-Page zeigt Cron-Jobs (oder Empty-State)', async ({ page }) => {
  test.setTimeout(60_000)

  await page.goto('/login')
  await page.getByLabel('Email').fill(OWNER.email)
  await page.getByLabel('Passwort').fill(OWNER.password)
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await page.waitForURL('**/dashboard', { timeout: 15_000 })

  await page.goto('/jobs')
  await expect(page.locator('h1', { hasText: 'Schedule Jobs' })).toBeVisible()

  // Entweder Liste oder Empty-State sichtbar
  await expect(
    page.getByTestId('jobs-list').or(page.getByTestId('jobs-empty')),
  ).toBeVisible({ timeout: 10_000 })

  // "Neuer Job" Button sichtbar
  await expect(page.getByTestId('jobs-add')).toBeVisible()

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '2-2-jobs.png'),
    fullPage: true,
  })
})
