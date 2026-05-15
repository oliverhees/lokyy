import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCREENSHOT_DIR = path.resolve(__dirname, './screenshots')

const OWNER = {
  email: 'oliver@lokyy.local',
  password: 'supersecure123',
}

test('Phase 1.4 — MCP-Tab zeigt Server-Liste und Presets', async ({ page }) => {
  test.setTimeout(60_000)

  await page.goto('/login')
  await page.getByLabel('Email').fill(OWNER.email)
  await page.getByLabel('Passwort').fill(OWNER.password)
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await page.waitForURL('**/dashboard', { timeout: 15_000 })
  await page.goto('/agents/default')

  // MCP-Tab
  await page.getByRole('tab', { name: /MCP/ }).click()

  // Empty-State (kein MCP konfiguriert)
  await expect(page.getByTestId('mcps-empty')).toBeVisible({ timeout: 10_000 })

  // Add-Button sichtbar
  await expect(page.getByTestId('mcp-add')).toBeVisible()

  // Presets-Grid sichtbar
  await expect(page.getByTestId('mcps-presets')).toBeVisible()

  // Mindestens ein bekanntes Preset (github)
  await expect(page.getByTestId('mcp-preset-github')).toBeVisible()

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '1-4-mcp-tab.png'),
    fullPage: true,
  })
})
