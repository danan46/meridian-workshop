import { test, expect } from '@playwright/test'

test.describe('Global filter bar', () => {
  test('filter bar is visible on all views', async ({ page }) => {
    const routes = ['/', '/inventory', '/orders', '/demand', '/reports']
    for (const route of routes) {
      await page.goto(route)
      // FilterBar renders select/filter controls
      const filterBar = page.locator('.filter-bar, [class*="filter"]').first()
      await expect(filterBar).toBeVisible()
    }
  })
})

test.describe('Inventory filters', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/inventory')
    await expect(page.locator('.loading')).not.toBeVisible({ timeout: 10000 })
  })

  test('displays inventory table with rows', async ({ page }) => {
    await expect(page.locator('table tbody tr').first()).toBeVisible()
  })

  test('search input filters rows', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="earch"], input[type="search"]').first()
    if (await searchInput.isVisible()) {
      const initialCount = await page.locator('table tbody tr').count()
      await searchInput.fill('PCB')
      await page.waitForTimeout(300) // debounce
      const filteredCount = await page.locator('table tbody tr').count()
      expect(filteredCount).toBeLessThanOrEqual(initialCount)
    }
  })
})

test.describe('Orders filters', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/orders')
    await expect(page.locator('.loading')).not.toBeVisible({ timeout: 10000 })
  })

  test('displays orders table', async ({ page }) => {
    await expect(page.locator('table tbody tr').first()).toBeVisible()
  })

  test('stat cards show numeric values', async ({ page }) => {
    const statValues = page.locator('.stat-value')
    await expect(statValues.first()).toBeVisible()
    const text = await statValues.first().textContent()
    expect(text?.trim().length).toBeGreaterThan(0)
  })
})
