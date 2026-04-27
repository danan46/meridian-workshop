import { test, expect } from '@playwright/test'

test.describe('Restocking page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/restocking')
    await expect(page.locator('.loading')).not.toBeVisible({ timeout: 10000 })
  })

  test('renders page title', async ({ page }) => {
    await expect(page.locator('h2')).toContainText(/restocking/i)
  })

  test('shows summary stat cards', async ({ page }) => {
    const statCards = page.locator('.stat-card')
    await expect(statCards.first()).toBeVisible()
    // Total cost card
    await expect(statCards.first()).toContainText('$')
  })

  test('shows recommendations table when items exist', async ({ page }) => {
    const table = page.locator('table')
    // Either a table or the empty-state message
    const isEmpty = await page.locator('.empty-state').isVisible()
    if (!isEmpty) {
      await expect(table).toBeVisible()
      await expect(table.locator('tbody tr').first()).toBeVisible()
    }
  })

  test('budget input is interactive', async ({ page }) => {
    const input = page.locator('.budget-input')
    await expect(input).toBeVisible()
    await input.fill('5000')
    await expect(input).toHaveValue('5000')
  })

  test('applying a budget reloads recommendations', async ({ page }) => {
    const input = page.locator('.budget-input')
    await input.fill('10000')
    await page.click('.btn-primary')
    // Loading should briefly appear then resolve
    await expect(page.locator('.loading')).not.toBeVisible({ timeout: 10000 })
    // Budget stat card should now appear
    await expect(page.locator('.stat-card').nth(2)).toBeVisible()
  })

  test('clear button removes active budget', async ({ page }) => {
    const input = page.locator('.budget-input')
    await input.fill('10000')
    await page.click('.btn-primary')
    await expect(page.locator('.loading')).not.toBeVisible({ timeout: 10000 })

    const clearBtn = page.locator('.btn-secondary')
    await expect(clearBtn).toBeVisible()
    await clearBtn.click()
    await expect(page.locator('.loading')).not.toBeVisible({ timeout: 10000 })
    // Clear button should be gone
    await expect(clearBtn).not.toBeVisible()
  })

  test('priority badges are one of high / medium / low', async ({ page }) => {
    const isEmpty = await page.locator('.empty-state').isVisible()
    if (!isEmpty) {
      const badge = page.locator('table .badge.danger, table .badge.warning, table .badge.info').first()
      await expect(badge).toBeVisible()
    }
  })

  test('demand trend badges are present', async ({ page }) => {
    const isEmpty = await page.locator('.empty-state').isVisible()
    if (!isEmpty) {
      const trendBadge = page.locator('.badge.increasing, .badge.stable, .badge.decreasing').first()
      await expect(trendBadge).toBeVisible()
    }
  })
})
