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
