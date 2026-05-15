import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCREENSHOT_DIR = path.resolve(__dirname, './screenshots')

const OWNER = {
  email: 'oliver@lokyy.local',
  password: 'supersecure123',
}

test('Phase 1.2 — Agent detail page with chat tab + skills/mcp tabs', async ({ page }) => {
  test.setTimeout(120_000)

  // Login (owner from 0-3 spec)
  await page.goto('/login')
  await page.getByLabel('Email').fill(OWNER.email)
  await page.getByLabel('Passwort').fill(OWNER.password)
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await page.waitForURL('**/dashboard', { timeout: 15_000 })

  // Gehe in Galerie
  await page.goto('/agents')
  await expect(page.getByTestId('agents-grid')).toBeVisible()

  // Klick auf Default-Agent-Card
  await page.getByTestId('agent-card-default').click()
  await page.waitForURL('**/agents/default')

  // Detail-Header sichtbar
  await expect(page.locator('h1', { hasText: 'Default' })).toBeVisible()

  // Drei Tabs vorhanden
  await expect(page.getByRole('tab', { name: 'Chat' })).toBeVisible()
  await expect(page.getByRole('tab', { name: /Skills/ })).toBeVisible()
  await expect(page.getByRole('tab', { name: /MCP/ })).toBeVisible()

  // Chat-Tab ist default — Input + Send-Button da
  await expect(page.getByTestId('agent-chat-input')).toBeVisible()
  await expect(page.getByTestId('agent-chat-send')).toBeVisible()

  // Skills-Tab zeigt jetzt echte Liste (Phase 1.3)
  await page.getByRole('tab', { name: /Skills/ }).click()
  await expect(page.getByTestId('skills-list')).toBeVisible({ timeout: 10_000 })

  // MCP-Tab zeigt Coming-Soon-Card (Phase 1.4 noch offen)
  await page.getByRole('tab', { name: /MCP/ }).click()
  await expect(page.getByText(/kommt in Phase 1\.4/i)).toBeVisible()

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '1-2-agent-detail.png'),
    fullPage: true,
  })

  // Zurück zu Chat + sende eine Nachricht
  await page.getByRole('tab', { name: 'Chat' }).click()
  await page.getByTestId('agent-chat-input').fill('Sag bitte exakt das Wort "Lokyy" und nichts sonst.')
  await page.getByTestId('agent-chat-send').click()

  // User-Message erscheint sofort
  await expect(page.getByTestId('agent-chat-user').first()).toBeVisible()

  // Assistant-Message erscheint nach Gateway-Response
  await expect(page.getByTestId('agent-chat-assistant').first()).toBeVisible({ timeout: 90_000 })

  // Back-Link funktioniert
  await page.getByTestId('back-to-agents').click()
  await page.waitForURL('**/agents')
  await expect(page.getByTestId('agents-grid')).toBeVisible()
})
