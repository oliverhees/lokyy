import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCREENSHOT_DIR = path.resolve(__dirname, './screenshots')

const OWNER = {
  email: 'oliver@lokyy.local',
  password: 'supersecure123',
}

test('Phase 1.5 — Skill toggle persists across reload', async ({ page }) => {
  test.setTimeout(60_000)

  // Login + navigate
  await page.goto('/login')
  await page.getByLabel('Email').fill(OWNER.email)
  await page.getByLabel('Passwort').fill(OWNER.password)
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await page.waitForURL('**/dashboard', { timeout: 15_000 })
  await page.goto('/agents/default')
  await page.getByRole('tab', { name: /Skills/ }).click()
  await expect(page.getByTestId('skills-list')).toBeVisible({ timeout: 10_000 })

  const toggle = page.getByTestId('skill-toggle-claude-code')
  await expect(toggle).toBeVisible()

  // Start: enabled
  await expect(toggle).toHaveAttribute('data-state', 'checked')

  // Click → disabled (Lokyy override)
  await toggle.click()
  await expect(toggle).toHaveAttribute('data-state', 'unchecked')

  // Reload → still disabled (persisted)
  await page.reload()
  await page.getByRole('tab', { name: /Skills/ }).click()
  await expect(page.getByTestId('skills-list')).toBeVisible({ timeout: 10_000 })
  const toggleAfterReload = page.getByTestId('skill-toggle-claude-code')
  await expect(toggleAfterReload).toHaveAttribute('data-state', 'unchecked')

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '1-5-skill-toggle-disabled.png'),
    fullPage: true,
  })

  // Re-enable so other tests don't fail
  await toggleAfterReload.click()
  await expect(toggleAfterReload).toHaveAttribute('data-state', 'checked')
})
