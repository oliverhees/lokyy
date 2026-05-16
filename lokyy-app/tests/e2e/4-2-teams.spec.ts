import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCREENSHOT_DIR = path.resolve(__dirname, './screenshots')

const OWNER = {
  email: 'oliver@lokyy.local',
  password: 'supersecure123',
}

test('Phase 4.2 — Teams: empty → create with member → show in grid', async ({ page }) => {
  test.setTimeout(60_000)

  await page.goto('/login')
  await page.getByLabel('Email').fill(OWNER.email)
  await page.getByLabel('Passwort').fill(OWNER.password)
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await page.waitForURL('**/dashboard', { timeout: 15_000 })

  await page.goto('/teams')
  await expect(page.locator('h1', { hasText: 'Teams' })).toBeVisible()
  await expect(page.getByTestId('teams-empty')).toBeVisible()

  await page.getByTestId('teams-add').click()
  await page.getByTestId('team-form-name').fill('Core Reviewers')
  await page.getByTestId('team-member-default').check()
  await page.getByTestId('team-form-save').click()

  await expect(page.getByTestId('teams-grid')).toBeVisible()
  await expect(page.getByText('Core Reviewers')).toBeVisible()

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '4-2-teams.png'),
    fullPage: true,
  })
})
