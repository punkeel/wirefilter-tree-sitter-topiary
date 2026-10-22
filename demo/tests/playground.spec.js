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

async function expectExactText(locator, expected) {
  await expect.poll(
    () => locator.evaluate(node => node.textContent),
    { message: `Expected ${locator} to have exact text content`, timeout: 10000 },
  ).toBe(expected);
}

async function expectSourceHighlight(page, source) {
  await expect(page.locator('#source-input')).toHaveValue(source);
  await expectExactText(page.locator('#highlight-code'), source);
}

async function expectFormattedOutput(page, formatted) {
  await expectExactText(page.locator('#formatted-highlight-code'), formatted);
}

async function waitForFormattedOutput(page) {
  await expect.poll(
    () => page.locator('#formatted-highlight-code').textContent(),
    { message: 'Expected automatic formatting to produce output', timeout: 10000 },
  ).not.toBe('');
  return page.locator('#formatted-highlight-code').textContent();
}

async function readAnalysisState(page) {
  return page.evaluate(() => ({
    source: document.querySelector('#source-input').value,
    highlightHTML: document.querySelector('#highlight-code').innerHTML,
    highlightText: document.querySelector('#highlight-code').textContent,
    ast: document.querySelector('#ast-output').textContent,
  }));
}

test('initial load and edits format automatically without a format control', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#runtime-status-text')).toHaveText('Parser ready');
  await expect(page.locator('#diagnostic-count')).toHaveText('0 issues');

  await expect(page.locator('[data-stage]')).toHaveCount(2);
  expect(await page.locator('[data-stage]').evaluateAll(nodes => nodes.map(node => node.dataset.stage))).toEqual([
    'input',
    'format',
  ]);
  await expect(page.locator('#format-button')).toHaveCount(0);
  await expect(page.locator('#formatted-output')).toHaveCount(0);
  await expect(page.locator('#copy-output-button')).toHaveAttribute('data-copy-target', 'formatted-highlight-code');

  const initialSource = await page.locator('#source-input').inputValue();
  await expectSourceHighlight(page, initialSource);
  expect(await waitForFormattedOutput(page)).toMatch(/\n$/);
  await expect(page.locator('#highlight-code .token-string')).not.toHaveCount(0);
  await expect(page.locator('#formatted-highlight-code .token-string')).not.toHaveCount(0);
  await expect(page.locator('#ast-output')).toContainText('logical_expression');

  const editedSource = 'http.host   eq   "example.com"';
  await page.locator('#source-input').fill(editedSource);
  await expect(page.locator('#diagnostic-count')).toHaveText('0 issues');
  await expectSourceHighlight(page, editedSource);
  await expectFormattedOutput(page, 'http.host eq "example.com"\n');
  await expect(page.locator('#highlight-code .token-string')).not.toHaveCount(0);
  await expect(page.locator('#formatted-highlight-code .token-string')).not.toHaveCount(0);
});

test('sample selection, reset, and golden samples format immediately', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#runtime-status-text')).toHaveText('Parser ready');

  for (const sample of ['operators', 'quantifiers', 'ranges']) {
    await page.locator('#sample-select').selectOption(sample);
    await expect(page.locator('#diagnostic-count')).toHaveText('0 issues');
    const source = await page.locator('#source-input').inputValue();
    await expectSourceHighlight(page, source);
    const output = await waitForFormattedOutput(page);
    expect(output).toContain('\n');
    await expect(page.locator('#highlight-code .token-string')).not.toHaveCount(0);
    await expect(page.locator('#formatted-highlight-code .token-string')).not.toHaveCount(0);
  }

  await page.locator('#reset-button').click();
  await expect(page.locator('#sample-select')).toHaveValue('method-and-ip');
  const resetSource = await page.locator('#source-input').inputValue();
  await expectSourceHighlight(page, resetSource);
  expect(await waitForFormattedOutput(page)).toMatch(/\n$/);

  await openFormatterSettings(page);
  const rules = page.locator('#formatting-query');
  const compactRules = compactBooleanQuery(await rules.inputValue());
  await rules.fill(compactRules);
  await page.locator('#indent-size').selectOption('8');
  await page.locator('#sample-select').selectOption('operators');
  await waitForFormattedOutput(page);
  await page.locator('#reset-button').click();
  await expect(page.locator('#sample-select')).toHaveValue('method-and-ip');
  await expect(rules).toHaveValue(compactRules);
  await expect(page.locator('#indent-size')).toHaveValue('8');
  await expectSourceHighlight(page, await page.locator('#source-input').inputValue());
  await waitForFormattedOutput(page);
});

test('invalid source clears formatted output and recovery is automatic', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#runtime-status-text')).toHaveText('Parser ready');

  await page.locator('#sample-select').selectOption('invalid');
  const invalidSource = await page.locator('#source-input').inputValue();
  await expect(page.locator('#diagnostic-count')).toContainText('syntax');
  await expectSourceHighlight(page, invalidSource);
  await expectFormattedOutput(page, '');
  await expect(page.locator('#copy-output-button')).toBeDisabled();

  const validSource = 'http.host eq "recovered.example.com"';
  await page.locator('#source-input').fill(validSource);
  await expect(page.locator('#diagnostic-count')).toHaveText('0 issues');
  await expectSourceHighlight(page, validSource);
  await expectFormattedOutput(page, 'http.host eq "recovered.example.com"\n');
  await expect(page.locator('#copy-output-button')).toBeEnabled();
});

test('rule edits reformat without changing input, highlighting, or AST', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#runtime-status-text')).toHaveText('Parser ready');
  await openFormatterSettings(page);

  const source = 'http.host eq "a" and http.host eq "b"';
  const rules = page.locator('#formatting-query');
  await page.locator('#source-input').fill(source);
  await expect(page.locator('#diagnostic-count')).toHaveText('0 issues');
  const before = await readAnalysisState(page);
  await expectFormattedOutput(page, 'http.host eq "a"\nand http.host eq "b"\n');

  await rules.fill(compactBooleanQuery(await rules.inputValue()));
  await expectFormattedOutput(page, 'http.host eq "a" and http.host eq "b"\n');
  expect(await readAnalysisState(page)).toEqual(before);
  await expect(page.locator('#diagnostic-count')).toHaveText('0 issues');
  await expect(page.locator('#formatted-highlight-code .token-string')).toHaveCount(2);
});

test('indent changes reformat automatically while preserving analysis', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#runtime-status-text')).toHaveText('Parser ready');
  await openFormatterSettings(page);

  const source = '((http.host eq "a" && http.request.method eq "GET") || ip.src eq 192.0.2.1) ^^ http.host eq "b"';
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

  await page.locator('#source-input').fill(source);
  await page.locator('#indent-size').selectOption('2');
  await expectFormattedOutput(page, expected[2]);
  const before = await readAnalysisState(page);

  await page.locator('#indent-size').selectOption('8');
  await expectFormattedOutput(page, expected[8]);
  expect(await readAnalysisState(page)).toEqual(before);
  await expect(page.locator('#highlight-code .token-string')).not.toHaveCount(0);
  await expect(page.locator('#formatted-highlight-code .token-string')).not.toHaveCount(0);
});

test('invalid rules clear formatted output and reset without losing input', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#runtime-status-text')).toHaveText('Parser ready');
  await openFormatterSettings(page);

  const source = 'http.host   eq   "keep this input"';
  const rules = page.locator('#formatting-query');
  const defaultQuery = await rules.inputValue();
  await page.locator('#source-input').fill(source);
  await expectFormattedOutput(page, 'http.host eq "keep this input"\n');

  await rules.fill('(');
  await expect(page.locator('#rules-error')).toBeVisible();
  await expect(page.locator('#rules-error')).not.toHaveText('');
  await expectFormattedOutput(page, '');
  await expect(page.locator('#copy-output-button')).toBeDisabled();
  await expectSourceHighlight(page, source);

  await page.locator('#reset-rules-button').click();
  await expect(rules).toHaveValue(defaultQuery);
  await expect(page.locator('#indent-size')).toHaveValue('4');
  await expect(page.locator('#rules-error')).toBeHidden();
  await expectSourceHighlight(page, source);
  await expectFormattedOutput(page, 'http.host eq "keep this input"\n');
  await expect(page.locator('#copy-output-button')).toBeEnabled();
});

test('hostile HTML literals stay text in the formatted preview', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#runtime-status-text')).toHaveText('Parser ready');

  const source = 'http.host eq "<img src=x onerror=alert(1)><script>alert(2)</script>"';
  await page.locator('#source-input').fill(source);
  await expect(page.locator('#diagnostic-count')).toHaveText('0 issues');
  await expectSourceHighlight(page, source);
  await expectFormattedOutput(page, `${source}\n`);

  const previewHTML = await page.locator('#formatted-highlight-code').evaluate(node => node.innerHTML.toLowerCase());
  expect(previewHTML).not.toContain('<img');
  expect(previewHTML).not.toContain('<script');
  await expect(page.locator('#formatted-highlight-code img, #formatted-highlight-code script')).toHaveCount(0);
});

test('rapid source edits leave the final formatted and highlighted state consistent', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#runtime-status-text')).toHaveText('Parser ready');

  const edits = [
    'http.host eq "first.example.com"',
    'http.host   eq   "second.example.com"',
    'http.host     eq     "final.example.com"',
  ];
  await page.evaluate(values => {
    const input = document.querySelector('#source-input');
    for (const value of values) {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, edits);

  const finalSource = edits.at(-1);
  await expectSourceHighlight(page, finalSource);
  await expectFormattedOutput(page, 'http.host eq "final.example.com"\n');
});

test('mobile panels and controls remain reachable without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('#runtime-status-text')).toHaveText('Parser ready');

  await expect(page.locator('[data-stage]')).toHaveCount(2);
  expect(await page.locator('[data-stage]').evaluateAll(nodes => nodes.map(node => node.dataset.stage))).toEqual([
    'input',
    'format',
  ]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  for (const selector of ['#source-input', '#formatted-highlight-code', '#sample-select', '#reset-button']) {
    const element = page.locator(selector);
    await element.scrollIntoViewIfNeeded();
    await expect(element).toBeVisible();
  }
});

test('details start collapsed and input stays above output in the main column', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/');
  await expect(page.locator('#runtime-status-text')).toHaveText('Parser ready');
  await expect(page.locator('details#formatter-settings, details#syntax-tree')).toHaveCount(2);
  expect(await page.locator('details#formatter-settings, details#syntax-tree').evaluateAll(
    nodes => nodes.every(node => !node.open),
  )).toBe(true);
  const input = await page.locator('[data-stage="input"]').boundingBox();
  const output = await page.locator('[data-stage="format"]').boundingBox();
  expect(input.x).toBe(output.x);
  expect(output.y).toBeGreaterThan(input.y);

  await page.locator('#source-input').fill("foo in ['0::d,e,f']");
  await expectSourceHighlight(page, "foo in ['0::d,e,f']");
  await expect(page.locator('#highlight-code .token-string')).toHaveText("'0::d,e,f'");
  await expect(page.locator('#diagnostic-count')).toContainText('syntax');
  await expectFormattedOutput(page, '');
  await page.locator('#source-input').fill('foo in {"0::d,e,f"}');
  await expectSourceHighlight(page, 'foo in {"0::d,e,f"}');
  await expectFormattedOutput(page, 'foo in { "0::d,e,f" }\n');
});
