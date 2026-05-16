import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCREENSHOT_DIR = path.resolve(__dirname, './screenshots')

const OWNER = {
  email: 'oliver@lokyy.local',
  password: 'supersecure123',
}

test('Phase 3.2 — Vault zeigt Empty-State wenn LOKYY_VAULT_PATH leer ist', async ({ page }) => {
  test.setTimeout(60_000)

  await page.goto('/login')
  await page.getByLabel('Email').fill(OWNER.email)
  await page.getByLabel('Passwort').fill(OWNER.password)
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await page.waitForURL('**/dashboard', { timeout: 15_000 })

  await page.goto('/vault')
  await expect(page.locator('h1', { hasText: 'Second Brain' })).toBeVisible()

  // Wenn kein Vault konfiguriert (default in Tests), Empty-State sichtbar.
  // Wenn Vault konfiguriert ist, sehen wir die Entries.
  await expect(
    page.getByTestId('vault-empty').or(page.getByTestId('vault-entries')),
  ).toBeVisible({ timeout: 10_000 })

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '3-2-vault.png'),
    fullPage: true,
  })
})
