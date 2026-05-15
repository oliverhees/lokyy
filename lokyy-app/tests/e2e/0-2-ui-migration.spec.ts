import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCREENSHOT_DIR = path.resolve(__dirname, './screenshots')

test('Phase 0.2 — root redirects to /dashboard and Classic Dashboard renders', async ({ page }) => {
  await page.goto('/')
  await page.waitForURL('**/dashboard')

  await expect(page).toHaveTitle('Lokyy')
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible()
})

test('Phase 0.2 — sidebar + header structure visible', async ({ page }) => {
  await page.goto('/dashboard')

  // Sidebar must exist (data-slot from shadcn sidebar.tsx)
  await expect(page.locator('[data-slot="sidebar"]').first()).toBeVisible()

  // Header sticky bar
  await expect(page.locator('header').first()).toBeVisible()

  // The six dashboard cards must be present by their card titles
  for (const title of [
    'Team Members',
    'Subscriptions',
    'Total Revenue',
    'Exercise Minutes',
    'Latest Payments',
    'Payment Method',
  ]) {
    await expect(page.getByText(title).first()).toBeVisible()
  }
})

test('Phase 0.2 — full-page screenshot for visual evidence', async ({ page }) => {
  await page.goto('/dashboard')
  await page.waitForLoadState('networkidle')
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '0-2-classic-dashboard.png'),
    fullPage: true,
  })
})
