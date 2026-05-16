import { test, expect } from '@playwright/test'

const OWNER = { email: 'oliver@lokyy.local', password: 'supersecure123' }

/**
 * Regression test: chat must NOT spring back to welcome-screen mid-stream.
 *
 * Root cause was Vite's file watcher reloading the page when
 * `data/conversations.json` was written by middleware during a chat-completion
 * stream. Fix: `server.watch.ignored: ['**\/data/**', ...]` in vite.config.ts.
 *
 * This test verifies that after sending a message, the page does NOT trigger
 * a full reload (no second `[vite] connecting...` event) and the user message
 * stays visible throughout the stream.
 */
test('chat does not spring back to welcome screen during stream', async ({ page }) => {
  test.setTimeout(60_000)

  const viteConnects: number[] = []
  page.on('console', (msg) => {
    if (msg.text().includes('[vite] connecting')) viteConnects.push(Date.now())
  })

  // Login or setup
  await page.goto('/setup')
  await page.waitForFunction(() => /\/(setup|login|dashboard)/.test(window.location.pathname), {
    timeout: 15_000,
  })
  if (page.url().includes('/setup')) {
    await page.getByLabel('Name').fill('Oliver Lokyy')
    await page.getByLabel('Email').fill(OWNER.email)
    await page.getByLabel('Passwort').fill(OWNER.password)
    await page.getByRole('button', { name: 'Owner-Account anlegen' }).click()
    await page.waitForURL('**/dashboard', { timeout: 30_000 })
  } else if (page.url().includes('/login')) {
    await page.locator('#email').fill(OWNER.email)
    await page.locator('#password').fill(OWNER.password)
    await page.locator('button[type="submit"]').click()
    await page.waitForURL('**/dashboard', { timeout: 30_000 })
  }

  await page.goto('/chat')
  await expect(page.getByTestId('chat-page')).toBeVisible()
  await expect(page.getByText('Wie kann Lokyy dir heute helfen?')).toBeVisible()

  // Snapshot vite-connect count *after* page is ready and StrictMode dual-mount is done
  await page.waitForTimeout(500)
  const initialConnects = viteConnects.length

  // Send a message (suggestion → send)
  await page.getByRole('button', { name: 'Schreib mir eine HTML-Landing-Page' }).click()
  await page.getByTestId('chat-send').click()

  // user message appears
  await expect(page.getByTestId('chat-user')).toBeVisible({ timeout: 5_000 })

  // Welcome must disappear (we now have messages)
  await expect(page.getByText('Wie kann Lokyy dir heute helfen?')).not.toBeVisible({ timeout: 2_000 })

  // Hold for 5s: user message must stay visible, welcome must not reappear
  // (this is exactly what was broken — mid-stream page reload).
  for (let i = 0; i < 5; i++) {
    await page.waitForTimeout(1_000)
    await expect(page.getByTestId('chat-user')).toBeVisible()
    await expect(page.getByText('Wie kann Lokyy dir heute helfen?')).not.toBeVisible()
  }

  // No additional vite-connect events => no page reload mid-stream.
  expect(viteConnects.length).toBe(initialConnects)
})
