import { test, expect } from '@playwright/test';

async function openFormatterSettings(page) {
  const settings = page.locator('details#formatter-settings');
  await expect(settings).toBeVisible();
  if (!(await settings.evaluate(node => node.open))) {
    await settings.locator('summary').click();
  }
  return settings;
}

function compactBooleanQuery(query) {
  return query.replace(
    '["and" "&&" "xor" "^^" "or" "||"] @prepend_hardline',
    '["and" "&&" "xor" "^^" "or" "||"] @prepend_space',
  );
}

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
  for (const operator of ['xor', 'or']) {
    expect(output).toContain(`\n${operator} `);
  }
  expect(output).toContain('\n    and ');
  expect(output).toContain('"(?i)bot"');

  await page.locator('#format-button').click();
  await expect(page.locator('#formatted-output')).toHaveValue(output);
});

test('edits boolean rules while preserving live parsing and clearing stale output', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#runtime-status-text')).toHaveText('Parser ready');
  await openFormatterSettings(page);

  const source = 'http.host eq "a" and http.host eq "b"';
  const rules = page.locator('#formatting-query');
  await expect(rules).toHaveValue(/@prepend_hardline/);
  await page.locator('#source-input').fill(source);
  await expect(page.locator('#diagnostic-count')).toHaveText('0 issues');

  const analysisBefore = await page.evaluate(() => ({
    highlight: document.querySelector('#highlight-code').innerHTML,
    ast: document.querySelector('#ast-output').textContent,
  }));
  await page.locator('#format-button').click();
  await expect(page.locator('#formatted-output')).toHaveValue(/\nand /);

  await rules.fill(compactBooleanQuery(await rules.inputValue()));
  await expect(page.locator('#formatted-output')).toHaveValue('');
  const analysisAfter = await page.evaluate(() => ({
    highlight: document.querySelector('#highlight-code').innerHTML,
    ast: document.querySelector('#ast-output').textContent,
  }));
  expect(analysisAfter).toEqual(analysisBefore);
  await expect(page.locator('#diagnostic-count')).toHaveText('0 issues');

  await page.locator('#format-button').click();
  await expect(page.locator('#formatted-output')).toHaveValue('http.host eq "a" and http.host eq "b"\n');
});

test('formats nested boolean groups with two- and eight-space indentation', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#runtime-status-text')).toHaveText('Parser ready');
  await openFormatterSettings(page);

  const nestedSource = '((http.host eq "a" && http.request.method eq "GET") || ip.src eq 192.0.2.1) ^^ http.host eq "b"';
  const expected = {
    2: `(
  (
    http.host eq "a"
    && http.request.method eq "GET"
  )
  || ip.src eq 192.0.2.1
)
^^ http.host eq "b"
`,
    8: `(
        (
                http.host eq "a"
                && http.request.method eq "GET"
        )
        || ip.src eq 192.0.2.1
)
^^ http.host eq "b"
`,
  };

  await page.locator('#source-input').fill(nestedSource);
  await page.locator('#indent-size').selectOption('2');
  await expect(page.locator('#formatted-output')).toHaveValue('');
  await page.locator('#format-button').click();
  await expect(page.locator('#formatted-output')).toHaveValue(expected[2]);

  await page.locator('#indent-size').selectOption('8');
  await expect(page.locator('#formatted-output')).toHaveValue('');
  await page.locator('#format-button').click();
  await expect(page.locator('#formatted-output')).toHaveValue(expected[8]);
});

test('recovers from invalid rules, resets without losing input, and preserves rules on sample reset', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#runtime-status-text')).toHaveText('Parser ready');
  await openFormatterSettings(page);

  const source = 'http.host eq "keep this input"';
  const rules = page.locator('#formatting-query');
  const rulesError = page.locator('#rules-error');
  const defaultQuery = await rules.inputValue();

  await page.locator('#source-input').fill(source);
  await rules.fill('(');
  await page.locator('#format-button').click();
  await expect(rulesError).toBeVisible();
  await expect(rulesError).not.toHaveText('');
  await expect(page.locator('#formatted-output')).toHaveValue('');

  await page.locator('#reset-rules-button').click();
  await expect(rules).toHaveValue(defaultQuery);
  await expect(page.locator('#indent-size')).toHaveValue('4');
  await expect(rulesError).toBeHidden();
  await expect(page.locator('#source-input')).toHaveValue(source);
  await page.locator('#format-button').click();
  await expect(page.locator('#formatted-output')).toHaveValue('http.host eq "keep this input"\n');

  await rules.fill(compactBooleanQuery(defaultQuery));
  await page.locator('#indent-size').selectOption('8');
  await page.locator('#sample-select').selectOption('operators');
  await page.locator('#reset-button').click();
  await expect(page.locator('#sample-select')).toHaveValue('method-and-ip');
  await expect(rules).toHaveValue(compactBooleanQuery(defaultQuery));
  await expect(page.locator('#indent-size')).toHaveValue('8');
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
