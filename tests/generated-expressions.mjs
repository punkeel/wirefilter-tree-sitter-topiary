// Deterministic structural combinations, shared by native and browser checks.
// These exercise syntax; field/function names are not a Wirefilter Scheme.
const atoms = [
  ['enabled'],
  ['http.host', 'eq', '"café 🐈 <tag>"'],
  ['body', 'contains', 'r##"keep  \n spacing "# 雪"##'],
  ['body', 'eq', '"keep\r\n\tbytes"'],
  ['body', 'eq', 'r#"keep\0bytes"#'],
  ['body', 'eq', String.raw`"\000\177\377\x00\xff\"\\"`],
  ['port', 'in', '{', '-20..-10', '0', '077', '0xff', '}'],
  ['ip.src', 'in', '{', '::1', '2001:db8::/32', '192.0.2.1..192.0.2.9', '}'],
  ['headers["x"][*]', 'strict wildcard', 'r"*x*"'],
  ['body', 'contains', '01:ab:ff'],
  ['ip.src', 'in', '$office.ips'],
  ['lower', '(', 'http.host', ')', 'eq', '"example.com"'],
  ['port', 'bitwise_and', '0xff'],
];
let state = 0x51a7;
function choose(size) {
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  return state % size;
}
function expression(depth) {
  if (!depth) return atoms[choose(atoms.length)];
  switch (choose(5)) {
    case 0: return ['(', ...expression(depth - 1), ')'];
    case 1: return [choose(2) ? 'not' : '!', ...expression(depth - 1)];
    case 2: return ['f', '(', ...expression(depth - 1), ',', ...expression(depth - 1), ')'];
    default: return [...expression(depth - 1), ['and', 'or', 'xor', '&&', '||', '^^'][choose(6)], ...expression(depth - 1)];
  }
}
const cases = atoms.map((tokens, i) => ({ name: `literal-${i}`, source: tokens.join(' ') }));
for (let i = 0; i < 48; i++) {
  const tokens = expression(1 + i % 4);
  cases.push({ name: `combination-${i}`, source: tokens.join(i % 3 ? '  ' : ' \r\n ') });
}
export const generatedExpressions = cases;
