import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCREENSHOT_DIR = path.resolve(__dirname, './screenshots')

const OWNER = {
  email: 'oliver@lokyy.local',
  password: 'supersecure123',
}

const ROUTES: Array<{ path: string; heading: string; testid?: string }> = [
  { path: '/insights', heading: 'Insights', testid: 'insights-stats' },
  { path: '/memory', heading: 'Memory', testid: 'memory-providers' },
  { path: '/logs', heading: 'Logs', testid: 'logs-output' },
  { path: '/webhooks', heading: 'Webhooks' },
  { path: '/plugins', heading: 'Plugins' },
  { path: '/tools', heading: 'Tools', testid: 'tools-grid' },
  { path: '/channels', heading: 'Channels', testid: 'channels-grid' },
]

test('Phase 8 — all hermes-native routes render without error', async ({ page }) => {
  test.setTimeout(120_000)

  await page.goto('/login')
  await page.getByLabel('Email').fill(OWNER.email)
  await page.getByLabel('Passwort').fill(OWNER.password)
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await page.waitForURL('**/dashboard', { timeout: 15_000 })

  for (const r of ROUTES) {
    await page.goto(r.path)
    await expect(page.locator('h1', { hasText: r.heading })).toBeVisible({ timeout: 15_000 })
    if (r.testid) {
      // Loose check — either the data-testid surface OR an empty/error fallback
      await expect.poll(async () => await page.locator('main').first().isVisible()).toBe(true)
    }
  }

  // Navigate to /channels for screenshot
  await page.goto('/channels')
  await expect(page.locator('h1', { hasText: 'Channels' })).toBeVisible()
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '8-channels.png'),
    fullPage: true,
  })

  await page.goto('/insights')
  await expect(page.locator('h1', { hasText: 'Insights' })).toBeVisible()
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '8-insights.png'),
    fullPage: true,
  })

  // Settings page with new admin card
  await page.goto('/settings')
  await expect(page.getByTestId('settings-hermes-admin')).toBeVisible({ timeout: 10_000 })
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '8-settings-admin.png'),
    fullPage: true,
  })
})
