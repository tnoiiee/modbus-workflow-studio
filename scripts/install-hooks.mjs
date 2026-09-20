#!/usr/bin/env node
/**
 * Registers the versioned Git hooks in .githooks for this clone.
 *
 * Git hooks are not transferred by clone or pull, so every developer and every
 * fresh clone must run this once:
 *
 *   npm run hooks:install
 *
 * The command only writes `core.hooksPath` in the local repository config.
 * It never changes the working tree and never touches the remote.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function main() {
  let root;
  try {
    root = git(['rev-parse', '--show-toplevel'], process.cwd()).trim();
  } catch {
    process.stderr.write('hooks:install: not inside a Git working tree.\n');
    process.exit(1);
  }

  const hooksDirectory = path.join(root, '.githooks');
  if (!fs.existsSync(hooksDirectory)) {
    process.stderr.write(`hooks:install: ${path.relative(root, hooksDirectory)} does not exist in this checkout.\n`);
    process.exit(1);
  }

  const hooks = fs.readdirSync(hooksDirectory).filter((name) => !name.startsWith('.'));
  for (const hook of hooks) {
    if (process.platform !== 'win32') {
      try {
        fs.chmodSync(path.join(hooksDirectory, hook), 0o755);
      } catch {
        // Best effort: Git for Windows does not use the executable bit.
      }
    }
  }

  git(['config', 'core.hooksPath', '.githooks'], root);

  process.stdout.write(`hooks:install: core.hooksPath=.githooks (${hooks.join(', ')}).\n`);
  process.stdout.write('hooks:install: verify with `git config --get core.hooksPath`.\n');
  process.stdout.write('hooks:install: bypass a single commit or push with HYGIENE_SKIP=1.\n');
}

main();
