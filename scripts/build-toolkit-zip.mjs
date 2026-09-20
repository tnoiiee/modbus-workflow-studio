#!/usr/bin/env node
/**
 * Builds release/hygiene-toolkit.zip from the repository files.
 *
 * The archive is what an owner copies into a local checkout that does not have the
 * toolkit yet. Layout inside the archive mirrors the repository, so extracting it at
 * the repository root places every file at its final path.
 *
 * Usage:
 *   node scripts/build-toolkit-zip.mjs
 *
 * The output directory `release/` is ignored by Git; the generated archive must never
 * be committed, because a published archive defeats the purpose of the ignore rules.
 */

import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ARCHIVE_NAME = 'hygiene-toolkit.zip';
const ROOT_FOLDER = 'modbus-workflow-studio-hygiene-toolkit';
const OUTPUT_RELATIVE = path.join('release', ARCHIVE_NAME);

/** Source file -> destination inside the archive. */
const PAYLOAD = [
  ['.gitignore', '.gitignore'],
  ['.gitattributes', '.gitattributes'],
  ['.githooks/pre-commit', '.githooks/pre-commit'],
  ['.githooks/pre-push', '.githooks/pre-push'],
  ['.github/workflows/hygiene.yml', '.github/workflows/hygiene.yml'],
  ['scripts/hygiene-check.mjs', 'scripts/hygiene-check.mjs'],
  ['scripts/install-hooks.mjs', 'scripts/install-hooks.mjs'],
  ['scripts/prepare-clean-history.mjs', 'scripts/prepare-clean-history.mjs'],
  ['scripts/untrack-runtime-data.mjs', 'scripts/untrack-runtime-data.mjs'],
  ['scripts/apply-toolkit.mjs', 'scripts/apply-toolkit.mjs'],
  ['scripts/build-toolkit-zip.mjs', 'scripts/build-toolkit-zip.mjs'],
  ['scripts/verify-toolkit-zip.mjs', 'scripts/verify-toolkit-zip.mjs'],
  ['docs/CLEAN_HISTORY_PUSH_RUNBOOK.md', 'docs/CLEAN_HISTORY_PUSH_RUNBOOK.md'],
  ['docs/CLEAN_HISTORY_PUSH_RUNBOOK_TH.md', 'docs/CLEAN_HISTORY_PUSH_RUNBOOK_TH.md'],
];

const START_HERE = `# START HERE — ชุดเครื่องมือกันไฟล์สำคัญหลุด (hygiene toolkit)

ซิปนี้มีไฟล์ที่ต้อง "วางทับ" ลงในโปรเจกต์ของคุณ **ที่เครื่อง local**
โครงสร้างข้างในตรงกับโครงสร้าง repo แล้ว (แตกไฟล์ที่ root ของ repo ได้เลย)

## มีอะไรในซิป

| ไฟล์ | หน้าที่ |
| --- | --- |
| \`.gitignore\` | กฎกันไฟล์สำคัญ: \`.env*\`, \`data/\`, \`server/data/\`, keys, logs, DB, archives, build output |
| \`.gitattributes\` | eol สำหรับ hooks/scripts (ให้ทำงานถูกบน Windows) + ปิด diff ของไฟล์ runtime ที่หลุดมา |
| \`.githooks/pre-commit\` | บล็อก commit ที่มีไฟล์สำคัญหรือ credential |
| \`.githooks/pre-push\` | บล็อก push ที่ tree หรือ history ยังมีข้อมูลหลุด |
| \`scripts/hygiene-check.mjs\` | ตัวสแกน (path + credential + ขนาดไฟล์, ปิดบังค่าเป็น \`###…\`) |
| \`scripts/untrack-runtime-data.mjs\` | ปลด tracking ไฟล์ runtime/build โดยไม่ลบไฟล์ในเครื่อง + คืน \`.gitkeep\` + ตรวจ ignore |
| \`scripts/prepare-clean-history.mjs\` | backup + สร้าง history ใหม่ 1 commit (ไม่ push ให้) |
| \`scripts/install-hooks.mjs\` | ตั้ง \`core.hooksPath\` ให้แต่ละ clone |
| \`scripts/apply-toolkit.mjs\` | รวม \`package.json\` scripts + ติดตั้ง hooks + สแกน ให้อัตโนมัติ |
| \`.github/workflows/hygiene.yml\` | ตรวจซ้ำฝั่ง GitHub ทุก push/PR |
| \`MANIFEST.sha256.txt\` | SHA-256 ของทุกไฟล์ในซิป สำหรับ recheck หลังแตกไฟล์ |
| \`docs/CLEAN_HISTORY_PUSH_RUNBOOK.md\` | ขั้นตอนทั้งหมด (10 สเตป + troubleshooting) |
| \`docs/CLEAN_HISTORY_PUSH_RUNBOOK_TH.md\` | ฉบับภาษาไทยของ runbook |
| \`docs/OPTIONAL-DOC-UPDATES.md\` | ข้อความที่ควรเพิ่มใน README/CURRENT_STATE/RELEASE_CHECKLIST |

ซิปนี้ **ไม่มีข้อมูลลับหรือข้อมูล runtime** (ตรวจด้วยตัวสแกนเอง)

## ตรวจไฟล์ในซิปทุกครั้ง (แนะนำ)

หลังแตกไฟล์ ให้เทียบ SHA-256 ของทุกไฟล์กับ manifest:

\`\`\`bash
# macOS / Linux
sha256sum -c MANIFEST.sha256.txt        # ต้องขึ้น OK ทุกบรรทัด
\`\`\`

\`\`\`powershell
# Windows PowerShell
Get-Content MANIFEST.sha256.txt | Where-Object { $_ -notmatch '^#' -and $_.Trim() } | ForEach-Object {
  $hash, $file = $_ -split '  ', 2
  $actual = (Get-FileHash -Algorithm SHA256 $file).Hash.ToLower()
  if ($actual -ne $hash) { "MISMATCH: $file" } else { "OK: $file" }
}
\`\`\`

ถ้าต้องการสร้าง/ตรวจซิปใหม่ในอนาคต (ไฟล์นี้อยู่ในโปรเจกต์):

\`\`\`bash
node scripts/build-toolkit-zip.mjs      # สร้าง release/hygiene-toolkit.zip + manifest
node scripts/verify-toolkit-zip.mjs     # ตรวจ 14 รายการ: integrity, manifest, syntax, secret scan
\`\`\`

## ขั้นตอน

\`\`\`bash
# 1) แตกซิปที่ root ของโปรเจกต์
unzip hygiene-toolkit.zip -d /tmp/tk
cp -a /tmp/tk/${ROOT_FOLDER}/. .

# Windows PowerShell:
#   Expand-Archive hygiene-toolkit.zip -DestinationPath $env:TEMP\\tk
#   Copy-Item "$env:TEMP\\tk\\${ROOT_FOLDER}\\*" -Destination . -Recurse -Force

# 2) ติดตั้ง (dry run ก่อน แล้วค่อย --write)
node scripts/apply-toolkit.mjs
node scripts/apply-toolkit.mjs --write
\`\`\`

ขั้นที่ 2 จะ merge แค่ \`package.json → scripts\` (สำรองเป็น \`package.json.bak\`),
ตั้ง \`core.hooksPath=.githooks\` และรันสแกนให้

## ถ้าสแกนไม่ผ่าน: repo ยัง track ไฟล์ runtime อยู่

อาการที่พบบ่อย (ไม่ใช่บั๊ก — เป็นการทำงานที่ถูกต้องของตัวสแกน):

\`\`\`
[ERROR] server/data/devices.json        runtime-data: ...
[ERROR] client/tsconfig.tsbuildinfo     build-output: ...
hygiene-check [tree+history] FAIL — files: N, errors: M, warnings: W
tree: X error(s) · history: Y error(s)
\`\`\`

แก้โดยไม่ลบไฟล์ในเครื่อง:

\`\`\`bash
node scripts/untrack-runtime-data.mjs            # ดูแผนก่อน
node scripts/untrack-runtime-data.mjs --write    # ปลด tracking + คืน .gitkeep + ตรวจ ignore
git commit -m "chore: stop tracking runtime data and build output"
node scripts/apply-toolkit.mjs                   # ต้องผ่านแล้ว
\`\`\`

คำสั่งนี้ทำเฉพาะ \`git rm --cached\` (ไฟล์ยังอยู่บนดิสก์ครบ) ไม่ push และไม่แตะ history

## ขั้นต่อไป

1. \`npm run hygiene\` ต้อง PASS
2. \`npm run hygiene:all\` ต้อง PASS ทั้ง tracked tree และ reachable history
3. \`npm run clean-history:prepare\` (dry run) → \`node scripts/prepare-clean-history.mjs --execute --confirm=DELETE-OLD-HISTORY\`
4. ลบ repo เก่า → สร้าง repo ใหม่ (private ก่อน) → \`git push -u origin main\` → ตรวจ → ค่อย public
5. อ่าน \`docs/CLEAN_HISTORY_PUSH_RUNBOOK.md\` สำหรับรายละเอียดและข้อจำกัดทั้งหมด (forks, clones, caches)

## หมายเหตุ

- หลังแตกไฟล์ ควรลบซิปทิ้ง หรือเก็บไว้นอก repo (\`.gitignore\` กัน \`*.zip\` ไว้อยู่แล้ว)
- hook ต้องมีสิทธิ์ execute บน macOS/Linux: \`chmod +x .githooks/*\`
- bypass ชั่วคราว: \`HYGIENE_SKIP=1 git commit ...\` (ใช้เฉพาะกรณีฉุกเฉิน)
`;

const OPTIONAL_DOC_UPDATES = `# Optional documentation updates

ข้อความด้านล่างคือสิ่งที่ควรเพิ่มในเอกสารของ repo หลังติดตั้ง toolkit
ถ้าไฟล์ของคุณแก้ไปแล้ว ให้ใช้เป็นแนวทาง ไม่ต้องทับทั้งไฟล์

## README.md — แทนย่อหน้าเรื่อง runtime-history

> The v1.2.9 cleanup removes runtime artifacts from the active tree. It does not erase data from
> previously published Git history; the repository owner must complete the separate operational
> remediation described in \`docs/CLEAN_HISTORY_PUSH_RUNBOOK.md\` (fresh history, complete removal)
> or \`docs/HISTORY_REWRITE_RUNBOOK.md\` (rewrite in place, keeps issues and pull requests).

## README.md — section ใหม่ "Repository hygiene tooling"

\`\`\`markdown
### Repository hygiene tooling

Publishing rules are enforced in three places:

- \`.gitignore\` and \`.gitattributes\` keep secrets, \`DATA_DIR\` state, build output, logs, and archives out of Git.
- \`scripts/hygiene-check.mjs\` scans the tree, the staged index, and reachable history for critical paths, credential patterns, and oversized files.
- \`.githooks/pre-commit\` and \`.githooks/pre-push\` block a commit or push that would publish a critical file. Register them once per clone with \`npm run hooks:install\`, and \`.github/workflows/hygiene.yml\` enforces the same policy on the server.

\\\`\\\`\\\`bash
npm run hooks:install    # once per clone
npm run hygiene          # tracked files plus untracked, non-ignored files
npm run hygiene:history  # every path reachable in history
npm run hygiene:all      # tracked tree plus reachable history in one run
\\\`\\\`\\\`
\`\`\`

## docs/CURRENT_STATE.md — section ใหม่ "Publishing controls"

\`\`\`markdown
## Publishing controls

- \`.gitignore\` covers secrets, \`DATA_DIR\` runtime state, build output, logs, databases, archives, and OS/editor files.
- \`scripts/hygiene-check.mjs\` audits the working tree, the staged index, the tracked files, and reachable history, with masked evidence.
- \`.githooks/pre-commit\` and \`.githooks/pre-push\` block a commit or push that breaks the policy; \`npm run hooks:install\` registers them per clone.
- \`.github/workflows/hygiene.yml\` applies the same policy on the server for every push and pull request.
- \`scripts/prepare-clean-history.mjs\` prepares a single-commit history after writing and verifying a backup. It never pushes.
\`\`\`

## docs/RELEASE_CHECKLIST.md — เพิ่ม 2 ข้อ

\`\`\`markdown
- [ ] \`npm run hygiene\` passed and no critical file is tracked
- [ ] \`npm run hygiene:history\` passed for the branch being released
- [ ] \`npm run hygiene:all\` passed for the tracked tree and reachable history
\`\`\`

## package.json — scripts ที่ toolkit เพิ่มให้

| Script | คำสั่ง |
| --- | --- |
| \`hygiene\` | \`node scripts/hygiene-check.mjs\` |
| \`hygiene:staged\` | \`node scripts/hygiene-check.mjs --staged\` |
| \`hygiene:history\` | \`node scripts/hygiene-check.mjs --history\` |
| \`hygiene:all\` | \`node scripts/hygiene-check.mjs --all\` |
| \`hygiene:report\` | \`node scripts/hygiene-check.mjs --all --strict --report .hygiene-out/hygiene-report.md\` |
| \`hooks:install\` | \`node scripts/install-hooks.mjs\` |
| \`clean-history:prepare\` | \`node scripts/prepare-clean-history.mjs\` |
| \`untrack:runtime-data\` | \`node scripts/untrack-runtime-data.mjs\` |
| \`verify:publish\` | \`node scripts/hygiene-check.mjs --all --strict\` |
| \`toolkit:apply\` | \`node scripts/apply-toolkit.mjs\` |
`;

function fail(message) {
  process.stderr.write(`build-toolkit-zip: ${message}\n`);
  process.exit(1);
}

function listFilesRecursively(directory, prefix = '') {
  const entries = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) entries.push(...listFilesRecursively(path.join(directory, entry.name), relative));
    else entries.push(relative);
  }
  return entries;
}

function countArchiveFiles(archivePath) {
  const names = spawnSync('unzip', ['-Z1', archivePath], { encoding: 'utf8' });
  if (names.status === 0) {
    return (names.stdout ?? '')
      .split(/\r?\n/)
      .filter((name) => name.startsWith(`${ROOT_FOLDER}/`) && name.length > ROOT_FOLDER.length + 1 && !name.endsWith('/'))
      .length;
  }

  // Older unzip implementations may not support -Z1. The long listing still
  // gives one line per archive entry; parse only entries whose name is a file.
  const listing = spawnSync('unzip', ['-l', archivePath], { encoding: 'utf8' });
  return (listing.stdout ?? '')
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*\d+\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\s+(.+)$/)?.[1] ?? '')
    .filter((name) => name.startsWith(`${ROOT_FOLDER}/`) && !name.endsWith('/'))
    .length;
}

function main() {
  const root = process.cwd();
  if (!fs.existsSync(path.join(root, 'package.json')) || !fs.existsSync(path.join(root, 'scripts'))) {
    fail('run this from the repository root.');
  }

  const stagingRoot = fs.mkdtempSync(path.join(process.env.TMPDIR ?? process.env.TEMP ?? '/tmp', 'mws-toolkit-'));
  const staging = path.join(stagingRoot, ROOT_FOLDER);
  let missing = 0;

  for (const [source] of PAYLOAD) {
    const from = path.join(root, source);
    if (!fs.existsSync(from)) {
      process.stderr.write(`  missing: ${source}\n`);
      missing += 1;
    }
  }
  if (missing > 0) fail(`${missing} payload file(s) are missing.`);

  for (const [source, destination] of PAYLOAD) {
    const to = path.join(staging, destination);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(root, source), to);
    if (destination.endsWith('.mjs') || destination.startsWith('.githooks/')) {
      fs.chmodSync(to, 0o755);
    }
  }
  fs.writeFileSync(path.join(staging, 'START-HERE.md'), START_HERE, 'utf8');
  fs.mkdirSync(path.join(staging, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(staging, 'docs', 'OPTIONAL-DOC-UPDATES.md'), OPTIONAL_DOC_UPDATES, 'utf8');

  // Per-file checksums so the recipient can re-verify every file after extraction.
  const manifestLines = [];
  for (const relative of listFilesRecursively(staging)) {
    const checksum = crypto.createHash('sha256').update(fs.readFileSync(path.join(staging, relative))).digest('hex');
    manifestLines.push(`${checksum}  ${relative}`);
  }
  manifestLines.sort();
  fs.writeFileSync(
    path.join(staging, 'MANIFEST.sha256.txt'),
    [
      `# ${ARCHIVE_NAME} — per-file SHA-256`,
      '# Verify after extracting at the repository root:',
      '#   macOS/Linux:  (cd <extracted folder> && sha256sum -c MANIFEST.sha256.txt)',
      '#   Windows:      Get-FileHash -Algorithm SHA256 .\\<file>   # compare one by one',
      '# MANIFEST.sha256.txt itself is not listed (it is written last).',
      '',
      ...manifestLines,
      '',
    ].join('\n'),
    'utf8',
  );

  const outputDirectory = path.join(root, 'release');
  fs.mkdirSync(outputDirectory, { recursive: true });
  const outputPath = path.join(root, OUTPUT_RELATIVE);
  fs.rmSync(outputPath, { force: true });

  const zip = spawnSync('zip', ['-r', '-q', outputPath, ROOT_FOLDER], { cwd: stagingRoot, encoding: 'utf8' });
  if (zip.status !== 0) {
    const pythonZip = spawnSync(
      'python3',
      ['-c', `import shutil,sys; shutil.make_archive(sys.argv[1],'zip',sys.argv[2],sys.argv[3])`, outputPath.replace(/\.zip$/, ''), stagingRoot, ROOT_FOLDER],
      { encoding: 'utf8' },
    );
    if (pythonZip.status !== 0) fail('no usable zip tool (install `zip` or `python3`).');
  }

  fs.rmSync(stagingRoot, { recursive: true, force: true });

  const buffer = fs.readFileSync(outputPath);
  const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
  // Count payload files, not the directory entries that zip adds for parent folders.
  const fileCount = countArchiveFiles(outputPath);

  process.stdout.write(
    [
      `Archive:  ${OUTPUT_RELATIVE}`,
      `Size:     ${buffer.length} bytes`,
      `Files:    ${fileCount}`,
      `SHA-256:  ${checksum}`,
      '',
      'Do not commit the archive (release/ is ignored). Publish it as a release asset or hand it over directly.',
      'Verify its payload with: unzip -q <archive> -d /tmp/tk && cd /tmp/tk/' + ROOT_FOLDER + ' && node scripts/hygiene-check.mjs',
      '',
    ].join('\n'),
  );
}

main();
