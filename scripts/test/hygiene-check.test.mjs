import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { scanContent } from '../hygiene-check.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const scanner = fileURLToPath(new URL('../hygiene-check.mjs', import.meta.url));
// Generated only in memory / isolated temporary repos. Not a real credential.
const material = ['SYNTHETIC_ONLY_', '7b9D4k8Z2n6P'].join('');
const scan = (content, name = 'src/fixture.ts') => scanContent(name, Buffer.from(content));
const assignments = (content, name) => scan(content, name).filter(f => f.rule === 'assigned-secret');

const ordinary = [
  ['type annotation', 'type Entry = { token: AcquisitionToken; };'],
  ['interface property', 'interface Entry { token: CancellationToken; }'],
  ['function parameter', 'function fence(token: AcquisitionToken, sequence: number) {}'],
  ['method parameter', 'private current(token: AcquisitionToken, sequence?: number) {}'],
  ['local variable', 'const token = store.activate(id, type);'],
  ['local reference', 'let token = cancellationToken;'],
  ['property access', 'const record = { token: entry.token };'],
  ['qualified property', 'entry.token = this.store.activate(id, kind);'],
  ['optional property', 'const token = entry?.cancellationToken;'],
  ['generic argument', 'interface Entry { token: Promise<CancellationToken>; }'],
  ['generic call', 'const token = acquire<CancellationToken>(context);'],
  ['lifecycle fence', "entry.token = this.store.fence(entry.token, connected ? 'UNCERTAIN' : 'DISCONNECTED', connected ? 'AWAITING_FRESH_READ' : 'DEVICE_DISCONNECTED')!;"],
  ['cancellation expression', 'const token = cancellationSource.getToken(signal);'],
  ['typed reference initializer', 'const token: CancellationToken = currentCancellation;'],
  ['test description', "it('token lifecycle stays fenced', () => {});"],
  ['type name', 'type LifecycleToken = CancellationToken;'],
];
for (const [label, code] of ordinary) test(`false positive: ${label}`, () => assert.deepEqual(scan(code), []));

test('all 14 reported findings, and uncapped approved-file contents, are clean', () => {
  // Reproduce the exact old matcher/cap, without retaining any real credential fixture.
  const legacy = /(password|passwd|pwd|secret|token|api[_-]?key|apikey|access[_-]?key|private[_-]?key|client[_-]?secret|auth[_-]?token)["']?\s*[:=]\s*["']?([^\s"',;#]{8,})/i;
  const files = [
    ['server/src/sharedTagAcquisition.ts', [5, 51, 54, 58]],
    ['server/src/tagRuntime.ts', [43, 49, 62, 66, 81]],
    ['server/test/tagRuntime.test.ts', [10, 14, 18, 26, 29]],
  ];
  let total = 0;
  for (const [file, reportedLines] of files) {
    const content = fs.readFileSync(path.join(root, file), 'utf8');
    const oldLines = content.split(/\r?\n/).flatMap((line, i) => legacy.test(line) ? [i + 1] : []).slice(0, 5);
    assert.deepEqual(oldLines, reportedLines); total += oldLines.length;
    assert.deepEqual(scan(content, file), [], file);
  }
  assert.equal(total, 14);
});

const literals = [
  ['quoted token', `const token = '${material}';`],
  ['wrapped opaque literal', `const token = acquire('${material}');`],
  ['nested opaque literal', `const token = acquire(context, '${material}');`],
  ['uppercase direct assignment', `const token = '${['SYNTHETIC', 'UPPERCASE', 'MATERIAL'].join('_')}';`],
  ['quoted password', `const password = "${material}";`],
  ['template literal', 'const token = `' + material + '`;'],
  ['object property', `const config = { token: '${material}' };`],
  ['property assignment', `config.token = '${material}';`],
  ['typed initializer', `const token: string = '${material}';`],
  ['long typed initializer', `const token: CredentialValue = '${material}';`],
  ['typed default parameter', `function connect(token: string = '${material}') {}`],
  ['literal union member', `type Settings = { token: '${material}' };`],
  ['after harmless candidate', `const token = store.activate(id); const password = '${material}';`],
  ['comment assignment', `// password = '${material}'`],
  ['test file literal', `it('guard', () => { const token = '${material}'; });`, 'server/test/fixture.test.ts'],
];
for (const [label, code, file] of literals) test(`true positive: ${label}`, () => {
  const findings = assignments(code, file); assert.equal(findings.length, 1);
  assert.equal(findings[0].line, 1); assert.equal(findings[0].path, file ?? 'src/fixture.ts');
  assert.ok(!findings[0].evidence.includes(material), 'evidence stays masked');
});

const configurations = [
  ['JSON', `{"token":"${material}"}`, 'config/settings.json'],
  ['YAML', `auth_token: ${material}`, 'config/settings.yaml'],
  ['environment', `ACCESS_TOKEN=${material}`, '.env'],
  ['shell', `export API_KEY=${material}`, 'scripts/config.sh'],
  ['INI', `password=${material}`, 'config/settings.ini'],
  ['TOML', `client_secret="${material}"`, 'config/settings.toml'],
  ['Markdown', `token: ${material}`, 'docs/fixture.md'],
  ['code-looking env value', 'ACCESS_TOKEN=store.activate(id)', '.env'],
  // Assemble the synthetic value at runtime so this test source is not itself a credential fixture.
  ['type-looking JSON value', JSON.stringify({ token: ['Acquisition', 'Token'].join('') }), 'config/settings.json'],
];
for (const [label, code, file] of configurations) test(`sensitive configuration: ${label}`, () => assert.equal(assignments(code, file).length, 1));

// Exercise every pre-existing non-assignment credential rule. Split synthetic prefixes
// prevent committed test source from itself containing credential-shaped material.
const known = [
  ['private-key-block', ['-----BEGIN ', 'PRIVATE KEY-----'].join('')],
  ['aws-access-key', ['AK', 'IA', 'Z'.repeat(16)].join('')],
  ['github-token', ['gh', 'p_', 'Z'.repeat(24)].join('')],
  ['github-token', ['github_', 'pat_', 'Z'.repeat(35)].join('')],
  ['slack-token', ['xo', 'xb-', 'Z'.repeat(18)].join('')],
  ['google-api-key', ['AI', 'za', 'Z'.repeat(35)].join('')],
  ['provider-api-key', ['s', 'k-', 'Z'.repeat(24)].join('')],
  ['provider-api-key', ['s', 'k-ant-', 'Z'.repeat(24)].join('')],
  ['provider-api-key', ['r', 'k_live_', 'Z'.repeat(20)].join('')],
  ['jwt', ['ey', 'J', 'Z'.repeat(12), '.', 'ey', 'J', 'Z'.repeat(12), '.', 'Z'.repeat(12)].join('')],
  ['credentialed-url', ['https://', 'synthetic-user', ':', material, '@invalid.invalid'].join('')],
];
for (const [index, [rule, value]] of known.entries()) test(`embedded credential rule ${index + 1}: ${rule}`, () => {
  // The ordinary call must NOT hide embedded credential material from the other rules.
  for (const file of ['src/fixture.ts', 'server/test/fixture.test.ts', 'docs/fixture.md', 'config/settings.yaml']) {
    assert.ok(scan(`const token = acquire("${value}");`, file).some(f => f.rule === rule), file);
  }
});

test('existing placeholders remain placeholders, not a new test-file allowlist', () => {
  for (const value of ['your-secret-here', 'REDACTED', '${TOKEN}', 'process.env.ACCESS_TOKEN']) {
    assert.deepEqual(assignments(`token = "${value}"`), []);
  }
  assert.equal(assignments(`token = "${material}"`, 'server/test/fixture.test.ts').length, 1);
});

test('multiple candidates, determinism, original path/line and bounded findings', () => {
  const code = ['// ordinary header', 'const token = entry.token;', `const password = '${material}'; const apiKey = '${material}';`].join('\n');
  const first = scan(code); assert.equal(first.length, 2);
  assert.ok(first.every(f => f.line === 3 && f.path === 'src/fixture.ts'));
  assert.deepEqual(scan(code), first);
  assert.equal(assignments(Array(8).fill(`const password = '${material}';`).join('\n')).length, 5);
});

test('CLI strict remains blocking; same file can be clean code or a detected credential', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mws-hygiene-test-'));
  try {
    execFileSync('git', ['init', '--quiet', directory]);
    const file = path.join(directory, 'fixture.ts');
    const cli = (...args) => spawnSync(process.execPath, [scanner, '--worktree', '--json', ...args], { cwd: directory, encoding: 'utf8' });
    fs.writeFileSync(file, ordinary.map(([, code]) => code).join('\n'));
    const clean = cli('--strict'); assert.equal(clean.status, 0, clean.stderr); assert.equal(JSON.parse(clean.stdout).errors, 0);
    fs.appendFileSync(file, `\nconst token = '${material}';\n`);
    const regular = cli(); assert.equal(regular.status, 0); assert.equal(JSON.parse(regular.stdout).warnings, 1);
    const strict = cli('--strict'), again = cli('--strict');
    assert.equal(strict.status, 1); assert.equal(strict.stdout, again.stdout);
    const result = JSON.parse(strict.stdout); assert.equal(result.errors, 1); assert.equal(result.warnings, 0);
    assert.equal(result.findings[0].path, 'fixture.ts'); assert.equal(result.findings[0].line, ordinary.length + 1);
    assert.equal(result.findings[0].severity, 'error'); assert.ok(!strict.stdout.includes(material));
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});


test('regression test source is scanned too; synthetic fixtures require no exclusions', () => {
  const relative = 'scripts/test/hygiene-check.test.mjs';
  assert.deepEqual(scan(fs.readFileSync(path.join(root, relative), 'utf8'), relative), []);
});


// Dev.12: counter-expression fixtures are synthetic code, never actual credentials.
const counters = [
  ['prefix increment', '++this.request'],
  ['prefix with whitespace', '++ this.request'],
  ['postfix increment', 'this.request++'],
  ['postfix with whitespace', 'this.request ++'],
  ['arithmetic counter', 'counter + 1'],
  ['qualified arithmetic counter', 'this.request + 1'],
  ['compact arithmetic counter', 'this.request+1'],
  ['arithmetic subtraction', 'generationCounter - 1'],
  ['function-call expression', 'getGeneration()'],
  ['method-call expression', 'this.getGeneration(context)'],
  ['property expression', 'this.request'],
  ['cancellation-token expression', 'cancellationSource.getToken(signal)'],
];
const assignmentCode = expression => ['const to', 'ken = ', expression, ';'].join('');
for (const [label, expression] of counters) test(`dev.12 ordinary syntax: ${label}`, () => {
  for (const extension of ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'mts', 'cts']) {
    assert.deepEqual(scan(assignmentCode(expression), `src/lifecycle.${extension}`), []);
  }
});

test('dev.12 typed counter initializers and object counter properties are clean', () => {
  for (const [, expression] of counters) {
    assert.deepEqual(scan(`const token: GenerationCounter = ${expression};`), []);
    assert.deepEqual(scan(`const state = { token: ${expression} };`), []);
  }
});

test('dev.12 approved Catalog generation counter and entire file scan clean without edits', () => {
  const relative = 'client/src/lib/overviewCatalog.ts';
  const content = fs.readFileSync(path.join(root, relative), 'utf8');
  assert.equal(content.split(/\r?\n/)[35].trim(), assignmentCode('++this.request'));
  assert.deepEqual(scan(content, relative), []);
});

for (const [label, expression] of counters.slice(0, 8)) test(`dev.12 quoted counter-shaped value still detected: ${label}`, () => {
  for (const quote of ["'", '"', '`']) {
    const findings = assignments(assignmentCode(quote + expression.replace(/\s+/g, '') + quote));
    assert.equal(findings.length, 1); assert.equal(findings[0].line, 1);
  }
});

const counterLiterals = [
  ['typed opaque initializer', `const token: GenerationCounter = '${material}';`],
  ['counter followed by credential assignment', assignmentCode('++this.request') + ` const password = '${material}';`],
  ['postfix followed by credential assignment', assignmentCode('this.request++') + ` const apiKey = '${material}';`],
  ['prefix plus literal', assignmentCode(`++this.request + '${material}'`)],
  ['postfix plus literal', assignmentCode(`this.request++ + '${material}'`)],
  ['arithmetic plus literal', assignmentCode(`this.request + 1 + '${material}'`)],
  ['arithmetic with literal', assignmentCode(`this.request + '${material}'`)],
  ['indexed reference literal', assignmentCode(`this.request['${material}']`)],
  ['opaque call argument', assignmentCode(`getGeneration('${material}')`)],
];
for (const [label, code] of counterLiterals) test(`dev.12 conservative literal guard: ${label}`, () => {
  for (const file of ['src/counter.ts', 'server/test/counter.test.ts']) assert.ok(assignments(code, file).length > 0, file);
});

test('dev.12 counter-like sensitive configuration remains detected, not source-exempt', () => {
  for (const expression of ['++this.request', 'this.request++', 'this.request+1', 'getGeneration()']) {
    for (const file of ['settings.json', 'settings.yaml', '.env', 'settings.ini', 'settings.toml', 'settings.sh', 'notes.md']) {
      assert.equal(assignments(['token', '=', expression].join(''), file).length, 1, file);
    }
  }
});

test('dev.12 independent embedded-provider rules still inspect counter lines', () => {
  for (const [rule, value] of known) {
    assert.ok(scan(assignmentCode('++this.request') + ` const embedded = "${value}";`).some(f => f.rule === rule), rule);
  }
});

test('dev.12 useful deterministic finding locations after counter lines', () => {
  const lines = [assignmentCode('++this.request'), assignmentCode('this.request++'), assignmentCode('this.request + 1'), assignmentCode(`'${material}'`)];
  const code = lines.join('\n'), first = scan(code, 'src/generation.ts');
  assert.equal(first.length, 1); assert.equal(first[0].path, 'src/generation.ts'); assert.equal(first[0].line, 4);
  assert.deepEqual(scan(code, 'src/generation.ts'), first); assert.ok(!first[0].evidence.includes(material));
});

test('dev.12 strict worktree CLI includes untracked counters and still blocks credentials', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mws-counter-scan-'));
  try {
    execFileSync('git', ['init', '--quiet', directory]);
    const file = path.join(directory, 'generation.ts');
    const cli = () => spawnSync(process.execPath, [scanner, '--worktree', '--strict', '--json'], { cwd: directory, encoding: 'utf8' });
    fs.writeFileSync(file, counters.map(([, expression]) => assignmentCode(expression)).join('\n'));
    const clean = cli(); assert.equal(clean.status, 0, clean.stderr);
    assert.equal(JSON.parse(clean.stdout).filesChecked, 1); assert.equal(JSON.parse(clean.stdout).errors, 0);
    fs.appendFileSync(file, '\n' + assignmentCode(`'${material}'`));
    const rejected = cli(); assert.equal(rejected.status, 1); const report = JSON.parse(rejected.stdout);
    assert.equal(report.errors, 1); assert.equal(report.warnings, 0); assert.equal(report.findings[0].severity, 'error');
    assert.equal(report.findings[0].line, counters.length + 1); assert.ok(!rejected.stdout.includes(material));
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
