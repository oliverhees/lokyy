import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCREENSHOT_DIR = path.resolve(__dirname, './screenshots')

const OWNER = {
  email: 'oliver@lokyy.local',
  password: 'supersecure123',
}

test('Phase 5.1 — Integrations: list providers, connect/disconnect google-calendar', async ({ page }) => {
  test.setTimeout(60_000)

  page.on('dialog', (d) => d.accept())

  await page.goto('/login')
  await page.getByLabel('Email').fill(OWNER.email)
  await page.getByLabel('Passwort').fill(OWNER.password)
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await page.waitForURL('**/dashboard', { timeout: 15_000 })

  await page.goto('/integrations')
  await expect(page.locator('h1', { hasText: 'Integrations' })).toBeVisible()
  await expect(page.getByTestId('integrations-grid')).toBeVisible({ timeout: 10_000 })

  // Erwartete Provider sichtbar
  for (const id of ['google-calendar', 'gmail', 'notion', 'linear', 'slack', 'github']) {
    await expect(page.getByTestId(`integration-card-${id}`)).toBeVisible()
  }

  // Google Calendar verbinden
  await page.getByTestId('integration-toggle-google-calendar').click()
  // Badge "verbunden" sollte erscheinen
  const gcalCard = page.getByTestId('integration-card-google-calendar')
  await expect(gcalCard.getByText('verbunden')).toBeVisible({ timeout: 5_000 })

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '5-1-integrations.png'),
    fullPage: true,
  })

  // Wieder trennen für Idempotenz
  await page.getByTestId('integration-toggle-google-calendar').click()
  await expect(gcalCard.getByText('offen')).toBeVisible({ timeout: 5_000 })
})
