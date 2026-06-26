import { test, expect } from '@playwright/test'

test.describe('Faro UI Inspection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:9000')
    await page.waitForLoadState('networkidle')
  })

  test('capture main feed page', async ({ page }) => {
    await page.screenshot({ path: 'test/screenshots/01-feed.png', fullPage: true })
  })

  test('capture login dialog', async ({ page }) => {
    await page.click('[data-testid="open-login"]')
    await page.waitForTimeout(500)
    await page.screenshot({ path: 'test/screenshots/02-login-dialog.png' })
  })

  test('capture new post page', async ({ page }) => {
    await page.click('a[href="#/new"]')
    await page.waitForTimeout(500)
    await page.screenshot({ path: 'test/screenshots/03-new-post.png', fullPage: true })
  })

  test('capture profile page', async ({ page }) => {
    await page.click('a[href="#/profile"]')
    await page.waitForTimeout(500)
    await page.screenshot({ path: 'test/screenshots/04-profile.png', fullPage: true })
  })
})
