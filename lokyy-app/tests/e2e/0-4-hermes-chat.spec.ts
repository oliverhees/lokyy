import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCREENSHOT_DIR = path.resolve(__dirname, './screenshots')

const OWNER = {
  name: 'Oliver Lokyy',
  email: 'oliver@lokyy.local',
  password: 'supersecure123',
}

test('Phase 0.4 — chat-test page renders + speaks to Hermes-Gateway', async ({ page }) => {
  test.setTimeout(120_000)

  // Owner exists from 0-3 run — login
  await page.goto('/login')
  await page.getByLabel('Email').fill(OWNER.email)
  await page.getByLabel('Passwort').fill(OWNER.password)
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await page.waitForURL('**/dashboard', { timeout: 15_000 })

  // Navigate to chat-test page
  await page.goto('/chat-test')
  await expect(page.locator('h1', { hasText: 'Chat-Test' })).toBeVisible()

  // Gateway status badge appears + reaches a terminal state (up or down)
  const status = page.getByTestId('gateway-status')
  await expect(status).toBeVisible()
  await expect.poll(async () => await status.textContent(), { timeout: 10_000 }).not.toContain('prüfe')

  const statusText = (await status.textContent()) ?? ''
  if (!statusText.includes('verbunden')) {
    test.skip(true, `Hermes-Gateway nicht erreichbar (Status: "${statusText}"). Test übersprungen — starte 'hermes gateway run' und re-run.`)
  }

  // Send a message
  await page.getByTestId('chat-input').fill('Sag bitte exakt das Wort "Lokyy" und nichts sonst.')
  await page.getByTestId('chat-send').click()

  // User message appears immediately
  await expect(page.getByTestId('message-user').first()).toBeVisible()

  // Assistant message appears after gateway responds (long timeout — Hermes can be slow)
  await expect(page.getByTestId('message-assistant').first()).toBeVisible({ timeout: 90_000 })

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '0-4-chat-test-after-roundtrip.png'),
    fullPage: true,
  })
})
