import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const grammar = join(root, 'tree-sitter-wirefilter');
const cli = process.env.TREE_SITTER_CLI ?? join(grammar, 'node_modules', '.bin', 'tree-sitter');
const casesPath = join(root, 'tests', 'upstream-conformance', 'cases.json');
const casesFile = JSON.parse(readFileSync(casesPath, 'utf8'));

assert.equal(casesFile.format, 'wirefilter-upstream-conformance/v1');
assert.ok(Array.isArray(casesFile.cases) && casesFile.cases.length > 0);

function normalizeTree(output) {
  return output
    .replace(/\s*\[\d+,\s*\d+\]\s*-\s*\[\d+,\s*\d+\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseCase(file) {
  const result = spawnSync(cli, ['parse', file], {
    cwd: grammar,
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    output: (result.stdout ?? '') + (result.stderr ?? ''),
  };
}

const directory = mkdtempSync(join(tmpdir(), 'wirefilter-upstream-conformance-'));
const failures = [];
let validCount = 0;
let invalidCount = 0;

try {
  for (const testCase of casesFile.cases) {
    const file = join(directory, testCase.id + '.wirefilter');
    writeFileSync(file, testCase.source);
    const result = parseCase(file);
    const hasSyntaxDiagnostic = /\b(?:ERROR|MISSING)\b/.test(result.output);

    if (testCase.kind === 'valid') {
      validCount += 1;
      if (result.status !== 0 || hasSyntaxDiagnostic) {
        failures.push(testCase.id + ': expected Tree-sitter acceptance\n' + result.output);
      } else if (testCase.tree) {
        const actual = normalizeTree(result.stdout);
        const expected = testCase.tree.replace(/\s+/g, ' ').trim();
        if (actual !== expected) {
          failures.push(
            testCase.id +
              ': parse-tree shape changed\nexpected: ' +
              expected +
              '\nactual:   ' +
              actual,
          );
        }
      }
    } else if (testCase.kind === 'invalid') {
      invalidCount += 1;
      if (result.status === 0 || !hasSyntaxDiagnostic) {
        failures.push(testCase.id + ': expected a syntax rejection\n' + result.output);
      }
    } else {
      failures.push(testCase.id + ': unknown case kind ' + JSON.stringify(testCase.kind));
    }
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error(failures.join('\n\n'));
  process.exit(1);
}

console.log(
  'PASS Tree-sitter upstream conformance: ' +
    validCount +
    ' valid and ' +
    invalidCount +
    ' malformed cases',
);
