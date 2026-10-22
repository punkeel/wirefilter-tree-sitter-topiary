import { strict as assert } from 'node:assert';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const grammar = resolve('tree-sitter-wirefilter');
const cli = join(grammar, 'node_modules/.bin/tree-sitter');
const directory = mkdtempSync(join(tmpdir(), 'wirefilter-scanner-'));
const raw = (hashes, body) => `r${'#'.repeat(hashes)}"${body}"${'#'.repeat(hashes)}`;
const cases = [
  ['plain raw', `x contains ${raw(0, 'hello')}`, true],
  ['spaced raw', `x contains \r\n ${raw(2, 'a"#b')}`, true],
  ['maximum delimiter', `x contains ${raw(255, 'hello')}`, true],
  ['excess opening hashes', `x contains ${raw(256, 'hello')}`, false],
  ['trailing raw hashes', 'x contains r#"hello"##', false],
  ['trailing plain hashes', 'x contains r"hello"#', false],
  ['unterminated raw', 'x contains r##"hello"#', false],
  ['raw NUL byte', `x contains ${raw(1, 'a\0b')}`, true],
  ['raw Unicode', `x contains ${raw(2, '雪 🦊 "# café')}`, true],
  ['quoted NUL byte', 'x contains "a\0b"', true],
  ['quoted NUL map key', 'headers["a\0b"] eq "x"', true],
  ['quoted control characters', 'x contains "a\r\n\tb"', true],
  ['empty quoted string', 'x eq ""', true],
  ['octal byte maximum', String.raw`x eq "\377"`, true],
  ['overflow octal byte', String.raw`x eq "\400"`, false],
  ['overflow octal byte maximum', String.raw`x eq "\777"`, false],
  ['short octal byte', String.raw`x eq "\37"`, false],
  ['short hex byte', String.raw`x eq "\x1"`, false],
  ['invalid ordinary escape', String.raw`x eq "\d"`, false],
  ['regex escape', String.raw`x matches "\d+\s"`, true],
  ['regex NUL byte', 'x matches "a\0b"', true],
  ['regex quote in class', 'x matches "["a-z]+"', true],
  ['regex escaped class close', String.raw`x ~ "[a-z\]]+"`, true],
  ['unterminated regex class', 'x matches "[abc"', false],
  ['NUL outside literal', 'x\0', false],
  ['tab before raw', `x contains\t${raw(1, 'hello')}`, false],
];
try {
  for (const [name, source, valid] of cases) {
    const path = join(directory, 'case.wirefilter');
    writeFileSync(path, source);
    const result = spawnSync(cli, ['parse', '--quiet', path], { cwd: grammar, encoding: 'utf8' });
    if (result.error) throw result.error;
    assert.equal(result.status === 0, valid, `${name}: ${result.stdout}\n${result.stderr}`);
  }
  console.log(`PASS ${cases.length} literal scanner boundary cases`);
} finally { rmSync(directory, {recursive: true, force: true}); }
