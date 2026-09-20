#!/usr/bin/env node
/**
 * Stops tracking runtime data, build output, and other local artifacts while keeping
 * the files on disk.
 *
 * Use this when `npm run hygiene` reports errors such as:
 *   server/data/audit.json, server/data/devices.json, server/data/workflows/*.json,
 *   client/tsconfig.tsbuildinfo
 *
 * Those files are operational state and local build output. They belong on the machine,
 * not in Git. This command removes them from the index (never from disk), restores the
 * empty-directory placeholders, confirms that .gitignore covers them, and re-runs the
 * scanner.
 *
 * Usage:
 *   node scripts/untrack-runtime-data.mjs            dry run: print the plan
 *   node scripts/untrack-runtime-data.mjs --write    apply, then verify
 *
 * The command never pushes, never rewrites history, and never deletes a working file.
 * Removing a file from the index does not remove it from previous commits: the
 * published history still needs the procedure in docs/CLEAN_HISTORY_PUSH_RUNBOOK.md.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

/** Path rules whose findings can be untracked automatically. Content rules cannot. */
const UNTRACKABLE_RULES = new Set([
  'runtime-data',
  'build-output',
  'log-or-database',
  'archive-artifact',
  'editor-or-os-file',
  'hygiene-report',
]);

/** These need a human decision first, so they are reported but not changed. */
const REVIEW_RULES = new Set(['env-file', 'credential-file', 'private-key-file']);

/** Directories that must keep an empty placeholder so a fresh clone still has them. */
const PLACEHOLDER_DIRECTORIES = ['data', 'server/data'];
const PLACEHOLDER_FILE = '.gitkeep';

const IGNORE_BLOCK_MARKER = '# --- Runtime data and local artifacts (managed by untrack-runtime-data.mjs) ---';
const IGNORE_BLOCK = [
  '',
  IGNORE_BLOCK_MARKER,
  '/data/*',
  '!/data/.gitkeep',
  '/server/data/*',
  '!/server/data/.gitkeep',
  '*.tsbuildinfo',
  '',
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

function runScannerJson(root) {
  const result = spawnSync(process.execPath, ['scripts/hygiene-check.mjs', '--worktree', '--json'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (!result.stdout) {
    process.stderr.write('untrack-runtime-data: the hygiene scanner produced no output.\n');
    process.exit(1);
  }
  return JSON.parse(result.stdout);
}

function summarizeLocations(paths) {
  const directories = new Set();
  for (const entry of paths) {
    const directory = path.posix.dirname(entry);
    directories.add(directory === '.' ? '(repository root)' : directory);
  }
  return [...directories].sort().join(', ');
}

function main() {
  const write = process.argv.includes('--write');
  let root;
  try {
    root = git(['rev-parse', '--show-toplevel'], process.cwd()).trim();
  } catch {
    process.stderr.write('untrack-runtime-data: not inside a Git working tree.\n');
    process.exit(1);
  }

  process.stdout.write(`Repository: ${root}\nMode:       ${write ? 'apply (--write)' : 'dry run'}\n\n`);

  const scan = runScannerJson(root);
  const pathFindings = scan.findings.filter((finding) => finding.severity === 'error' && !finding.line);

  const plan = [];
  const review = [];
  const manual = [];
  for (const finding of pathFindings) {
    if (UNTRACKABLE_RULES.has(finding.rule)) plan.push(finding);
    else if (REVIEW_RULES.has(finding.rule)) review.push(finding);
    else manual.push(finding);
  }
  const contentFindings = scan.findings.filter((finding) => finding.line);
  const seen = new Set();
  const targets = [];
  for (const finding of plan) {
    if (seen.has(finding.path)) continue;
    seen.add(finding.path);
    targets.push(finding.path);
  }

  if (targets.length === 0 && review.length === 0) {
    process.stdout.write('Nothing to untrack. The scanner reported no tracked runtime or build artifacts.\n');
    if (contentFindings.length > 0) {
      process.stdout.write(
        `${contentFindings.length} content finding(s) still need a manual decision; run \`npm run hygiene\` to list them.\n`,
      );
    }
    process.exit(0);
  }

  process.stdout.write(`Tracked paths that will be removed from the index (${targets.length}):\n`);
  for (const target of targets) process.stdout.write(`  - ${target}\n`);
  process.stdout.write('\nThe files themselves stay on disk. Only Git tracking changes.\n');

  if (review.length > 0) {
    process.stdout.write(
      [
        '',
        'Needs your decision first (not changed by this command):',
        ...review.map((finding) => `  ! ${finding.path}  [${finding.rule}]`),
        '',
        '  An ignored .env or credential file is still readable in previous commits. Decide whether the',
        '  values must be rotated, then follow docs/CLEAN_HISTORY_PUSH_RUNBOOK.md.',
      ].join('\n') + '\n',
    );
  }
  if (manual.length > 0) {
    process.stdout.write(`\nReported for manual review (${manual.length}): ${manual.map((f) => f.path).join(', ')}\n`);
  }

  const ignoreNeedsUpdate = [];
  for (const target of targets) {
    // --no-index is required: without it, check-ignore silently skips tracked paths,
    // which is exactly what this command is about to change.
    const ignored = tryGit(['check-ignore', '-v', '--no-index', '--', target], root);
    if (!ignored) ignoreNeedsUpdate.push(target);
  }

  const placeholders = PLACEHOLDER_DIRECTORIES.filter((directory) => fs.existsSync(path.join(root, directory)));
  const placeholderActions = placeholders
    .map((directory) => path.posix.join(directory, PLACEHOLDER_FILE))
    .filter((relative) => !fs.existsSync(path.join(root, relative)));

  if (!write) {
    process.stdout.write(
      [
        '',
        'Plan:',
        `  1. git rm --cached for the ${targets.length} path(s) above`,
        placeholderActions.length > 0
          ? `  2. create placeholder(s): ${placeholderActions.join(', ')}`
          : '  2. placeholders already present',
        ignoreNeedsUpdate.length > 0
          ? `  3. append ignore rules covering: ${summarizeLocations(ignoreNeedsUpdate)}`
          : '  3. .gitignore already covers every path',
        '  4. re-run the hygiene scanner and print the commit command',
        '',
        'Dry run: nothing changed. Apply with:',
        '  node scripts/untrack-runtime-data.mjs --write',
        '',
      ].join('\n'),
    );
    process.exit(0);
  }

  process.stdout.write('\nStep 1/4 — removing paths from the index\n');
  for (const target of targets) {
    const result = spawnSync('git', ['rm', '-r', '--cached', '--quiet', '--ignore-unmatch', '--', target], {
      cwd: root,
      encoding: 'utf8',
    });
    if (result.status !== 0) {
      process.stderr.write(`  failed: ${target}\n${result.stderr ?? ''}`);
      process.exit(1);
    }
    process.stdout.write(`  untracked ${target}\n`);
  }

  process.stdout.write('\nStep 2/4 — restoring empty-directory placeholders\n');
  if (placeholderActions.length === 0) {
    process.stdout.write('  nothing to create\n');
  }
  for (const relative of placeholderActions) {
    fs.mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
    fs.writeFileSync(path.join(root, relative), '', 'utf8');
    git(['add', '--', relative], root);
    process.stdout.write(`  created and staged ${relative}\n`);
  }

  process.stdout.write('\nStep 3/4 — confirming ignore rules\n');
  if (ignoreNeedsUpdate.length > 0) {
    const ignorePath = path.join(root, '.gitignore');
    const existing = fs.existsSync(ignorePath) ? fs.readFileSync(ignorePath, 'utf8') : '';
    if (existing.includes(IGNORE_BLOCK_MARKER)) {
      process.stdout.write('  managed block already present\n');
    } else {
      const separator = existing.endsWith('\n') || existing.length === 0 ? '' : '\n';
      fs.writeFileSync(ignorePath, `${existing}${separator}${IGNORE_BLOCK.join('\n')}`, 'utf8');
      git(['add', '--', '.gitignore'], root);
      process.stdout.write(`  appended ignore rules to .gitignore covering: ${summarizeLocations(ignoreNeedsUpdate)}\n`);
    }
  } else {
    process.stdout.write('  .gitignore already covers every path\n');
  }

  process.stdout.write('\nStep 4/4 — verification\n');
  const after = spawnSync(process.execPath, ['scripts/hygiene-check.mjs', '--staged'], { cwd: root, stdio: 'inherit' });
  const stagedStatus = after.status ?? 1;
  const worktree = spawnSync(process.execPath, ['scripts/hygiene-check.mjs'], { cwd: root, stdio: 'inherit' });
  const worktreeStatus = worktree.status ?? 1;

  process.stdout.write(
    [
      '',
      'Files on disk were not touched. Verify with:',
      '  git status --short',
      `  ${PLACEHOLDER_DIRECTORIES.filter((directory) => fs.existsSync(path.join(root, directory))).join(' ')}`,
      '',
      'Then commit:',
      '  git commit -m "chore: stop tracking runtime data and build output"',
      '',
      'This does not remove the files from previous commits. Continue with:',
      '  docs/CLEAN_HISTORY_PUSH_RUNBOOK.md',
      '',
      stagedStatus === 0 && worktreeStatus === 0
        ? 'Scanner status after the change: PASS for the index and the working tree.\n'
        : 'Scanner status after the change: still failing — see the findings above.\n',
    ].join('\n'),
  );

  process.exit(stagedStatus === 0 && worktreeStatus === 0 ? 0 : 1);
}

main();
