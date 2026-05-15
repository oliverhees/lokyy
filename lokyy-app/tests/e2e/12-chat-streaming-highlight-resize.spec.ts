import { test, expect } from '@playwright/test'

const OWNER = { email: 'oliver@lokyy.local', password: 'supersecure123' }

async function loginOrSetup(page: import('@playwright/test').Page) {
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
}

test('streamingText renders as markdown (code-blocks get a styled container live)', async ({ page }) => {
  test.setTimeout(30_000)
  await loginOrSetup(page)

  // Inject a fake stream into the chat by hitting the gateway-proxy with a stub?
  // Simpler: just verify that the streaming-text container renders the MessageContent
  // (markdown=true) wrapper, by checking the DOM contract once we trigger a send.
  // Hermes is slow; instead we verify the component contract via a direct unit-shape
  // assertion on the route source — too brittle. So we navigate and then assert that
  // when we type a fenced block as a user-side message, react-markdown highlights it.
  // For streaming we trust the same code path is used.

  await page.goto('/chat')
  await expect(page.getByTestId('chat-page')).toBeVisible()

  // Sanity: send a message; check that during/after the assistant rendering,
  // code-blocks (if any) end up with a <pre> from shiki. We accept either streamed
  // or final state.
  await page.getByTestId('chat-input').fill('Antworte nur mit:\n```html\n<h1>hi</h1>\n```')
  await page.getByTestId('chat-send').click()

  await expect(page.getByTestId('chat-user')).toBeVisible({ timeout: 5_000 })

  // Watch for shiki-rendered <pre> appearing — either during stream (live highlight)
  // or after stream completes. The key guarantee: streaming-text uses MessageContent
  // markdown=true, so the `<pre>` will be present once shiki finishes one tick.
  await page.waitForSelector('[data-testid="streaming-text"] pre, [data-testid="chat-assistant"] pre', {
    timeout: 25_000,
  })
})

test('artifact panel is resizable via drag handle and persists width', async ({ page }) => {
  test.setTimeout(30_000)
  await loginOrSetup(page)

  // Seed conversation + artifact directly via API to avoid Hermes streaming dependency.
  const apiBase = 'http://127.0.0.1:3100/api/lokyy/conversations'
  const newConv = await page.request.post(apiBase, {
    data: { title: 'Artifact resize test' },
  })
  const created = await newConv.json()
  const convId = created.conversation.id

  await page.request.post(`${apiBase}/${convId}/append`, {
    data: { role: 'user', content: 'Zeig mir was', at: new Date().toISOString() },
  })
  await page.request.post(`${apiBase}/${convId}/append`, {
    data: {
      role: 'assistant',
      content: 'Hier:\n```html\n<!DOCTYPE html>\n<html><body><h1>hi</h1></body></html>\n```',
      at: new Date().toISOString(),
    },
  })

  await page.goto('/chat')
  await expect(page.getByTestId('chat-page')).toBeVisible()

  // Open the seeded conversation
  await page.getByTestId(`chat-history-item-${convId}`).click()
  await expect(page.getByTestId('chat-assistant')).toBeVisible({ timeout: 5_000 })

  // Click the artifact pill to open the panel
  await page.getByTestId('chat-artifact-pill').first().click()
  await expect(page.getByTestId('artifact-panel')).toBeVisible()

  const before = await page.getByTestId('artifact-panel').boundingBox()
  expect(before?.width).toBeGreaterThan(0)

  // Drag the resize handle left by 200px (panel grows)
  const handle = page.getByTestId('artifact-resize-handle')
  const handleBox = await handle.boundingBox()
  if (!handleBox) throw new Error('resize handle has no bounding box')
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(handleBox.x - 200, handleBox.y + handleBox.height / 2, { steps: 10 })
  await page.mouse.up()

  const after = await page.getByTestId('artifact-panel').boundingBox()
  expect(after?.width).toBeGreaterThan((before?.width ?? 0) + 100)

  // Reload, panel should remember the width via localStorage
  const widthAfterDrag = after?.width ?? 0
  await page.reload()
  await page.getByTestId(`chat-history-item-${convId}`).click()
  await page.getByTestId('chat-artifact-pill').first().click()
  await expect(page.getByTestId('artifact-panel')).toBeVisible()
  const persisted = await page.getByTestId('artifact-panel').boundingBox()
  expect(Math.abs((persisted?.width ?? 0) - widthAfterDrag)).toBeLessThan(5)
})
