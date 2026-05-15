import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCREENSHOT_DIR = path.resolve(__dirname, './screenshots')

const OWNER = {
  email: 'oliver@lokyy.local',
  password: 'supersecure123',
}

test('Phase 1.1 — Agents-Galerie zeigt Hermes-Profile als Cards', async ({ page }) => {
  test.setTimeout(60_000)

  // Login (owner aus 0-3 spec)
  await page.goto('/login')
  await page.getByLabel('Email').fill(OWNER.email)
  await page.getByLabel('Passwort').fill(OWNER.password)
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await page.waitForURL('**/dashboard', { timeout: 15_000 })

  // Navigiere zu /agents
  await page.goto('/agents')
  await expect(page.locator('h1', { hasText: 'Agents' })).toBeVisible()

  // Grid und mindestens 1 Card (Default-Profile)
  await expect(page.getByTestId('agents-grid')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('agent-card-default')).toBeVisible()

  // Default-Badge (im Card)
  const card = page.getByTestId('agent-card-default')
  await expect(card.getByText('Default', { exact: true }).first()).toBeVisible()

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '1-1-agents-gallery.png'),
    fullPage: true,
  })
})
