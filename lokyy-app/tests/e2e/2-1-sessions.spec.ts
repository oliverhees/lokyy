import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCREENSHOT_DIR = path.resolve(__dirname, './screenshots')

const OWNER = {
  email: 'oliver@lokyy.local',
  password: 'supersecure123',
}

test('Phase 2.1 — Sessions-Page lädt Hermes-Sessions als Liste', async ({ page }) => {
  test.setTimeout(60_000)

  await page.goto('/login')
  await page.getByLabel('Email').fill(OWNER.email)
  await page.getByLabel('Passwort').fill(OWNER.password)
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await page.waitForURL('**/dashboard', { timeout: 15_000 })

  await page.goto('/sessions')
  await expect(page.locator('h1', { hasText: 'Sessions' })).toBeVisible()

  // Liste lädt (mindestens 1 Session aus Phase-0.4/1.2 Tests vorhanden)
  await expect(page.getByTestId('sessions-list')).toBeVisible({ timeout: 10_000 })

  // Search funktioniert
  await page.getByTestId('sessions-search').fill('claude')
  await expect(page.getByTestId('sessions-list')).toBeVisible()

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '2-1-sessions.png'),
    fullPage: true,
  })
})
