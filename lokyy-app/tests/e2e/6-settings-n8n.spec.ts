import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCREENSHOT_DIR = path.resolve(__dirname, './screenshots')

const OWNER = {
  email: 'oliver@lokyy.local',
  password: 'supersecure123',
}

test('Phase 6 — Settings, n8n empty + configured, TTS toggle', async ({ page }) => {
  test.setTimeout(60_000)

  await page.goto('/login')
  await page.getByLabel('Email').fill(OWNER.email)
  await page.getByLabel('Passwort').fill(OWNER.password)
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await page.waitForURL('**/dashboard', { timeout: 15_000 })

  // /n8n zeigt Empty-State weil keine URL konfiguriert
  await page.goto('/n8n')
  await expect(page.getByTestId('n8n-empty')).toBeVisible({ timeout: 10_000 })

  // /settings: drei Cards sichtbar
  await page.goto('/settings')
  await expect(page.locator('h1', { hasText: 'Settings' })).toBeVisible()
  await expect(page.getByTestId('settings-vault')).toBeVisible()
  await expect(page.getByTestId('settings-n8n')).toBeVisible()
  await expect(page.getByTestId('settings-voice')).toBeVisible()

  // TTS einschalten
  await page.getByTestId('settings-tts-toggle').click()
  await expect(page.getByTestId('settings-tts-toggle')).toHaveAttribute('data-state', 'checked')

  // n8n-URL konfigurieren
  await page.getByTestId('settings-n8n-url').fill('https://example.com')
  await page.getByTestId('settings-n8n-url-save').click()

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '6-settings.png'),
    fullPage: true,
  })

  // /n8n zeigt iframe
  await page.goto('/n8n')
  await expect(page.getByTestId('n8n-iframe')).toBeVisible({ timeout: 10_000 })
})
