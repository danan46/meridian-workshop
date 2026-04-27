import { test, expect } from '@playwright/test'

test.describe('Navigation', () => {
  test('loads dashboard on root path', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Meridian|Catalyst/i)
    // Dashboard stat cards should be visible
    await expect(page.locator('.stat-card').first()).toBeVisible()
  })

  test('nav links are all present', async ({ page }) => {
    await page.goto('/')
    const nav = page.locator('.nav-tabs')
    await expect(nav.getByRole('link', { name: /inventory/i })).toBeVisible()
    await expect(nav.getByRole('link', { name: /orders/i })).toBeVisible()
    await expect(nav.getByRole('link', { name: /demand/i })).toBeVisible()
    await expect(nav.getByRole('link', { name: /reports/i })).toBeVisible()
    await expect(nav.getByRole('link', { name: /restocking/i })).toBeVisible()
  })

  test('navigates to inventory view', async ({ page }) => {
    await page.goto('/')
    await page.click('.nav-tabs a[href="/inventory"]')
    await expect(page).toHaveURL('/inventory')
    await expect(page.locator('h2')).toContainText(/inventory/i)
  })

  test('navigates to orders view', async ({ page }) => {
    await page.goto('/')
    await page.click('.nav-tabs a[href="/orders"]')
    await expect(page).toHaveURL('/orders')
    await expect(page.locator('h2')).toContainText(/orders/i)
  })

  test('navigates to reports view', async ({ page }) => {
    await page.goto('/')
    await page.click('.nav-tabs a[href="/reports"]')
    await expect(page).toHaveURL('/reports')
    await expect(page.locator('h2')).toContainText(/report/i)
  })

  test('navigates to restocking view', async ({ page }) => {
    await page.goto('/')
    await page.click('.nav-tabs a[href="/restocking"]')
    await expect(page).toHaveURL('/restocking')
    await expect(page.locator('h2')).toContainText(/restocking/i)
  })

  test('active nav link is highlighted', async ({ page }) => {
    await page.goto('/inventory')
    const inventoryLink = page.locator('.nav-tabs a[href="/inventory"]')
    await expect(inventoryLink).toHaveClass(/active/)
  })
})
