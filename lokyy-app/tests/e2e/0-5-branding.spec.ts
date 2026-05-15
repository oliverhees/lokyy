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

test('Phase 0.5 — Lokyy branding visible: logo, sidebar text, no "Shadcn" or "Get Pro"', async ({ page }) => {
  // Owner was already created by 0-3 spec in this Playwright run (DB persists between tests).
  await page.goto('/login')
  await page.getByLabel('Email').fill(OWNER.email)
  await page.getByLabel('Passwort').fill(OWNER.password)
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await page.waitForURL('**/dashboard', { timeout: 15_000 })

  await expect(page).toHaveTitle('Lokyy')

  await expect(page.getByAltText('Lokyy')).toBeVisible()
  await expect(page.getByText('Lokyy', { exact: true }).first()).toBeVisible()

  const body = await page.content()
  expect(body).not.toContain('Shadcn UI Kit')
  expect(body).not.toContain('Get Pro')
  expect(body).not.toContain('Unlock Everything')

  for (const label of ['Dashboard', 'Agents', 'Sessions', 'Workflows', 'Prompt Library', 'Second Brain']) {
    await expect(page.getByText(label).first()).toBeVisible()
  }

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '0-5-lokyy-branded-dashboard.png'),
    fullPage: true,
  })
})
