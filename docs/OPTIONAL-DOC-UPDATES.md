# Optional documentation updates

ข้อความด้านล่างคือสิ่งที่ควรเพิ่มในเอกสารของ repo หลังติดตั้ง toolkit
ถ้าไฟล์ของคุณแก้ไปแล้ว ให้ใช้เป็นแนวทาง ไม่ต้องทับทั้งไฟล์

## README.md — แทนย่อหน้าเรื่อง runtime-history

> The v1.2.9 cleanup removes runtime artifacts from the active tree. It does not erase data from
> previously published Git history; the repository owner must complete the separate operational
> remediation described in `docs/CLEAN_HISTORY_PUSH_RUNBOOK.md` (fresh history, complete removal)
> or `docs/HISTORY_REWRITE_RUNBOOK.md` (rewrite in place, keeps issues and pull requests).

## README.md — section ใหม่ "Repository hygiene tooling"

```markdown
### Repository hygiene tooling

Publishing rules are enforced in three places:

- `.gitignore` and `.gitattributes` keep secrets, `DATA_DIR` state, build output, logs, and archives out of Git.
- `scripts/hygiene-check.mjs` scans the tree, the staged index, and reachable history for critical paths, credential patterns, and oversized files.
- `.githooks/pre-commit` and `.githooks/pre-push` block a commit or push that would publish a critical file. Register them once per clone with `npm run hooks:install`, and `.github/workflows/hygiene.yml` enforces the same policy on the server.

\`\`\`bash
npm run hooks:install    # once per clone
npm run hygiene          # tracked files plus untracked, non-ignored files
npm run hygiene:history  # every path reachable in history
\`\`\`
```

## docs/CURRENT_STATE.md — section ใหม่ "Publishing controls"

```markdown
## Publishing controls

- `.gitignore` covers secrets, `DATA_DIR` runtime state, build output, logs, databases, archives, and OS/editor files.
- `scripts/hygiene-check.mjs` audits the working tree, the staged index, the tracked files, and reachable history, with masked evidence.
- `.githooks/pre-commit` and `.githooks/pre-push` block a commit or push that breaks the policy; `npm run hooks:install` registers them per clone.
- `.github/workflows/hygiene.yml` applies the same policy on the server for every push and pull request.
- `scripts/prepare-clean-history.mjs` prepares a single-commit history after writing and verifying a backup. It never pushes.
```

## docs/RELEASE_CHECKLIST.md — เพิ่ม 2 ข้อ

```markdown
- [ ] `npm run hygiene` passed and no critical file is tracked
- [ ] `npm run hygiene:history` passed for the branch being released
```

## package.json — scripts ที่ toolkit เพิ่มให้

| Script | คำสั่ง |
| --- | --- |
| `hygiene` | `node scripts/hygiene-check.mjs` |
| `hygiene:staged` | `node scripts/hygiene-check.mjs --staged` |
| `hygiene:history` | `node scripts/hygiene-check.mjs --tracked --history` |
| `hygiene:report` | `node scripts/hygiene-check.mjs --tracked --history --report .hygiene-out/hygiene-report.md` |
| `hooks:install` | `node scripts/install-hooks.mjs` |
| `clean-history:prepare` | `node scripts/prepare-clean-history.mjs` |
| `untrack:runtime-data` | `node scripts/untrack-runtime-data.mjs` |
| `verify:publish` | `node scripts/hygiene-check.mjs --tracked --history --strict` |
| `toolkit:apply` | `node scripts/apply-toolkit.mjs` |
