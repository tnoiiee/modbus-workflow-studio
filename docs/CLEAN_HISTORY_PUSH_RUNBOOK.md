# Clean History and Fresh Push Runbook

## Status and audience

**Owner/administrator procedure. Not part of a normal pull request.**

Use this runbook when the published repository contains files that must never have been
published (runtime `DATA_DIR` state, device endpoints, audit records, credentials, local
build metadata) and the goal is a **new history that never contained them**.

Two related documents exist:

- `docs/HISTORY_REWRITE_RUNBOOK.md` — rewrite history inside the existing repository.
- This document — publish a **new first commit** and, when complete erasure matters, push it to
  a **new repository**.

The active tree was already cleaned in v1.2.9. This runbook is about the commits.

## Decide first: new repository, or rewrite in place

| | A. New repository (recommended for leaked data) | B. Rewrite in place |
| --- | --- | --- |
| Old objects on GitHub | Removed when the old repository is deleted | Remain reachable through `refs/pull/<n>/head`, other branches, and tags until GitHub support or garbage collection removes them |
| Issues, PR numbers, stars, watchers | Lost | Kept |
| Forces contributors to re-clone | Yes | Yes |
| Forks keep old data | Yes (fixable only by the fork owner or GitHub support) | Yes |
| Predictable end state | Yes — the repository only ever contained the new history | Depends on every ref and cache |
| Owner effort | Low | Medium to high |

Choose **A** when real operational data or credentials were published, because a force push does
not delete the old commits: on GitHub a merged or closed pull request keeps its head commit
reachable at `refs/pull/<n>/head`, and the GitHub UI, API, and search can still resolve it until
the object is removed from the repository.

Choose **B** only when issue and pull-request history is more valuable than full erasure; then
follow `docs/HISTORY_REWRITE_RUNBOOK.md`.

## What this toolkit provides

| File | Purpose |
| --- | --- |
| `.gitignore` | Hardened path policy: secrets, runtime data, build output, logs, archives, OS/editor files |
| `.gitattributes` | Line-ending policy for hooks/scripts; suppresses diffs of accidental runtime files under `data/` and `server/data/` |
| `scripts/hygiene-check.mjs` | Scanner with path rules, credential patterns, and size limits. Modes: `--worktree`, `--staged`, `--tracked`, `--history` |
| `.githooks/pre-commit` | Blocks a commit that adds a critical file or a credential |
| `.githooks/pre-push` | Blocks a push whose tree or reachable history breaks the policy |
| `scripts/install-hooks.mjs` | `core.hooksPath` registration for each clone (`npm run hooks:install`) |
| `scripts/prepare-clean-history.mjs` | Backup plus single-commit history creation (`reinit` or `orphan` mode) |
| `scripts/untrack-runtime-data.mjs` | Stops tracking runtime data and build output without deleting local files |
| `scripts/apply-toolkit.mjs` | Merges the `package.json` scripts, installs the hooks, and verifies the tree |
| `scripts/build-toolkit-zip.mjs` | Rebuilds the toolkit archive that is handed to a local checkout |
| `.github/workflows/hygiene.yml` | Server-side gate on every push and pull request |

Git hooks are local and are **not** cloned, so `.github/workflows/hygiene.yml` is the control that
applies to everyone. Enable both.

Critical files are also blocked on the server side by GitHub push protection; enable it in the
hardening step below so a credential is rejected before it reaches the repository.

## Prerequisites

- The machine that holds the version you want to publish, with its working tree in the desired state.
- Node.js >= 20 and Git on `PATH`.
- `user.name` and `user.email` configured (`git config user.name`, `git config user.email`).
- Permission to create a repository in the GitHub account or organization.
- A maintenance window if other people push to the repository being replaced.

Do not run this from a checkout that contains uncommitted work you have not decided about: the
procedure commits the working tree **as it is**.

## Step 1 — Install the gate in the local checkout

Copy or merge these paths into the version you are publishing if they are not present yet:
`.gitignore`, `.gitattributes`, `.githooks/`, `scripts/hygiene-check.mjs`,
`scripts/install-hooks.mjs`, `scripts/prepare-clean-history.mjs`,
`.github/workflows/hygiene.yml`, and the `hygiene*` / `hooks:install` / `clean-history:prepare`
entries in `package.json`.

```bash
npm run hooks:install
git config --get core.hooksPath   # expected: .githooks
```

## Step 2 — Audit before touching anything

```bash
npm run hygiene           # tracked files + untracked files that are not ignored
npm run hygiene:history   # every path that ever existed in reachable history
```

`npm run hygiene` must pass. Fix every error: delete the file, or add the path to `.gitignore`
when it is a local artifact that must stay on disk.

If the tree still **tracks** runtime data or build output (`server/data/*.json`,
`server/data/workflows/*.json`, `client/tsconfig.tsbuildinfo`), stop tracking it while keeping the
files on disk. The helper does this, restores empty-directory placeholders, confirms the ignore
rules, and re-runs the scanner:

```bash
node scripts/untrack-runtime-data.mjs            # dry run: print the plan
node scripts/untrack-runtime-data.mjs --write    # untrack, add placeholders, verify
git commit -m "chore: stop tracking runtime data and build output"
```

It runs `git rm --cached` only: nothing is deleted from disk, nothing is pushed, and history is
untouched. Equivalent manual form:

```bash
git rm -r --cached client/tsconfig.tsbuildinfo server/data data
mkdir -p server/data data
touch server/data/.gitkeep data/.gitkeep
git add -A
git commit -m "chore: stop tracking runtime data before the fresh push"
```

An `.env` or credential file that is already tracked is reported but not changed automatically:
decide whether the values must be rotated first, then follow the procedure below.

Repeat for any other reported path, then run the scanner again until it passes.

`npm run hygiene:history` is expected to fail at this point — that failure is the leak you are
removing. Read it, confirm that every listed path is accounted for, and keep the output.

Personal ignore rules that must never be published belong in `.git/info/exclude`, not in
`.gitignore`.

Optional report for review:

```bash
npm run hygiene:report    # writes .hygiene-out/hygiene-report.md (masked, safe to attach)
```

## Step 3 — Back up the current repository

```bash
cd <repository>
git bundle create ../verification-history-backup-YYYYMMDD.bundle --all
git bundle verify ../verification-history-backup-YYYYMMDD.bundle
```

`scripts/prepare-clean-history.mjs` performs this step again and refuses to continue if the backup
directory already contains data. It writes four things:

- `git-directory/` — a byte-for-byte copy of `.git`. This is the recovery path that always works,
  including for shallow or partially fetched repositories (`--skip-git-copy` disables it, and is
  not recommended).
- `history.bundle` — a portable Git bundle.
- `RESTORE.md`, `tracked-files.txt`, `refs.txt`, `log.txt`, `status.txt`, `stashes.txt` — recovery
  instructions and a record of what the repository contained.
- A **restore check**: the tool re-clones the bundle into a scratch directory and deletes it again.
  If the source repository is shallow or partial, the bundle cannot always be re-cloned; the run
  reports that and tells you to use `git-directory/`. Both paths are documented in `RESTORE.md`.

Store the backup directory in an access-controlled location: **it contains the leaked data by
definition.** Do not attach it to an issue and do not commit it.

## Step 4 — Create one clean first commit

Dry run first:

```bash
npm run clean-history:prepare
```

The dry run prints the branch, the commit message, the backup path, and the exact steps. It changes
nothing. Then execute:

```bash
node scripts/prepare-clean-history.mjs --execute --confirm=DELETE-OLD-HISTORY
```

What it does:

1. Runs the hygiene scanner on the tree being published and stops on errors.
2. Reports the history that is about to be discarded (warnings only, by design).
3. Copies `.git` to `git-directory/`, writes the bundle and the listings, and verifies that the
   bundle can be re-cloned (see step 3).
4. `reinit` mode (default): deletes `.git`, re-initializes, re-applies your local `user.*` and
   line-ending configuration, and creates a single commit containing the working tree.
5. Re-runs the scanner against the new tree **and** the new history, which must both pass.
6. Prints the remote and push commands. **Nothing is pushed and no remote is changed.**

Notes:

- Remotes are intentionally not restored. Re-adding the old `origin` would make an accidental push
  to the compromised repository possible.
- `--mode=orphan` keeps `.git`, creates a parentless commit, and replaces the previous branch.
  Old objects survive locally until pruned; add `--prune-refs` to clear stashes, delete other
  refs, expire reflogs, and run `git gc --prune=now`. `--prune-refs` also removes
  `refs/remotes/origin/*`, so re-add the new remote before pushing.
- The working tree is never rewritten. Only `.git` changes.

## Step 5 — Verify the new history locally

```bash
git log --oneline --all              # exactly one commit
git ls-files server/data data        # only data/.gitkeep and server/data/.gitkeep
git ls-files | grep -c .             # compare with the backup listing
npm run verify:publish               # scanner, strict mode
```

Also confirm the difference against the backup listing written by the script
(`tracked-files.txt` in the backup directory). Files that disappeared are the files that will no
longer be published.

## Step 6 — Publish to a new repository

1. Create a **new empty private repository**. Do not let GitHub create a README, license, or
   `.gitignore`: the first commit must be yours.
2. Push:

```bash
git remote add origin https://github.com/<owner>/<new-repository>.git
git push -u origin main
```

3. Verify **before** making it public. On GitHub:

- The branch shows **one commit**.
- Code search for `devices.json`, `monitor-lists.json`, `audit.json`, `workflows.json`, `tsbuildinfo`
  returns nothing on the default branch.
- No `.env`, no key material, no `server/data` runtime files.
- `git ls-tree -r --name-only origin/main` matches your local listing.

4. Make the repository public only after step 3 passes. If a find is reported in a private
   repository, delete the repository and repeat from step 4 — an unpublished commit has no cost.

## Step 7 — Post-publish verification

Run in a **fresh clone**, never in the prepared working copy:

```bash
git clone https://github.com/<owner>/<new-repository>.git verify-clean
cd verify-clean
git log --oneline --all
git ls-files server/data data
npm run hygiene
npm run hygiene:history
```

Then check the areas a history change cannot cover:

- GitHub Actions artifacts and caches of the **old** repository (delete them).
- Tags, releases, and branches of the old repository.
- Existing forks: they keep a full copy. You cannot remove a fork's objects; the fork owner must
  delete or reset it, or GitHub support must be involved.
- Other clones, CI caches, build servers, and local copies on contributor machines.
- Search-engine caches, chat logs, screenshots, and issue attachments.

## Step 8 — Retire and harden

Retire the previous repository:

- Archive it to stop further use, or delete it for full removal. Archiving is **not** erasure: the
  data stays readable in the archived repository and in its forks.
- If the data must be removed from a public repository and its forks, follow GitHub's
  sensitive-data removal process (`https://docs.github.com/site-policy/content-removal-policies/sensitive-data-removal`).

Harden the new repository, in Settings:

- **Secret scanning** and **push protection**: on. This blocks a credential at push time.
- **Dependabot alerts** and security updates: on.
- **Branch protection** for `main`: require pull requests, require the `Check` and `Hygiene`
  workflows to pass, and disallow force pushes.
- **Actions**: restrict allowed actions to those in use, and set the default token permission to
  read-only.
- **Repository visibility**: keep private until the verification in step 6 is complete.

## Step 9 — Notify contributors

Every existing clone keeps the old objects, including the leaked files. Tell contributors to:

1. Delete the old clone, or move it away: `mv old-clone old-clone-archive`.
2. `git clone` the new repository.
3. Run `npm run hooks:install` after cloning.
4. Never push a branch created from the old clone, and never merge old history into the new
   repository.
5. Report any place where the previous data still appears.

## Step 10 — Record the result

Update `docs/CURRENT_STATE.md` with the new default-branch commit SHA, the date, the repository
URL, and a note that the previous history is retained only in the access-controlled backup bundle.

## When to request review

Generate the masked report and share the outcome, not the data:

```bash
npm run hygiene:report        # .hygiene-out/hygiene-report.md
git log --oneline --all
git ls-files > /tmp/tracked-files.txt
```

The reviewer needs: the report, the commit list, the tracked file list, and the results of the
step 7 commands. Never paste raw values from the leaked files into a review, issue, or chat.

## What this procedure cannot do

Even after the old repository is deleted:

- forks keep their own copies of every commit;
- existing clones on other machines keep the old objects;
- CI caches, artifact stores, and backup systems keep their copies;
- search indexes, archives, screenshots, and chat history keep what they captured;
- third-party mirrors and code-search sites keep what they already indexed.

Treat the cleanup as **reducing exposure**, and treat anything that was published as disclosed:
rotate every credential that could have been in the exposed files, and review device network
topology and access control if endpoints were published.

## Troubleshooting

| Symptom | Meaning | Action |
| --- | --- | --- |
| `hygiene: pre-commit check skipped` | `.githooks` is not active in this clone | `npm run hooks:install` |
| `hygiene: Node.js is required` | Node not on `PATH` | Install Node.js >= 20, or `HYGIENE_SKIP=1` once after manual review |
| Commit blocked by a path rule, but the file is intentional | Policy disagreement | Fix the rule and the tooling in a pull request; bypassing per commit defeats the control |
| `hygiene-check [history] FAIL` after the clean commit | Another ref (branch, tag, `refs/stash`) still holds old objects | List them with `git for-each-ref` and prune, or repeat the reset |
| `Bundle restore check: FAILED` | Shallow or partially fetched source repository | Nothing is lost: restore from `git-directory/` in the backup folder, as `RESTORE.md` describes |
| Old files still visible on GitHub after force push | `refs/pull/<n>/head` or a fork | That is exactly why option A (new repository) exists |
| Push rejected by GitHub push protection | A real credential is in the commit | Remove it, reset the commit, rotate the credential |
| `runtime-data` error while a data file is still tracked | The tree still versions operational state | `git rm -r --cached server/data data`, restore `.gitkeep`, commit, re-run the scanner |

## Bypass policy

`HYGIENE_SKIP=1` exists for emergencies only. A bypass must be explained in the pull request that
follows, and the repository owner reviews every bypass. `HYGIENE_SKIP` never changes what the
server-side `Hygiene` workflow checks.
