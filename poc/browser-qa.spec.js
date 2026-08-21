const { test, expect } = require('@playwright/test');

const url = 'http://127.0.0.1:4173/poc/';

async function continueForm(page) {
  await page.locator('#next').click();
}

test.beforeEach(async ({ page }) => {
  await page.goto(url);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('empty state is pending, not a required permit', async ({ page }) => {
  await expect(page.locator('.summary-permits')).toHaveCount(0);
  await expect(page.locator('#summary')).toContainText('Select a project activity');
});

test('general utility safety route validates current values and resets cleanly', async ({ page }) => {
  await page.getByLabel('Build or maintain a utility').check();
  await continueForm(page);
  await page.getByLabel(/Water, sewer, gas/).check();
  await continueForm(page);
  await page.selectOption('[name=emergency]', 'no');
  await page.selectOption('[name=jurisdiction]', 'row');
  await page.fill('[name=disturbance]', '0');
  await page.selectOption('[name=trafficImpact]', 'lane');
  await page.selectOption('[name=duration]', 'longer');
  await continueForm(page);
  await expect(page.locator('#notice')).toHaveClass(/hidden/);
  await expect(page.locator('#screen')).toContainText('Utility Safety Permit');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#reset-application').click();
  await expect(page.locator('#screen')).toContainText('What work are you planning?');
  await expect(page.getByLabel('Build or maintain a utility')).not.toBeChecked();
});

test('entrance and two wireless nodes route through both nodes before entrance', async ({ page }) => {
  await page.getByLabel('Build or maintain a utility').check();
  await page.getByLabel('Create or modify an entrance').check();
  await continueForm(page);
  await page.getByLabel('Small wireless facilities').check();
  await continueForm(page);
  await page.fill('[name=requestedNodeCount]', '2');
  await continueForm(page);
  await expect(page.locator('#screen')).toContainText('3 permits identified');
});
