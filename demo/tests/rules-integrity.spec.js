import { test, expect } from '@playwright/test';

test('rejects stable custom rules that merge tokens or rewrite literals', async ({ page }) => {
  await page.goto('/');
  const results = await page.evaluate(async () => {
    const engine = await import('/assets/engine.js');
    await engine.initialize();
    const failures = [];
    for (const [source, query] of [
      // An empty query produces "aandb", a field instead of a boolean chain.
      ['a and b', ''],
      // Uppercasing is idempotent, but changes the quoted literal's value.
      ['data eq "keep me"', `${engine.defaultFormattingQuery}\n(quoted_string) @upper_case`],
    ]) {
      try { await engine.format(source, {query}); failures.push(null); }
      catch (error) { failures.push(error.message); }
    }
    return { failures, recovered: await engine.format('a and b') };
  });
  for (const message of results.failures) {
    expect(message).toContain('changed expression syntax or token contents');
  }
  expect(results.recovered).toBe('a\nand b\n');
});
