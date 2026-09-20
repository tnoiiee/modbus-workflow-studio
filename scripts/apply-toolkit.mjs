#!/usr/bin/env node
/**
 * Applies the repository hygiene toolkit to the checkout that contains this file.
 *
 * The toolkit files are already placed at their final paths. This command removes the
 * only manual step — merging the package.json scripts — and then verifies the result:
 *
 *   1. Check that every managed file is present.
 *   2. Merge the `hygiene*`, `hooks:install`, `clean-history:prepare`, and `verify:publish`
 *      entries into package.json without touching any other key.
 *   3. Register core.hooksPath=.githooks in this clone.
 *   4. Run the hygiene scanner over the tree.
 *
 * Usage:
 *   node scripts/apply-toolkit.mjs            dry run: report only
 *   node scripts/apply-toolkit.mjs --write    apply the package.json merge and install hooks
 *
 * It never modifies source code, never deletes anything, and never touches a remote.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const PACKAGE_SCRIPTS = {
  hygiene: 'node scripts/hygiene-check.mjs',
  'hygiene:staged': 'node scripts/hygiene-check.mjs --staged',
  'hygiene:history': 'node scripts/hygiene-check.mjs --tracked --history',
  'hygiene:report': 'node scripts/hygiene-check.mjs --tracked --history --report .hygiene-out/hygiene-report.md',
  'hooks:install': 'node scripts/install-hooks.mjs',
  'clean-history:prepare': 'node scripts/prepare-clean-history.mjs',
  'untrack:runtime-data': 'node scripts/untrack-runtime-data.mjs',
  'verify:publish': 'node scripts/hygiene-check.mjs --tracked --history --strict',
  'toolkit:apply': 'node scripts/apply-toolkit.mjs',
};

const MANAGED_FILES = [
  '.gitignore',
  '.gitattributes',
  '.githooks/pre-commit',
  '.githooks/pre-push',
  '.github/workflows/hygiene.yml',
  'scripts/hygiene-check.mjs',
  'scripts/install-hooks.mjs',
  'scripts/prepare-clean-history.mjs',
  'scripts/untrack-runtime-data.mjs',
  'scripts/apply-toolkit.mjs',
  'docs/CLEAN_HISTORY_PUSH_RUNBOOK.md',
];

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function tryGit(args, cwd) {
  try {
    return git(args, cwd);
  } catch {
    return null;
  }
}

function main() {
  const write = process.argv.includes('--write');
  let root;
  try {
    root = git(['rev-parse', '--show-toplevel'], process.cwd()).trim();
  } catch {
    process.stderr.write('apply-toolkit: not inside a Git working tree.\n');
    process.exit(1);
  }

  process.stdout.write(`Repository: ${root}\nMode:       ${write ? 'apply (--write)' : 'dry run'}\n\n`);

  let missing = 0;
  process.stdout.write('1. Toolkit files\n');
  for (const relative of MANAGED_FILES) {
    const absolute = path.join(root, relative);
    const present = fs.existsSync(absolute);
    if (!present) missing += 1;
    process.stdout.write(`   ${present ? 'ok     ' : 'MISSING'} ${relative}\n`);
  }

  process.stdout.write('\n2. package.json scripts\n');
  const manifestPath = path.join(root, 'package.json');
  if (!fs.existsSync(manifestPath)) {
    process.stderr.write('   package.json not found; skipping the merge.\n');
  } else {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.scripts = manifest.scripts ?? {};
    const changes = [];
    for (const [name, command] of Object.entries(PACKAGE_SCRIPTS)) {
      const current = manifest.scripts[name];
      if (current === command) continue;
      changes.push({ name, current, command });
    }
    if (changes.length === 0) {
      process.stdout.write('   all entries already present and identical\n');
    } else {
      for (const change of changes) {
        process.stdout.write(`   ${change.current ? 'update' : 'add   '} ${change.name}\n`);
        if (change.current) process.stdout.write(`          was: ${change.current}\n`);
        process.stdout.write(`          new: ${change.command}\n`);
      }
      if (write) {
        const backupPath = `${manifestPath}.bak`;
        fs.copyFileSync(manifestPath, backupPath);
        for (const change of changes) manifest.scripts[change.name] = change.command;
        fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
        process.stdout.write('   applied (previous file saved as package.json.bak, ignored by .gitignore)\n');
        process.stdout.write('   review with: git diff package.json\n');
      } else {
        process.stdout.write('   dry run: re-run with --write to apply\n');
      }
    }
  }

  process.stdout.write('\n3. Git hooks\n');
  if (!write) {
    process.stdout.write('   dry run: would run `git config core.hooksPath .githooks`\n');
  } else {
    tryGit(['config', 'core.hooksPath', '.githooks'], root);
    process.stdout.write(`   core.hooksPath = ${tryGit(['config', '--get', 'core.hooksPath'], root)?.trim() ?? '(not set)'}\n`);
  }

  process.stdout.write('\n4. Hygiene scan\n');
  const scanner = path.join(root, 'scripts', 'hygiene-check.mjs');
  let scanStatus = 0;
  if (!fs.existsSync(scanner)) {
    process.stdout.write('   scanner not present; skipping\n');
  } else {
    // stdio inherit keeps the scan output visible; spawnSync reports the exit code
    // instead of throwing, so a finding produces guidance rather than a stack trace.
    const result = spawnSync(process.execPath, [scanner], { cwd: root, stdio: 'inherit' });
    scanStatus = result.status ?? 1;
  }

  if (scanStatus !== 0) {
    process.stdout.write(
      [
        '',
        'The hygiene scan reported blocking findings, so the toolkit is not finished yet.',
        'This is expected when the repository still TRACKS runtime data or build output.',
        '',
        'Fix it without deleting your local files:',
        '',
        '  node scripts/untrack-runtime-data.mjs            # show the plan',
        '  node scripts/untrack-runtime-data.mjs --write    # untrack, add placeholders, verify',
        '  git commit -m "chore: stop tracking runtime data and build output"',
        '',
        'Then re-run:  node scripts/apply-toolkit.mjs',
        'See docs/CLEAN_HISTORY_PUSH_RUNBOOK.md step 2 for the full explanation.',
        '',
      ].join('\n'),
    );
    process.exit(1);
  }

  process.stdout.write(
    [
      '',
      'Next steps:',
      '  1. Read docs/CLEAN_HISTORY_PUSH_RUNBOOK.md',
      '  2. Review `git diff` and commit the toolkit',
      '  3. Continue with the runbook: audit, back up, create the clean first commit, push to the new repository',
      missing > 0 ? `\nWarning: ${missing} toolkit file(s) missing. Re-extract the archive into the repository root.` : '',
      '',
    ].join('\n'),
  );
}

main();
