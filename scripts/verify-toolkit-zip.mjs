#!/usr/bin/env node
/**
 * Re-verifies release/hygiene-toolkit.zip before it is handed to anyone.
 *
 * Checks performed, in order:
 *   1. Archive passes `unzip -t` (no corrupt entries).
 *   2. Every expected path is present, and nothing unexpected (runtime data, secrets,
 *      node_modules, build output) is inside.
 *   3. Every file is non-empty and listed in MANIFEST.sha256.txt, and every manifest
 *      hash matches the extracted bytes.
 *   4. JavaScript files pass `node --check`; hook scripts pass `sh -n`; the workflow YAML parses.
 *   5. The hygiene scanner reports no critical file or credential in the payload.
 *   6. The structure and the archive SHA-256 are printed.
 *
 * Usage:
 *   node scripts/verify-toolkit-zip.mjs
 *
 * Exit code 0 means the archive is safe to publish.
 */

import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const ARCHIVE_RELATIVE = path.join('release', 'hygiene-toolkit.zip');
const ROOT_FOLDER = 'modbus-workflow-studio-hygiene-toolkit';

const REQUIRED_FILES = [
  '.gitattributes',
  '.githooks/pre-commit',
  '.githooks/pre-push',
  '.github/workflows/hygiene.yml',
  '.gitignore',
  'MANIFEST.sha256.txt',
  'START-HERE.md',
  'docs/CLEAN_HISTORY_PUSH_RUNBOOK.md',
  'docs/CLEAN_HISTORY_PUSH_RUNBOOK_TH.md',
  'docs/OPTIONAL-DOC-UPDATES.md',
  'scripts/apply-toolkit.mjs',
  'scripts/build-toolkit-zip.mjs',
  'scripts/hygiene-check.mjs',
  'scripts/install-hooks.mjs',
  'scripts/prepare-clean-history.mjs',
  'scripts/untrack-runtime-data.mjs',
  'scripts/verify-toolkit-zip.mjs',
];

const FORBIDDEN_GLOBS = [
  /^node_modules\//,
  /\/node_modules\//,
  /(^|\/)\.env$/,
  /(^|\/)\.env\./,
  /\.tsbuildinfo$/,
  /(^|\/)dist\//,
  /(^|\/)coverage\//,
  /(^|\/)server\/data\/(?!\.gitkeep$)/,
  /(^|\/)data\/(?!\.gitkeep$)/,
  /\.zip$/,
  /\.pem$/,
  /\.key$/,
  /(^|\/)\.git\//,
];

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  process.stdout.write(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}\n`);
}

function isMissingModule(result) {
  return /Cannot find module/.test(`${result.stderr ?? ''}${result.stdout ?? ''}`);
}

/** Structural fallback when no YAML parser is installed in this environment. */
function checkWorkflowStructure(workflowPath) {
  const text = fs.readFileSync(workflowPath, 'utf8');
  if (/\t/.test(text)) return false;
  const required = [/^name:/m, /^on:/m, /^jobs:/m, /^\s+runs-on:\s*ubuntu-latest$/m, /^\s{6}- name:/m];
  return required.every((pattern) => pattern.test(text));
}

function walk(directory, prefix = '') {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...walk(path.join(directory, entry.name), relative));
    else files.push(relative);
  }
  return files;
}

function main() {
  const root = process.cwd();
  const archivePath = path.join(root, ARCHIVE_RELATIVE);
  process.stdout.write(`Verifying ${ARCHIVE_RELATIVE}\n\n`);

  if (!fs.existsSync(archivePath)) {
    process.stderr.write(`verify-toolkit-zip: ${ARCHIVE_RELATIVE} does not exist. Run scripts/build-toolkit-zip.mjs first.\n`);
    process.exit(1);
  }

  const archiveBuffer = fs.readFileSync(archivePath);
  const archiveSha = crypto.createHash('sha256').update(archiveBuffer).digest('hex');

  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'mws-verify-'));
  try {
    process.stdout.write('1. Archive integrity\n');
    const integrity = spawnSync('unzip', ['-t', archivePath], { encoding: 'utf8' });
    check('unzip -t reports no errors', integrity.status === 0, `${archiveBuffer.length} bytes`);

    const extraction = spawnSync('unzip', ['-q', archivePath, '-d', scratch], { encoding: 'utf8' });
    if (extraction.status !== 0) {
      check('extract archive', false, extraction.stderr?.trim());
      return finish(archiveSha);
    }
    check('extract archive', true);

    const payloadRoot = path.join(scratch, ROOT_FOLDER);
    if (!fs.existsSync(payloadRoot)) {
      check(`payload folder ${ROOT_FOLDER}/`, false, 'expected root folder not found');
      return finish(archiveSha);
    }
    const files = walk(payloadRoot);
    const relativeFiles = files.map((file) => file.split(path.sep).join('/'));

    process.stdout.write('\n2. Contents\n');
    const missing = REQUIRED_FILES.filter((required) => !relativeFiles.includes(required));
    check('every expected file is present', missing.length === 0, missing.length ? `missing: ${missing.join(', ')}` : `${relativeFiles.length} files`);
    check('scripts/untrack-runtime-data.mjs is included', relativeFiles.includes('scripts/untrack-runtime-data.mjs'));

    const forbidden = relativeFiles.filter((file) => FORBIDDEN_GLOBS.some((pattern) => pattern.test(file)));
    check('no runtime data, secrets, or build output', forbidden.length === 0, forbidden.join(', '));

    const empty = relativeFiles.filter((file) => fs.statSync(path.join(payloadRoot, file)).size === 0);
    check('no empty files', empty.length === 0, empty.join(', '));

    process.stdout.write('\n3. Per-file checksums\n');
    const manifestPath = path.join(payloadRoot, 'MANIFEST.sha256.txt');
    const manifest = fs.readFileSync(manifestPath, 'utf8').split('\n').filter((line) => line && !line.startsWith('#'));
    const manifestEntries = new Map(
      manifest.map((line) => {
        const [hash, name] = line.split(/\s{2,}/);
        return [name, hash];
      }),
    );
    const mismatched = [];
    const notListed = [];
    for (const file of relativeFiles) {
      if (file === 'MANIFEST.sha256.txt') continue;
      const expected = manifestEntries.get(file);
      if (!expected) {
        notListed.push(file);
        continue;
      }
      const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(payloadRoot, file))).digest('hex');
      if (actual !== expected) mismatched.push(file);
    }
    const wrongCount = [...manifestEntries.keys()].filter((name) => !relativeFiles.includes(name));
    check('every file is listed in the manifest', notListed.length === 0, notListed.join(', '));
    check('every manifest hash matches', mismatched.length === 0, mismatched.join(', '));
    check('manifest lists no extra file', wrongCount.length === 0, wrongCount.join(', '));

    process.stdout.write('\n4. Syntax\n');
    const scripts = relativeFiles.filter((file) => file.endsWith('.mjs'));
    const scriptFailures = scripts.filter((file) => spawnSync(process.execPath, ['--check', path.join(payloadRoot, file)]).status !== 0);
    check(`node --check on ${scripts.length} .mjs files`, scriptFailures.length === 0, scriptFailures.join(', '));

    const hooks = relativeFiles.filter((file) => file.startsWith('.githooks/'));
    const hookFailures = hooks.filter((file) => spawnSync('sh', ['-n', path.join(payloadRoot, file)]).status !== 0);
    check(`sh -n on ${hooks.length} hooks`, hookFailures.length === 0, hookFailures.join(', '));

    const executable = hooks.filter((file) => (fs.statSync(path.join(payloadRoot, file)).mode & 0o111) === 0);
    check('hooks carry the executable bit', executable.length === 0, executable.join(', '));

    const workflow = path.join(payloadRoot, '.github/workflows/hygiene.yml');
    const yamlCheck = spawnSync(
      'node',
      ['-e', `require('yaml').parse(require('fs').readFileSync(process.argv[1],'utf8')); console.log('parsed')`, workflow],
      { encoding: 'utf8' },
    );
    if (yamlCheck.status === 0) {
      check('workflow YAML parses (yaml parser)', true);
    } else if (isMissingModule(yamlCheck)) {
      check('workflow YAML structure', checkWorkflowStructure(workflow), 'parser not installed, structural check only');
    } else {
      check('workflow YAML parses (yaml parser)', false, (yamlCheck.stderr ?? '').split('\n')[0]);
    }

    process.stdout.write('\n5. Safety scan of the payload\n');
    // The scanner reports paths tracked by Git, so the extracted payload needs a scratch
    // repository. This also proves the payload itself contains no forbidden path.
    spawnSync('git', ['init', '--quiet', '-b', 'main'], { cwd: payloadRoot });
    spawnSync('git', ['add', '-A'], { cwd: payloadRoot });
    const scan = spawnSync(process.execPath, [path.join(payloadRoot, 'scripts/hygiene-check.mjs'), '--all', '--strict', '--json'], {
      cwd: payloadRoot,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    });
    let scanErrors = null;
    try {
      scanErrors = JSON.parse(scan.stdout ?? '{}').errors ?? null;
    } catch {
      scanErrors = null;
    }
    check('hygiene scanner reports no errors', scan.status === 0 && scanErrors === 0, scanErrors === null ? 'scanner output unreadable' : `${scanErrors} error(s)`);

    process.stdout.write('\n6. Structure\n');
    for (const file of relativeFiles) {
      const size = fs.statSync(path.join(payloadRoot, file)).size;
      process.stdout.write(`  ${String(size).padStart(8)}  ${file}\n`);
    }
    process.stdout.write(`\n  total: ${relativeFiles.length} files\n`);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }

  return finish(archiveSha);
}

function finish(archiveSha) {
  const failed = results.filter((result) => !result.ok);
  process.stdout.write(
    [
      '',
      `Archive SHA-256: ${archiveSha}`,
      `Checks: ${results.length - failed.length}/${results.length} passed`,
      failed.length === 0 ? 'RESULT: PASS — safe to publish.' : `RESULT: FAIL — ${failed.map((f) => f.name).join('; ')}`,
      '',
    ].join('\n'),
  );
  process.exit(failed.length === 0 ? 0 : 1);
}

main();
