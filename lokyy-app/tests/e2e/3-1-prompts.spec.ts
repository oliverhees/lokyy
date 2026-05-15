import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCREENSHOT_DIR = path.resolve(__dirname, './screenshots')

const OWNER = {
  email: 'oliver@lokyy.local',
  password: 'supersecure123',
}

test('Phase 3.1 — Prompt Library: empty → create → search → delete', async ({ page }) => {
  test.setTimeout(60_000)

  await page.goto('/login')
  await page.getByLabel('Email').fill(OWNER.email)
  await page.getByLabel('Passwort').fill(OWNER.password)
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await page.waitForURL('**/dashboard', { timeout: 15_000 })

  await page.goto('/prompts')
  await expect(page.locator('h1', { hasText: 'Prompt Library' })).toBeVisible()
  await expect(page.getByTestId('prompts-empty')).toBeVisible()

  // Neuen Prompt anlegen
  await page.getByTestId('prompts-add').click()
  await page.getByTestId('prompt-form-title').fill('Code Review Brief')
  await page.getByTestId('prompt-form-body').fill('Review this PR with focus on: security, perf, readability.')
  await page.getByTestId('prompt-form-tags').fill('coding, review')
  await page.getByTestId('prompt-form-save').click()

  await expect(page.getByTestId('prompts-grid')).toBeVisible()
  await expect(page.getByText('Code Review Brief')).toBeVisible()

  // Second prompt for search
  await page.getByTestId('prompts-add').click()
  await page.getByTestId('prompt-form-title').fill('Weekly Standup')
  await page.getByTestId('prompt-form-body').fill('Summarize this week in 3 bullets.')
  await page.getByTestId('prompt-form-tags').fill('meeting')
  await page.getByTestId('prompt-form-save').click()

  await expect(page.getByText('Weekly Standup')).toBeVisible()

  // Search filtert
  await page.getByTestId('prompts-search').fill('review')
  await expect(page.getByText('Code Review Brief')).toBeVisible()
  await expect(page.getByText('Weekly Standup')).toHaveCount(0)

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '3-1-prompts.png'),
    fullPage: true,
  })

  // Search clearen + delete one
  await page.getByTestId('prompts-search').fill('')
  page.on('dialog', (d) => d.accept())
  const firstCard = page.locator('[data-testid^="prompt-card-"]').first()
  const deleteBtn = firstCard.locator('[data-testid^="prompt-delete-"]')
  await deleteBtn.click()
  await expect(page.locator('[data-testid^="prompt-card-"]')).toHaveCount(1)
})
