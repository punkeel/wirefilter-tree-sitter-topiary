import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const casesFile = JSON.parse(readFileSync(
  fileURLToPath(new URL('../../tests/upstream-conformance/cases.json', import.meta.url)),
  'utf8',
));
const conformanceCases = casesFile.cases;
const validCases = conformanceCases.filter(({ kind }) => kind === 'valid');
const invalidCases = conformanceCases.filter(({ kind }) => kind === 'invalid');

async function enginePage(page) {
  await page.goto('/');
  await page.evaluate(async () => {
    window.engine = await import('/assets/engine.js');
    await window.engine.initialize();
  });
}

test('upstream valid cases analyze cleanly and format stably', async ({ page }) => {
  await enginePage(page);
  const failures = await page.evaluate(async cases => {
    const failures = [];
    for (const { id, source } of cases) {
      try {
        const analysis = window.engine.analyze(source);
        if (analysis.diagnostics.length) {
          failures.push(`${id}: source diagnostics: ${JSON.stringify(analysis.diagnostics)}`);
        }

        const formatted = await window.engine.format(source);
        const formattedAnalysis = window.engine.analyze(formatted);
        if (formattedAnalysis.diagnostics.length) {
          failures.push(`${id}: formatted diagnostics: ${JSON.stringify(formattedAnalysis.diagnostics)}`);
          continue;
        }

        const twice = await window.engine.format(formatted);
        if (twice !== formatted) failures.push(`${id}: formatting is not idempotent`);
      } catch (error) {
        failures.push(`${id}: ${error.message || error}`);
      }
    }
    return failures;
  }, validCases);

  expect(failures).toEqual([]);
});

test('upstream invalid cases analyze with diagnostics and formatting rejects', async ({ page }) => {
  await enginePage(page);
  const failures = await page.evaluate(async cases => {
    const failures = [];
    for (const { id, source } of cases) {
      try {
        const analysis = window.engine.analyze(source);
        if (!analysis.diagnostics.length) {
          failures.push(`${id}: expected diagnostics`);
        }

        let rejected = false;
        try { await window.engine.format(source); }
        catch { rejected = true; }
        if (!rejected) failures.push(`${id}: formatting unexpectedly succeeded`);
      } catch (error) {
        failures.push(`${id}: ${error.message || error}`);
      }
    }
    return failures;
  }, invalidCases);

  expect(failures).toEqual([]);
});

test('highlights regex literals, including quotes inside character classes', async ({ page }) => {
  await enginePage(page);
  const regexCases = conformanceCases.filter(({ id, kind }) => kind === 'valid' && id.startsWith('quoted-regex-'));
  expect(regexCases.length).toBeGreaterThan(0);

  const results = await page.evaluate(cases => cases.map(({ id, source }) => ({
    id,
    source,
    ...window.engine.analyze(source),
  })), regexCases);

  for (const result of results) {
    expect(result.diagnostics, result.id).toEqual([]);
    const stringSpans = result.html.match(/<span class="token-string">([\s\S]*?)<\/span>/g) ?? [];
    expect(stringSpans, result.id).toHaveLength(1);
    expect(stringSpans[0], result.id).toContain('&quot;');
  }
});

test('incremental regex character-class edits match a fresh parse', async ({ page }) => {
  await enginePage(page);
  const result = await page.evaluate(async () => {
    const Parser = window.TreeSitter;
    const language = await Parser.Language.load('/tree-sitter-wirefilter.wasm');
    const parser = new Parser();
    parser.setLanguage(language);
    let source = 'bytes matches "[abc]" and bytes eq "tail"';
    let tree = parser.parse(source);
    const edits = [
      [String.raw`[abc]`, String.raw`[abc`],
      [String.raw`[abc`, String.raw`[abc]`],
      [String.raw`[abc]`, String.raw`[a"bc]`],
      [String.raw`[a"bc]`, String.raw`[a\"bc]`],
      [String.raw`[a\"bc]`, String.raw`[a\]bc]`],
      [String.raw`[a\]bc]`, String.raw`[abc]`],
    ];
    const point = (text, index) => {
      const lines = text.slice(0, index).split('\n');
      return { row: lines.length - 1, column: lines.at(-1).length };
    };
    const signature = root => {
      const result = [];
      const pending = [root];
      while (pending.length) {
        const node = pending.pop();
        result.push([node.type, node.startIndex, node.endIndex, node.isMissing(), node.text]);
        pending.push(...node.children.toReversed());
      }
      return JSON.stringify(result);
    };

    try {
      for (const [before, after] of edits) {
        const startIndex = source.indexOf(before);
        if (startIndex < 0) throw new Error(`Missing edit target: ${before}`);
        const next = source.slice(0, startIndex) + after + source.slice(startIndex + before.length);
        tree.edit({
          startIndex,
          oldEndIndex: startIndex + before.length,
          newEndIndex: startIndex + after.length,
          startPosition: point(source, startIndex),
          oldEndPosition: point(source, startIndex + before.length),
          newEndPosition: point(next, startIndex + after.length),
        });
        const incremental = parser.parse(next, tree);
        const fresh = parser.parse(next);
        try {
          if (incremental.rootNode.hasError() !== fresh.rootNode.hasError()) {
            throw new Error(`Incremental error status differs after ${before} -> ${after}`);
          }
          if (!fresh.rootNode.hasError() && signature(incremental.rootNode) !== signature(fresh.rootNode)) {
            throw new Error(`Incremental tree differs after ${before} -> ${after}`);
          }
        } finally {
          fresh.delete();
          tree.delete();
        }
        source = next;
        tree = incremental;
      }
    } finally {
      tree.delete();
      parser.delete();
    }
    return true;
  });

  expect(result).toBe(true);
});
