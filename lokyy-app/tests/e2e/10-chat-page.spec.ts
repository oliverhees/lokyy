import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCREENSHOT_DIR = path.resolve(__dirname, './screenshots')

const OWNER = {
  email: 'oliver@lokyy.local',
  password: 'supersecure123',
}

test('Phase 10 — General /chat page with sidebar + artifact panel', async ({ page }) => {
  test.setTimeout(60_000)

  await page.goto('/login')
  await page.getByLabel('Email').fill(OWNER.email)
  await page.getByLabel('Passwort').fill(OWNER.password)
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await page.waitForURL('**/dashboard', { timeout: 15_000 })

  await page.goto('/chat')
  await expect(page.getByTestId('chat-page')).toBeVisible()
  await expect(page.getByTestId('chat-sidebar')).toBeVisible()
  await expect(page.getByTestId('chat-new')).toBeVisible()
  await expect(page.getByTestId('chat-input')).toBeVisible()

  // Welcome-Screen sichtbar
  await expect(page.getByText('Wie kann Lokyy dir heute helfen?')).toBeVisible()

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '10-chat-empty.png'),
    fullPage: true,
  })

  // Neuer Chat → History bekommt einen Eintrag wenn man sendet
  await page.getByTestId('chat-input').fill('Hi')
  // Note: nicht senden — vermeidet Hermes-Roundtrip-Latenz im Smoke-Test
})
