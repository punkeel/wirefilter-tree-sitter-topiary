import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { generatedExpressions } from '../../tests/generated-expressions.mjs';

const configuration = fileURLToPath(new URL('../../topiary/languages.ncl', import.meta.url));

test('generated expressions preserve the concrete tree and every token in native and WASM formatting', async ({ page }) => {
  const native = generatedExpressions.map(({ name, source }) => {
    const result = spawnSync('topiary', ['-C', configuration, 'format', '--language', 'wirefilter'], {
      input: source, encoding: 'utf8',
    });
    expect(result.status, `${name}: ${result.stderr}`).toBe(0);
    return result.stdout;
  });
  await page.goto('/');
  const outputs = await page.evaluate(async cases => {
    const engine = await import('/assets/engine.js');
    await engine.initialize();
    const outputs = [];
    for (const { name, source } of cases) {
      try {
        const output = await engine.format(source);
        const twice = await engine.format(output);
        if (output !== twice) throw new Error('Non-idempotent output');
        outputs.push(output);
      } catch (error) { throw new Error(`${name}: ${error.message}`); }
    }
    return outputs;
  }, generatedExpressions);
  expect(outputs).toEqual(native);
});

test('incremental edits recover raw-string delimiters and match a fresh parse', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const engine = await import('/assets/engine.js');
    await engine.initialize();
    const Parser = window.TreeSitter;
    const language = await Parser.Language.load('/tree-sitter-wirefilter.wasm');
    const parser = new Parser();
    parser.setLanguage(language);
    let source = 'body eq r##"雪 🐈 "# tail"## and enabled';
    let tree = parser.parse(source);
    const point = (text, index) => {
      const lines = text.slice(0, index).split('\n');
      return { row: lines.length - 1, column: lines.at(-1).length };
    };
    function signature(root) {
      const result = [];
      const pending = [root];
      while (pending.length) {
        const node = pending.pop();
        result.push([node.type, node.startIndex, node.endIndex, node.isMissing(), node.text]);
        pending.push(...node.children.toReversed());
      }
      return JSON.stringify(result);
    }
    const diagnostics = [];
    // Remove and repair delimiters, change Unicode/multiline contents, then
    // switch between raw/quoted literals and an indexed reference.
    const edits = [
      ['"## and', '"# and'], ['"# and', '"## and'],
      ['雪 🐈', '雪\n🐈\0'], ['"## and', '"### and'],
      ['"### and', '"## and'], ['r##"', 'r###"'],
      ['"## and', '"### and'], ['r###"', 'r##"'],
      ['"### and', '"## and'], [' and enabled', ' or not enabled'],
      ['r##"雪\n🐈\0 "# tail"##', '"quoted 雪 🐈"'],
      ['"quoted 雪 🐈"', 'headers["x"]'],
    ];
    try {
      for (const [before, after] of edits) {
        const startIndex = source.indexOf(before);
        if (startIndex < 0) throw new Error(`Missing edit target: ${before}`);
        const next = source.slice(0, startIndex) + after + source.slice(startIndex + before.length);
        tree.edit({
          startIndex, oldEndIndex: startIndex + before.length, newEndIndex: startIndex + after.length,
          startPosition: point(source, startIndex),
          oldEndPosition: point(source, startIndex + before.length),
          newEndPosition: point(next, startIndex + after.length),
        });
        const incremental = parser.parse(next, tree);
        const fresh = parser.parse(next);
        try {
          if (incremental.rootNode.hasError() !== fresh.rootNode.hasError()) throw new Error('Incremental error status differs');
          if (!fresh.rootNode.hasError() && signature(incremental.rootNode) !== signature(fresh.rootNode)) {
            throw new Error('Incremental tree differs');
          }
          diagnostics.push(fresh.rootNode.hasError());
        } finally { fresh.delete(); tree.delete(); }
        source = next;
        tree = incremental;
      }
    } finally { tree.delete(); parser.delete(); }
    return diagnostics;
  });
  expect(result).toEqual([true, false, false, true, false, true, false, true, false, false, false, false]);
});
