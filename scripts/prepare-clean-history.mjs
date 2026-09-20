#!/usr/bin/env node
/**
 * Prepares a clean, single-commit history for a fresh push.
 *
 * Run this on the machine that holds the version you want to publish, in a clean
 * working tree. The procedure is described in docs/CLEAN_HISTORY_PUSH_RUNBOOK.md.
 *
 * Default behaviour is a dry run: nothing is modified, the plan is printed.
 * To execute, pass --execute --confirm=DELETE-OLD-HISTORY.
 *
 * Modes
 *   --mode=reinit (default)  Back up, delete .git, re-initialize, commit the tree once.
 *                            Guarantees no old object survives locally.
 *   --mode=orphan            Keep .git and its remotes/tags, create a parentless commit
 *                            on a new root, then replace the previous branch.
 *
 * Safety
 *   - Requires a clean working tree so the backup bundle captures everything.
 *   - Copies history into a Git bundle before any destructive step.
 *   - Never pushes. Push commands are printed for the owner/admin to run.
 *   - Never prints secret values; the hygiene scanner masks them.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const CONFIRM_TOKEN = 'DELETE-OLD-HISTORY'; // hygiene-allow: confirmation phrase, not a credential
const SCANNER = path.join('scripts', 'hygiene-check.mjs');

/**
 * Local configuration that must survive the re-initialization because it is not
 * stored anywhere else. Remotes are deliberately excluded: restoring an old
 * origin would make an accidental push to the previous repository possible.
 */
const PRESERVED_LOCAL_CONFIG = [
  'user.name',
  'user.email',
  'user.signingkey',
  'core.autocrlf',
  'core.eol',
  'core.ignorecase',
  'core.filemode',
  'core.longpaths',
];

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function tryGit(args, cwd) {
  try {
    return git(args, cwd);
  } catch (error) {
    return null;
  }
}

function runScanner(args, cwd) {
  const result = spawnSync(process.execPath, [SCANNER, ...args], { cwd, stdio: 'inherit' });
  return result.status ?? 1;
}

function parseArgs(argv) {
  const options = {
    mode: 'reinit',
    branch: 'main',
    remote: null,
    message: null,
    backupDir: null,
    execute: false,
    confirm: null,
    pruneRefs: false,
    skipGitCopy: false,
    allowDirty: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const [key, inlineValue] = arg.includes('=') ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)] : [arg, null];
    const takeValue = () => {
      if (inlineValue !== null) return inlineValue;
      i += 1;
      return argv[i];
    };
    switch (key) {
      case '--mode':
        options.mode = takeValue();
        break;
      case '--branch':
        options.branch = takeValue();
        break;
      case '--remote':
        options.remote = takeValue();
        break;
      case '--message':
        options.message = takeValue();
        break;
      case '--backup-dir':
        options.backupDir = takeValue();
        break;
      case '--confirm':
        options.confirm = takeValue();
        break;
      case '--prune-refs':
        options.pruneRefs = true;
        break;
      case '--skip-git-copy':
        options.skipGitCopy = true;
        break;
      case '--allow-dirty':
        options.allowDirty = true;
        break;
      case '--execute':
        options.execute = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        process.stderr.write(`prepare-clean-history: unknown argument: ${arg}\n`);
        process.exit(2);
    }
  }
  return options;
}

function printUsage() {
  process.stdout.write(
    [
      'Usage: node scripts/prepare-clean-history.mjs [options]',
      '',
      '  --mode=reinit|orphan   reinit (default) or orphan',
      '  --branch=<name>        published branch name (default: main)',
      '  --message="<text>"     first commit message',
      '  --backup-dir=<path>    backup location (default: ../<repo>-backup-<timestamp>)',
      '  --remote=<url>         optional remote URL to add after the commit',
      '  --prune-refs           orphan mode only: delete other refs and prune old objects',
      '  --skip-git-copy        do not copy .git into the backup (bundle only; not recommended)',
      '  --allow-dirty          accept uncommitted changes, snapshotting them into the backup',
      '  --execute              perform the change (default: dry run)',
      `  --confirm=${CONFIRM_TOKEN}`,
      '',
    ].join('\n'),
  );
}

function fail(message) {
  process.stderr.write(`prepare-clean-history: ${message}\n`);
  process.exit(1);
}

function listTracked(cwd) {
  return git(['ls-files', '-z'], cwd).split('\0').filter(Boolean).sort();
}

function snapshotLocalConfig(root) {
  const snapshot = {};
  for (const key of PRESERVED_LOCAL_CONFIG) {
    const value = tryGit(['config', '--local', '--get', key], root);
    if (value && value.trim()) snapshot[key] = value.trim();
  }
  return snapshot;
}

function restoreLocalConfig(root, snapshot) {
  for (const [key, value] of Object.entries(snapshot)) {
    tryGit(['config', '--local', key, value], root);
  }
}

function compareFileLists(before, after) {
  const afterSet = new Set(after);
  const beforeSet = new Set(before);
  return {
    removed: before.filter((entry) => !afterSet.has(entry)),
    added: after.filter((entry) => !beforeSet.has(entry)),
  };
}

function writeBackup(root, backupDir, branch, { copyGitDirectory, snapshotWorkingTree }) {
  fs.mkdirSync(backupDir, { recursive: true });
  const bundlePath = path.join(backupDir, 'history.bundle');
  fs.writeFileSync(path.join(backupDir, 'tracked-files.txt'), `${listTracked(root).join('\n')}\n`, 'utf8');
  fs.writeFileSync(path.join(backupDir, 'refs.txt'), git(['for-each-ref', '--format=%(refname) %(objectname)'], root), 'utf8');
  fs.writeFileSync(path.join(backupDir, 'log.txt'), git(['log', '--all', '--date=iso', '--format=%H %ad %an %s'], root), 'utf8');
  fs.writeFileSync(path.join(backupDir, 'status.txt'), git(['status', '--porcelain=v1', '--branch'], root), 'utf8');
  fs.writeFileSync(path.join(backupDir, 'stashes.txt'), git(['stash', 'list'], root), 'utf8');

  // A byte-for-byte copy of .git is the recovery path that always works, including
  // for shallow or partially fetched repositories where a bundle cannot be re-cloned.
  let gitCopyPath = null;
  if (copyGitDirectory) {
    gitCopyPath = path.join(backupDir, 'git-directory');
    fs.cpSync(path.join(root, '.git'), gitCopyPath, { recursive: true });
  }

  // The bundle stays the portable artefact, and its restore path is verified, not assumed.
  let bundleState = 'not created';
  let restoreState = 'not attempted';
  let restoreError = '';
  try {
    git(['bundle', 'create', bundlePath, '--all'], root);
    git(['bundle', 'verify', bundlePath], root);
    bundleState = 'created and verified';
    const restoreCheckDir = path.join(backupDir, 'restore-check');
    try {
      git(['clone', '--quiet', '--no-local', bundlePath, restoreCheckDir], root);
      git(['log', '--oneline', '-1'], restoreCheckDir);
      restoreState = 'verified by re-cloning the bundle';
    } catch (error) {
      restoreState = 'FAILED — the bundle could not be re-cloned';
      restoreError = String(error.stderr ?? error.message).trim();
    } finally {
      fs.rmSync(restoreCheckDir, { recursive: true, force: true });
    }
  } catch (error) {
    bundleState = 'FAILED';
    restoreError = String(error.stderr ?? error.message).trim();
  }

  // Uncommitted work is not part of the bundle, so it is captured separately.
  let snapshotState = 'not needed — the working tree was clean';
  let snapshotCounts = { modified: 0, untracked: 0 };
  if (snapshotWorkingTree) {
    try {
      const patch = tryGit(['diff', 'HEAD', '--binary'], root) ?? '';
      const staged = tryGit(['diff', '--cached', '--binary'], root) ?? '';
      fs.writeFileSync(path.join(backupDir, 'working-tree.patch'), patch, 'utf8');
      fs.writeFileSync(path.join(backupDir, 'staged.patch'), staged, 'utf8');

      const untracked = (tryGit(['ls-files', '--others', '--exclude-standard', '-z'], root) ?? '')
        .split('\0')
        .filter(Boolean);
      for (const relative of untracked) {
        const destination = path.join(backupDir, 'untracked', relative);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.copyFileSync(path.join(root, relative), destination);
      }
      fs.writeFileSync(
        path.join(backupDir, 'untracked-files.txt'),
        untracked.length > 0 ? `${untracked.join('\n')}\n` : '(none)\n',
        'utf8',
      );
      snapshotCounts = { modified: patch.split('\n').filter((line) => line.startsWith('diff --git')).length, untracked: untracked.length };
      snapshotState = `captured (${snapshotCounts.modified} modified file(s), ${snapshotCounts.untracked} untracked file(s))`;
    } catch (error) {
      snapshotState = `FAILED — ${String(error.stderr ?? error.message).split('\n')[0]}`;
    }
  }

  fs.writeFileSync(
    path.join(backupDir, 'RESTORE.md'),
    [
      '# History backup',
      '',
      'This directory is access-controlled owner material. It contains the pre-cleanup',
      'repository history, including any runtime data or credentials that were committed.',
      'Do not publish it, do not attach it to an issue, and delete it when retention ends.',
      '',
      `- Publish branch at the time of backup: ${branch}`,
      `- Git bundle: ${bundleState}`,
      `- Bundle restore check: ${restoreState}`,
      `- .git directory copy: ${gitCopyPath ? `yes (${path.basename(gitCopyPath)}/)` : 'not created'}`,
      `- Uncommitted work snapshot: ${snapshotState}`,
      '',
      ...(snapshotWorkingTree
        ? [
            '## Restore the uncommitted work that was present at backup time',
            '',
            '```bash',
            '# inside a checkout of the restored repository',
            'git apply --binary /path/to/backup/working-tree.patch',
            'git apply --binary --index /path/to/backup/staged.patch   # only staged changes',
            'cp -a /path/to/backup/untracked/. .                      # untracked files',
            'git status --short                                      # compare with status.txt',
            '```',
            '',
          ]
        : []),
      '## Restore from the .git directory copy (always available)',
      '',
      '```bash',
      'mkdir -p restored && cp -a git-directory restored/.git',
      'cd restored && git status --short && git log --oneline --all',
      '```',
      '',
      '## Restore from the bundle (portable, requires a complete repository)',
      '',
      '```bash',
      'git clone history.bundle restored-repo',
      'cd restored-repo && git log --oneline --all',
      '```',
      '',
      restoreError ? `Last restore error: ${restoreError.split('\n').slice(0, 4).join(' / ')}` : '',
      '',
    ].join('\n'),
    'utf8',
  );

  return { bundlePath, bundleState, restoreState, restoreError, gitCopyPath, snapshotState };
}

function printNextSteps({ branch, remote, commitSha }) {
  process.stdout.write(
    [
      '',
      'Next steps (owner/admin):',
      '',
      '1. Create a NEW empty repository on GitHub (private first, no README, no license, no .gitignore).',
      '2. Add the remote and push the single clean commit:',
      '',
      '```bash',
      remote ? `git remote add origin ${remote}` : 'git remote add origin https://github.com/<owner>/<repository>.git',
      `git push -u origin ${branch}`,
      '```',
      '',
      '3. Verify on GitHub before making the repository public:',
      `   - the branch has one commit (${commitSha ? commitSha.slice(0, 12) : 'unknown'})`,
      '   - no server/data/audit.json, devices.json, monitor-lists.json, workflow.json, workflows.json',
      '   - no server/data/workflows/ directory, no .env, no *.tsbuildinfo',
      '   - run `npm run hygiene:history` in the fresh clone',
      '4. Make the repository public only after step 3 passes.',
      '5. Continue with the post-push and contributor steps in docs/CLEAN_HISTORY_PUSH_RUNBOOK.md.',
      '',
    ].join('\n'),
  );
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    process.exit(0);
  }
  if (!['reinit', 'orphan'].includes(options.mode)) fail(`unsupported --mode=${options.mode}`);

  let root;
  try {
    root = git(['rev-parse', '--show-toplevel'], process.cwd()).trim();
  } catch {
    fail('not inside a Git working tree.');
  }

  const gitDirectory = path.join(root, '.git');
  if (!fs.existsSync(gitDirectory) || !fs.statSync(gitDirectory).isDirectory()) {
    fail('.git must be a real directory. Linked worktrees and submodules are not supported.');
  }

  const dirty = git(['status', '--porcelain'], root).trim();
  if (dirty && options.execute && !options.allowDirty) {
    fail(
      [
        `the working tree is not clean (${dirty.split('\n').length} entries).`,
        '',
        dirty.split('\n').slice(0, 20).join('\n'),
        '',
        'Choose one:',
        '',
        '  A. The uncommitted files ARE the version you want to publish (for example the',
        '     working tree is your newer local version). Snapshot them into the backup and continue:',
        '',
        '       node scripts/prepare-clean-history.mjs --execute --allow-dirty --confirm=DELETE-OLD-HISTORY',
        '',
        '     The backup then also contains working-tree.patch plus an untracked/ copy, so the',
        '     current uncommitted state can be reconstructed.',
        '',
        '  B. The uncommitted files are unfinished work. Commit or stash them first, then run this',
        '     command again without --allow-dirty.',
      ].join('\n'),
    );
  }

  const repoName = path.basename(root);
  const branch = options.branch;
  const message = options.message ?? `chore: publish ${repoName} v${readVersion(root) ?? '1.0.0'}`;
  const backupDir = path.resolve(root, options.backupDir ?? path.join('..', `${repoName}-history-backup-${timestamp()}`));
  const commitSha = tryGit(['rev-parse', '--short', 'HEAD'], root);

  process.stdout.write(
    [
      `Repository:   ${root}`,
      `Mode:         ${options.mode}`,
      `Branch:       ${branch}`,
      `First commit: ${message}`,
      `Backup:       ${backupDir}`,
      `Current HEAD: ${commitSha ? commitSha.trim() : 'no commits yet'}`,
      `Executing:    ${options.execute ? `${CONFIRM_TOKEN} confirmed` : 'no — dry run'}`,
      '',
    ].join('\n'),
  );

  if (!options.execute) {
    if (dirty) {
      process.stdout.write(
        [
          `Note: the working tree is not clean (${dirty.split('\n').length} entries).`,
          'With --execute these changes need --allow-dirty, which snapshots them into the backup',
          '',
          dirty.split('\n').slice(0, 20).join('\n'),
          '',
        ].join('\n'),
      );
    }
    process.stdout.write(
      [
        'Dry run. The following steps would run:',
        '',
        '1. Verify the tree with the hygiene scanner (blocking errors stop the procedure).',
        '2. Write a Git bundle backup plus ref/log/status listings to the backup directory.',
        options.mode === 'reinit'
          ? '3. Delete .git, re-initialize the repository, and create one commit from the working tree.'
          : '3. Create a parentless commit on a new root, delete the previous branch, and rename the new branch.',
        '4. Re-run the hygiene scanner against the tree and the new history.',
        '5. Print the remote/push commands. Nothing is pushed automatically.',
        '',
        `Re-run with: node scripts/prepare-clean-history.mjs --execute --confirm=${CONFIRM_TOKEN}`,
        '',
      ].join('\n'),
    );
    return;
  }

  if (options.confirm !== CONFIRM_TOKEN) {
    fail(`refusing to run. Pass --confirm=${CONFIRM_TOKEN} to accept that the previous history is discarded.`);
  }

  const identity = {
    name: tryGit(['config', 'user.name'], root),
    email: tryGit(['config', 'user.email'], root),
  };
  if (!identity.name || !identity.email) {
    fail('git user.name and user.email must be configured before creating the clean commit.');
  }

  process.stdout.write('Step 1/5 — hygiene scan of the tree being published\n');
  if (runScanner(['--tracked'], root) !== 0) {
    fail('the hygiene scanner reported errors. Fix them before replacing history.');
  }
  process.stdout.write('\nStep 1/5 — audit of the history that will be discarded\n');
  runScanner(['--history', '--soft-history'], root);

  process.stdout.write(`\nStep 2/5 — backup to ${backupDir}\n`);
  if (fs.existsSync(backupDir) && fs.readdirSync(backupDir).length > 0) {
    fail(`backup directory already exists and is not empty: ${backupDir}`);
  }
  const backup = writeBackup(root, backupDir, branch, {
    copyGitDirectory: !options.skipGitCopy,
    snapshotWorkingTree: Boolean(dirty),
  });
  const bundlePath = backup.bundlePath;
  process.stdout.write(`Backup bundle: ${backup.bundlePath} (${backup.bundleState})\n`);
  process.stdout.write(`Bundle restore check: ${backup.restoreState}\n`);
  if (backup.gitCopyPath) process.stdout.write(`.git directory copy: ${backup.gitCopyPath}\n`);
  process.stdout.write(`Uncommitted work snapshot: ${backup.snapshotState}\n`);
  if (!backup.restoreState.startsWith('verified')) {
    process.stdout.write(`Restore warning: ${backup.restoreError.split('\n')[0]}\n`);
    if (!backup.gitCopyPath) {
      fail(
        'the bundle could not be restored and no .git directory copy was made. Run again without --skip-git-copy.',
      );
    }
    process.stdout.write(
      'The repository could not be restored from the bundle, which happens with shallow or partially fetched\n' +
        'repositories. The .git directory copy in the backup folder is complete and is the recovery path.\n',
    );
  }

  const beforeTracked = listTracked(root);
  const localConfig = snapshotLocalConfig(root);

  process.stdout.write('\nStep 3/5 — creating the clean history\n');
  let previousBranch = null;
  try {
    if (options.mode === 'reinit') {
      fs.rmSync(gitDirectory, { recursive: true, force: true });
      initializeRepository(root, branch);
      restoreLocalConfig(root, localConfig);
    } else {
      previousBranch = tryGit(['rev-parse', '--abbrev-ref', 'HEAD'], root)?.trim() ?? null;
      startOrphanRoot(root, `${branch}-clean`);
    }
    git(['add', '-A'], root);
    git(['commit', '--quiet', '--no-gpg-sign', '-m', message], root);
    git(['config', 'core.hooksPath', '.githooks'], root);
    if (options.mode === 'orphan') {
      finishOrphanRoot(root, { previousBranch, stagingBranch: `${branch}-clean`, branch, pruneRefs: options.pruneRefs });
    }
  } catch (error) {
    process.stderr.write(`\nprepare-clean-history: the clean commit could not be created.\n`);
    process.stderr.write(`${error.stderr ?? error.message}\n\n`);
    process.stderr.write(
      [
        'Recovery:',
        `  1. The previous history is backed up in ${backupDir}`,
        `     git clone "${bundlePath}" restored-repo      # portable bundle`,
        backup.gitCopyPath ? `     cp -a "${backup.gitCopyPath}" restored/.git   # complete .git copy` : '',
        '  2. Repair the reported Git error in this checkout, then verify the branch and commit it:',
        `     git status && git commit -m "${message.replace(/"/g, '\\"')}"`,
        '  3. Nothing was pushed, and no remote was changed by this script.',
        '',
      ].join('\n'),
    );
    process.exit(1);
  }

  const afterTracked = listTracked(root);
  const difference = compareFileLists(beforeTracked, afterTracked);

  process.stdout.write('\nStep 4/5 — verification\n');
  const newSha = git(['rev-parse', 'HEAD'], root).trim();
  process.stdout.write(`New HEAD: ${newSha}\n`);
  process.stdout.write(`Commits: ${git(['rev-list', '--count', 'HEAD'], root).trim()}\n`);
  process.stdout.write(`Tracked files: ${afterTracked.length}\n`);
  if (difference.removed.length > 0) {
    process.stdout.write(`Files no longer published (${difference.removed.length}):\n`);
    for (const entry of difference.removed.slice(0, 50)) process.stdout.write(`  - ${entry}\n`);
  }
  if (difference.added.length > 0) {
    process.stdout.write(`Newly published files (${difference.added.length}):\n`);
    for (const entry of difference.added.slice(0, 50)) process.stdout.write(`  + ${entry}\n`);
  }
  const treeStatus = runScanner(['--tracked'], root);
  const historyStatus = runScanner(['--tracked', '--history'], root);
  if (treeStatus !== 0 || historyStatus !== 0) {
    fail('verification failed. Do not push; inspect the findings above. The backup bundle still holds the old history.');
  }

  process.stdout.write('\nStep 5/5 — remote configuration\n');
  if (options.remote) {
    const existing = tryGit(['remote', 'get-url', 'origin'], root);
    if (existing) git(['remote', 'set-url', 'origin', options.remote], root);
    else git(['remote', 'add', 'origin', options.remote], root);
    process.stdout.write(`origin = ${options.remote}\n`);
  } else {
    process.stdout.write('No --remote given; nothing was configured.\n');
  }

  printNextSteps({ branch, remote: options.remote, commitSha: newSha });
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function readVersion(root) {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    return typeof manifest.version === 'string' ? manifest.version : null;
  } catch {
    return null;
  }
}

function initializeRepository(root, branch) {
  try {
    git(['init', '--quiet', '-b', branch], root);
  } catch {
    git(['init', '--quiet'], root);
    git(['symbolic-ref', 'HEAD', `refs/heads/${branch}`], root);
  }
}

function startOrphanRoot(root, stagingBranch) {
  git(['checkout', '--orphan', stagingBranch], root);
}

function finishOrphanRoot(root, { previousBranch, stagingBranch, branch, pruneRefs }) {
  if (previousBranch && previousBranch !== stagingBranch) tryGit(['branch', '-D', previousBranch], root);
  git(['branch', '-M', stagingBranch, branch], root);

  if (pruneRefs) {
    pruneOtherRefs(root, branch);
  } else {
    process.stdout.write(
      [
        'Orphan mode keeps other refs and stale objects until they are pruned.',
        'Review them, then purge locally with:',
        '',
        '```bash',
        'git stash clear',
        'git for-each-ref --format="%(refname)" refs/heads refs/tags refs/remotes',
        'git reflog expire --expire=now --expire-unreachable=now --all',
        'git gc --prune=now',
        '```',
        '',
      ].join('\n'),
    );
  }
}

function pruneOtherRefs(root, branch) {
  if (tryGit(['stash', 'list'], root)?.trim()) git(['stash', 'clear'], root);
  const keep = `refs/heads/${branch}`;
  const refs = git(['for-each-ref', '--format=%(refname)', 'refs/heads', 'refs/tags', 'refs/remotes'], root)
    .split('\n')
    .map((entry) => entry.trim())
    .filter((entry) => entry && entry !== keep);
  for (const ref of refs) tryGit(['update-ref', '-d', ref], root);
  git(['reflog', 'expire', '--expire=now', '--expire-unreachable=now', '--all'], root);
  git(['gc', '--prune=now'], root);
  process.stdout.write(`Pruned ${refs.length} refs and unreachable objects.\n`);
}

main();
