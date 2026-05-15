import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCREENSHOT_DIR = path.resolve(__dirname, './screenshots')

const OWNER = {
  email: 'oliver@lokyy.local',
  password: 'supersecure123',
}

test('Phase 9 — neue AI-Chat-V2 UI rendert im Agent-Detail', async ({ page }) => {
  test.setTimeout(90_000)

  await page.goto('/login')
  await page.getByLabel('Email').fill(OWNER.email)
  await page.getByLabel('Passwort').fill(OWNER.password)
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await page.waitForURL('**/dashboard', { timeout: 15_000 })

  await page.goto('/agents/default')
  await page.getByRole('tab', { name: 'Chat' }).click()

  await expect(page.getByTestId('ai-chat-interface')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('ai-chat-input')).toBeVisible()
  await expect(page.getByText('Wie kann Default dir heute helfen?')).toBeVisible()

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '9-ai-chat-empty.png'),
    fullPage: true,
  })

  // Suggestion klicken pre-fills input
  await page.getByText('Plane meinen Tag in 5 Bullets').click()
  await expect(page.getByTestId('ai-chat-input')).toHaveValue('Plane meinen Tag in 5 Bullets')
})
