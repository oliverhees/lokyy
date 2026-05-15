import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCREENSHOT_DIR = path.resolve(__dirname, './screenshots')

const OWNER = {
  email: 'oliver@lokyy.local',
  password: 'supersecure123',
}

test('Phase 1.3 — Skills-Tab listet Skills, hat Search + Toggle', async ({ page }) => {
  test.setTimeout(60_000)

  // Login + navigate
  await page.goto('/login')
  await page.getByLabel('Email').fill(OWNER.email)
  await page.getByLabel('Passwort').fill(OWNER.password)
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await page.waitForURL('**/dashboard', { timeout: 15_000 })
  await page.goto('/agents/default')

  // Skills-Tab öffnen
  await page.getByRole('tab', { name: /Skills/ }).click()

  // Liste lädt
  await expect(page.getByTestId('skills-list')).toBeVisible({ timeout: 10_000 })

  // Bekannter Skill da
  await expect(page.getByTestId('skill-name-claude-code')).toBeVisible()

  // Search filtert
  await page.getByTestId('skills-search').fill('claude')
  await expect(page.getByTestId('skill-name-claude-code')).toBeVisible()
  await expect(page.getByTestId('skill-name-yuanbao')).toHaveCount(0)

  // Clear search
  await page.getByTestId('skills-search').fill('')

  // Toggle ist sichtbar und interaktiv (seit Phase 1.5)
  const toggle = page.getByTestId('skill-toggle-claude-code')
  await expect(toggle).toBeVisible()
  await expect(toggle).toBeEnabled()

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '1-3-skills-tab.png'),
    fullPage: true,
  })
})
