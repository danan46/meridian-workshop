import { test, expect } from '@playwright/test'

test.describe('Reports page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/reports')
    // Wait for data to load (loading spinner gone)
    await expect(page.locator('.loading')).not.toBeVisible({ timeout: 10000 })
  })

  test('renders quarterly performance table', async ({ page }) => {
    const table = page.locator('.reports-table').first()
    await expect(table).toBeVisible()
    // Header row
    await expect(table.locator('th').first()).toContainText(/quarter/i)
    // At least one data row
    await expect(table.locator('tbody tr').first()).toBeVisible()
  })

  test('renders monthly revenue bar chart', async ({ page }) => {
    await expect(page.locator('.bar-chart')).toBeVisible()
    // At least one bar should be rendered
    const bars = page.locator('.bar')
    await expect(bars.first()).toBeVisible()
  })

  test('renders month-over-month table', async ({ page }) => {
    const tables = page.locator('.reports-table')
    await expect(tables.nth(1)).toBeVisible()
    await expect(tables.nth(1).locator('th').first()).toContainText(/month/i)
  })

  test('summary stats cards are rendered', async ({ page }) => {
    const statCards = page.locator('.stat-card')
    await expect(statCards).toHaveCount(4)
  })

  test('quarterly fulfillment badges are present', async ({ page }) => {
    const badge = page.locator('.reports-table .badge').first()
    await expect(badge).toBeVisible()
    // Badge should contain a percentage
    await expect(badge).toContainText('%')
  })

  test('growth rate column shows + or - signs', async ({ page }) => {
    const tables = page.locator('.reports-table')
    const momTable = tables.nth(1)
    // At least one change cell should have positive or negative class
    const changeCell = momTable.locator('.positive-change, .negative-change').first()
    await expect(changeCell).toBeVisible()
  })

  test('no console errors on page load', async ({ page }) => {
    const errors = []
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    await page.goto('/reports')
    await expect(page.locator('.loading')).not.toBeVisible({ timeout: 10000 })
    expect(errors).toHaveLength(0)
  })

  test('does not show excessive console.log output', async ({ page }) => {
    const logs = []
    page.on('console', msg => {
      if (msg.type() === 'log') logs.push(msg.text())
    })
    await page.goto('/reports')
    await expect(page.locator('.loading')).not.toBeVisible({ timeout: 10000 })
    // The old Reports.vue had console.log on every formatNumber call —
    // after remediation there should be zero log messages from the component.
    expect(logs.length).toBe(0)
  })
})
