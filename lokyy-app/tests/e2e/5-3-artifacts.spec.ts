import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCREENSHOT_DIR = path.resolve(__dirname, './screenshots')

const OWNER = {
  email: 'oliver@lokyy.local',
  password: 'supersecure123',
}

test('Phase 5.3 — Chat-Artefakte: code-blocks werden als separate Card gerendert', async ({ page }) => {
  test.setTimeout(180_000)

  await page.goto('/login')
  await page.getByLabel('Email').fill(OWNER.email)
  await page.getByLabel('Passwort').fill(OWNER.password)
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await page.waitForURL('**/dashboard', { timeout: 15_000 })

  await page.goto('/agents/default')
  await page.getByRole('tab', { name: 'Chat' }).click()

  // Sende eine Anfrage, die zu einem Code-Block führen sollte
  await page.getByTestId('agent-chat-input').fill(
    'Antworte exakt mit einem fenced javascript code block der nur "console.log(1)" enthält und keinen weiteren Text.',
  )
  await page.getByTestId('agent-chat-send').click()

  // Assistant-Antwort erscheint
  await expect(page.getByTestId('agent-chat-assistant').first()).toBeVisible({ timeout: 120_000 })

  // Wenn das Modell einen Code-Block lieferte, ist die Artefakt-Card sichtbar
  // (skip falls nicht — externes LLM ist nicht-deterministisch)
  const artifact = page.getByTestId('chat-artifact').first()
  const found = (await artifact.count()) > 0
  if (!found) {
    test.skip(true, 'LLM hat keinen Code-Block geliefert — Artefakt-Rendering nicht erzwingbar.')
    return
  }
  await expect(artifact).toBeVisible()

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '5-3-artifacts.png'),
    fullPage: true,
  })
})
