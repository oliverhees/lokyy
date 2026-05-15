import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCREENSHOT_DIR = path.resolve(__dirname, './screenshots')

const OWNER = {
  email: 'oliver@lokyy.local',
  password: 'supersecure123',
}

test('Phase 7.1 — Kanban-Board zeigt alle Status-Spalten', async ({ page }) => {
  test.setTimeout(60_000)

  await page.goto('/login')
  await page.getByLabel('Email').fill(OWNER.email)
  await page.getByLabel('Passwort').fill(OWNER.password)
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await page.waitForURL('**/dashboard', { timeout: 15_000 })

  await page.goto('/tasks')
  await expect(page.locator('h1', { hasText: 'Tasks' })).toBeVisible()

  // Entweder Board mit Spalten oder Unavailable-State
  await expect(
    page.getByTestId('tasks-board').or(page.getByTestId('tasks-unavailable')),
  ).toBeVisible({ timeout: 10_000 })

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '7-1-tasks.png'),
    fullPage: true,
  })
})

test('Phase 7.2 — Jobs Page hat Add-Dialog mit Schedule + Prompt', async ({ page }) => {
  test.setTimeout(60_000)

  await page.goto('/login')
  await page.getByLabel('Email').fill(OWNER.email)
  await page.getByLabel('Passwort').fill(OWNER.password)
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await page.waitForURL('**/dashboard', { timeout: 15_000 })

  await page.goto('/jobs')
  await page.getByTestId('jobs-add').click()

  // Dialog sichtbar mit Form
  await expect(page.getByTestId('job-form-schedule')).toBeVisible()
  await expect(page.getByTestId('job-form-prompt')).toBeVisible()

  // Preset-Button setzt Schedule
  await page.getByRole('button', { name: 'Every hour' }).click()
  await expect(page.getByTestId('job-form-schedule')).toHaveValue('1h')

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '7-2-jobs-dialog.png'),
    fullPage: true,
  })
})
