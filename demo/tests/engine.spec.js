import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Import the production engine entry in a real browser, including both WASM
// runtimes. Browser output must match the native Topiary golden byte for byte.
async function enginePage(page) {
  await page.goto('/');
  await page.evaluate(async () => {
    window.engine = await import('/assets/engine.js');
    await window.engine.initialize();
  });
}

test('highlights safely, parses Unicode and reports ERROR and missing nodes', async ({ page }) => {
  await enginePage(page);
  const valid = await page.evaluate(() => window.engine.analyze('http.host eq "<img src=x onerror=alert(1)> café 🐈"'));
  expect(valid.diagnostics).toEqual([]);
  expect(valid.html).toContain('token-string');
  expect(valid.html).toContain('&lt;img');
  expect(valid.html).not.toContain('<img');
  expect(valid.ast).toContain('comparison_expression');
  for (const input of ['(http.host eq "x"', 'http.host eq', 'http.host eq "unterminated', '', 'a in {1, 2}', 'x contains r#"a"##', 'x contains r"a"#']) {
    const result = await page.evaluate(input => window.engine.analyze(input), input);
    expect(result.diagnostics.length, input).toBeGreaterThan(0);
    expect(result.diagnostics[0].line).toBeGreaterThan(0);
    expect(result.diagnostics[0].column).toBeGreaterThan(0);
    await expect(page.evaluate(input => window.engine.format(input), input)).rejects.toThrow();
  }
});

const fixtureDir = fileURLToPath(new URL('../../tests/', import.meta.url));
for (const file of readdirSync(fixtureDir).filter(file => file.endsWith('.input.wirefilter'))) {
  test(`browser Topiary matches native golden: ${file}`, async ({ page }) => {
    await enginePage(page);
    const input = readFileSync(`${fixtureDir}/${file}`, 'utf8');
    const expected = readFileSync(`${fixtureDir}/${file.replace('.input.', '.expected.')}`, 'utf8');
    const output = await page.evaluate(input => window.engine.format(input), input);
    expect(output).toBe(expected);
    expect(await page.evaluate(input => window.engine.format(input), output)).toBe(output);
    expect((await page.evaluate(input => window.engine.analyze(input), output)).diagnostics).toEqual([]);
  });
}
