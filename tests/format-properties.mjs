import { strict as assert } from 'node:assert';
import { mkdtempSync, writeFileSync, rmSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { generatedExpressions } from './generated-expressions.mjs';

const root = resolve(import.meta.dirname, '..');
const grammar = join(root, 'tree-sitter-wirefilter');
const cli = join(grammar, 'node_modules/.bin/tree-sitter');
const formatter = join(root, 'target/debug/wirefilter-fmt');
const directory = mkdtempSync(join(tmpdir(), 'wirefilter-properties-'));
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, ...options });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${command}: ${result.stderr}\n${result.stdout}`);
  return result.stdout;
}
function signature(source) {
  const path = join(directory, 'case.wirefilter');
  writeFileSync(path, source);
  return run(cli, ['parse', '--cst', '--no-ranges', path], { cwd: grammar });
}
const cases = [...generatedExpressions, ...readdirSync(join(root, 'fixtures')).map(name => ({
  name, source: readFileSync(join(root, 'fixtures', name), 'utf8'),
}))];
try {
  for (const { name, source } of cases) {
    const output = run(formatter, [], { input: source });
    assert.equal(signature(output), signature(source), `${name}: concrete tree/token change`);
    const twice = run(formatter, [], { input: output });
    assert.equal(output, twice, `${name}: unstable formatting`);
    assert.ok(output.endsWith('\n'), `${name}: missing final newline`);
  }
  console.log(`PASS ${cases.length} generated/fixture native formatter cases (tree, tokens, idempotence)`);
} finally { rmSync(directory, { recursive: true, force: true }); }
