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

// One end-to-end flow per Playwright-context. Avoids cross-test cookie sharing issues.
test('Phase 0.3 — full Login-Wall flow: setup → dashboard → signout → login → dashboard → unauth-guard', async ({
  page,
  context,
}) => {
  // 1) First run: / → /setup
  await page.goto('/')
  await page.waitForURL('**/setup')
  await expect(page.getByText('Lokyy einrichten')).toBeVisible()
  await expect(page.getByLabel('Name')).toBeVisible()

  // 2) Setup: create owner → /dashboard, user in sidebar
  await page.getByLabel('Name').fill(OWNER.name)
  await page.getByLabel('Email').fill(OWNER.email)
  await page.getByLabel('Passwort').fill(OWNER.password)
  await page.getByRole('button', { name: 'Owner-Account anlegen' }).click()
  await page.waitForURL('**/dashboard', { timeout: 15_000 })
  await expect(page.locator('h1', { hasText: 'Dashboard' })).toBeVisible()
  await expect(page.getByTestId('nav-user-name')).toHaveText(OWNER.name)
  await expect(page.getByTestId('nav-user-email')).toHaveText(OWNER.email)
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '0-3-dashboard-as-owner.png'),
    fullPage: true,
  })

  // 3) Sign out via sidebar dropdown → /login
  await page.getByTestId('nav-user-trigger').click()
  await page.getByTestId('nav-user-signout').click()
  await page.waitForURL('**/login')
  await expect(page.getByText('Melde dich in deinem Lokyy-Konto an.')).toBeVisible()

  // 4) Login with owner credentials → /dashboard
  await page.getByLabel('Email').fill(OWNER.email)
  await page.getByLabel('Passwort').fill(OWNER.password)
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await page.waitForURL('**/dashboard', { timeout: 15_000 })
  await expect(page.locator('h1', { hasText: 'Dashboard' })).toBeVisible()
  await expect(page.getByTestId('nav-user-name')).toHaveText(OWNER.name)

  // 5) Unauthenticated /dashboard → /login
  await context.clearCookies()
  await page.goto('/dashboard')
  await page.waitForURL('**/login')

  // 6) After owner-exists: /setup → /login (no re-creation possible)
  await page.goto('/setup')
  await page.waitForURL('**/login')
})
