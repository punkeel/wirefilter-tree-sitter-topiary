import { test, expect } from '@playwright/test';

test('sample selection, live errors, formatting, reset, and keyboard shortcut', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#runtime-status-text')).toHaveText('Parser ready');
  await expect(page.locator('#diagnostic-count')).toHaveText('0 issues');
  await expect(page.locator('#highlight-code .token-string')).not.toHaveCount(0);
  await expect(page.locator('#ast-output')).toContainText('logical_expression');
  await page.locator('#format-button').click();
  await expect(page.locator('#format-status')).toHaveText('Formatted just now');
  await expect(page.locator('#formatted-output')).not.toHaveValue('');
  await page.locator('#sample-select').selectOption('invalid');
  await expect(page.locator('#diagnostic-count')).toContainText('syntax');
  await expect(page.locator('#formatted-output')).toHaveValue('');
  await page.locator('#format-button').click();
  await expect(page.locator('#format-status')).toHaveText('Fix syntax issues first');
  await page.locator('#source-input').fill('http.host   eq   "example.com"');
  await expect(page.locator('#diagnostic-count')).toHaveText('0 issues');
  await page.keyboard.press('Control+Shift+F');
  await expect(page.locator('#formatted-output')).toHaveValue('http.host eq "example.com"\n');
  for (const sample of ['operators', 'quantifiers', 'ranges']) {
    await page.locator('#sample-select').selectOption(sample);
    await expect(page.locator('#diagnostic-count')).toHaveText('0 issues');
    await page.locator('#format-button').click();
    await expect(page.locator('#format-status')).toHaveText('Formatted just now');
  }
  await page.locator('#reset-button').click();
  await expect(page.locator('#sample-select')).toHaveValue('method-and-ip');
  expect(errors).toEqual([]);
});

test('formats the originally single-line operator sample with stable breaks', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#runtime-status-text')).toHaveText('Parser ready');
  await page.locator('#sample-select').selectOption('operators');

  const source = await page.locator('#source-input').inputValue();
  expect(source).not.toContain('\n');

  await page.locator('#format-button').click();
  await expect(page.locator('#format-status')).toHaveText('Formatted just now');
  const output = await page.locator('#formatted-output').inputValue();
  for (const operator of ['xor', 'and', 'or']) {
    expect(output).toContain(`\n${operator} `);
  }
  expect(output).toContain('\n    and ');
  expect(output).toContain('"(?i)bot"');

  await page.locator('#format-button').click();
  await expect(page.locator('#formatted-output')).toHaveValue(output);
});

test('mobile layout keeps controls reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('#runtime-status-text')).toHaveText('Parser ready');
  await expect(page.locator('#format-button')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.locator('#format-button').click();
  await expect(page.locator('#format-status')).toHaveText('Formatted just now');
});
