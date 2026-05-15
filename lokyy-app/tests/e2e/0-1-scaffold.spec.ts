import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCREENSHOT_DIR = path.resolve(__dirname, './screenshots')

test('Phase 0.1 — Lokyy scaffold renders hello-world', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle('Lokyy')
  await expect(page.locator('h1')).toHaveText('Lokyy')
  await expect(page.locator('text=Phase 0.1')).toBeVisible()

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '0-1-scaffold.png'),
    fullPage: true,
  })
})
