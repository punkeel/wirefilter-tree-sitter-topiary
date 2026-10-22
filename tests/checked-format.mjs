import { strict as assert } from 'node:assert';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';

// Simulate a formatter regression independently of the formatting policy.
// In particular, changing and -> or leaves the named-tree shape unchanged.
const root = resolve(import.meta.dirname, '..');
const directory = mkdtempSync(join(tmpdir(), 'wirefilter-integrity-'));
const cases = [
  ['a and b', 'a\nor b\n', false],
  ['body eq "keep me"', 'body eq "KEEP ME"\n', false],
  ['(a)', 'a\n', false],
  ['a', '(a\n', false],
  ['a', 'a\nb\n', false],
  ['a and b', 'a\nand b\n', true],
];
try {
  writeFileSync(join(directory, 'topiary'), '#!/bin/sh\nprintf \'%s\' "$WIREFILTER_TEST_OUTPUT"\n', { mode: 0o755 });
  for (const [source, output, valid] of cases) {
    const result = spawnSync(join(root, 'scripts/format.sh'), [], {
      input: source, encoding: 'utf8',
      env: { ...process.env, PATH: `${directory}:${process.env.PATH}`, WIREFILTER_TEST_OUTPUT: output },
    });
    if (result.error) throw result.error;
    assert.equal(result.status === 0, valid, `${source} -> ${output}: ${result.stderr}`);
    assert.equal(result.stdout, valid ? output : '', 'Unverified output must not reach stdout');
  }
  console.log(`PASS ${cases.length} checked formatter integrity cases`);
} finally { rmSync(directory, { recursive: true, force: true }); }
