# START HERE — ชุดเครื่องมือกันไฟล์สำคัญหลุด (hygiene toolkit)

ซิปนี้มีไฟล์ที่ต้อง "วางทับ" ลงในโปรเจกต์ของคุณ **ที่เครื่อง local**
โครงสร้างข้างในตรงกับโครงสร้าง repo แล้ว (แตกไฟล์ที่ root ของ repo ได้เลย)

## มีอะไรในซิป

| ไฟล์ | หน้าที่ |
| --- | --- |
| `.gitignore` | กฎกันไฟล์สำคัญ: `.env*`, `data/`, `server/data/`, keys, logs, DB, archives, build output |
| `.gitattributes` | eol สำหรับ hooks/scripts (ให้ทำงานถูกบน Windows) + ปิด diff ของไฟล์ runtime ที่หลุดมา |
| `.githooks/pre-commit` | บล็อก commit ที่มีไฟล์สำคัญหรือ credential |
| `.githooks/pre-push` | บล็อก push ที่ tree หรือ history ยังมีข้อมูลหลุด |
| `scripts/hygiene-check.mjs` | ตัวสแกน (path + credential + ขนาดไฟล์, ปิดบังค่าเป็น `###…`) |
| `scripts/untrack-runtime-data.mjs` | ปลด tracking ไฟล์ runtime/build โดยไม่ลบไฟล์ในเครื่อง + คืน `.gitkeep` + ตรวจ ignore |
| `scripts/prepare-clean-history.mjs` | backup + สร้าง history ใหม่ 1 commit (ไม่ push ให้) |
| `scripts/install-hooks.mjs` | ตั้ง `core.hooksPath` ให้แต่ละ clone |
| `scripts/apply-toolkit.mjs` | รวม `package.json` scripts + ติดตั้ง hooks + สแกน ให้อัตโนมัติ |
| `.github/workflows/hygiene.yml` | ตรวจซ้ำฝั่ง GitHub ทุก push/PR |
| `MANIFEST.sha256.txt` | SHA-256 ของทุกไฟล์ในซิป สำหรับ recheck หลังแตกไฟล์ |
| `docs/CLEAN_HISTORY_PUSH_RUNBOOK.md` | ขั้นตอนทั้งหมด (10 สเตป + troubleshooting) |
| `docs/OPTIONAL-DOC-UPDATES.md` | ข้อความที่ควรเพิ่มใน README/CURRENT_STATE/RELEASE_CHECKLIST |

ซิปนี้ **ไม่มีข้อมูลลับหรือข้อมูล runtime** (ตรวจด้วยตัวสแกนเอง)

## ตรวจไฟล์ในซิปทุกครั้ง (แนะนำ)

หลังแตกไฟล์ ให้เทียบ SHA-256 ของทุกไฟล์กับ manifest:

```bash
# macOS / Linux
sha256sum -c MANIFEST.sha256.txt        # ต้องขึ้น OK ทุกบรรทัด
```

```powershell
# Windows PowerShell
Get-Content MANIFEST.sha256.txt | Where-Object { $_ -notmatch '^#' -and $_.Trim() } | ForEach-Object {
  $hash, $file = $_ -split '  ', 2
  $actual = (Get-FileHash -Algorithm SHA256 $file).Hash.ToLower()
  if ($actual -ne $hash) { "MISMATCH: $file" } else { "OK: $file" }
}
```

ถ้าต้องการสร้าง/ตรวจซิปใหม่ในอนาคต (ไฟล์นี้อยู่ในโปรเจกต์):

```bash
node scripts/build-toolkit-zip.mjs      # สร้าง release/hygiene-toolkit.zip + manifest
node scripts/verify-toolkit-zip.mjs     # ตรวจ 14 รายการ: integrity, manifest, syntax, secret scan
```

## ขั้นตอน

```bash
# 1) แตกซิปที่ root ของโปรเจกต์
unzip hygiene-toolkit.zip -d /tmp/tk
cp -a /tmp/tk/modbus-workflow-studio-hygiene-toolkit/. .

# Windows PowerShell:
#   Expand-Archive hygiene-toolkit.zip -DestinationPath $env:TEMP\tk
#   Copy-Item "$env:TEMP\tk\modbus-workflow-studio-hygiene-toolkit\*" -Destination . -Recurse -Force

# 2) ติดตั้ง (dry run ก่อน แล้วค่อย --write)
node scripts/apply-toolkit.mjs
node scripts/apply-toolkit.mjs --write
```

ขั้นที่ 2 จะ merge แค่ `package.json → scripts` (สำรองเป็น `package.json.bak`),
ตั้ง `core.hooksPath=.githooks` และรันสแกนให้

## ถ้าสแกนไม่ผ่าน: repo ยัง track ไฟล์ runtime อยู่

อาการที่พบบ่อย (ไม่ใช่บั๊ก — เป็นการทำงานที่ถูกต้องของตัวสแกน):

```
[ERROR] server/data/devices.json        runtime-data: ...
[ERROR] client/tsconfig.tsbuildinfo     build-output: ...
hygiene-check [worktree] FAIL — files: N, errors: M
```

แก้โดยไม่ลบไฟล์ในเครื่อง:

```bash
node scripts/untrack-runtime-data.mjs            # ดูแผนก่อน
node scripts/untrack-runtime-data.mjs --write    # ปลด tracking + คืน .gitkeep + ตรวจ ignore
git commit -m "chore: stop tracking runtime data and build output"
node scripts/apply-toolkit.mjs                   # ต้องผ่านแล้ว
```

คำสั่งนี้ทำเฉพาะ `git rm --cached` (ไฟล์ยังอยู่บนดิสก์ครบ) ไม่ push และไม่แตะ history

## ขั้นต่อไป

1. `npm run hygiene` ต้อง PASS
2. `npm run clean-history:prepare` (dry run) → `node scripts/prepare-clean-history.mjs --execute --confirm=DELETE-OLD-HISTORY`
3. ลบ repo เก่า → สร้าง repo ใหม่ (private ก่อน) → `git push -u origin main` → ตรวจ → ค่อย public
4. อ่าน `docs/CLEAN_HISTORY_PUSH_RUNBOOK.md` สำหรับรายละเอียดและข้อจำกัดทั้งหมด (forks, clones, caches)

## หมายเหตุ

- หลังแตกไฟล์ ควรลบซิปทิ้ง หรือเก็บไว้นอก repo (`.gitignore` กัน `*.zip` ไว้อยู่แล้ว)
- hook ต้องมีสิทธิ์ execute บน macOS/Linux: `chmod +x .githooks/*`
- bypass ชั่วคราว: `HYGIENE_SKIP=1 git commit ...` (ใช้เฉพาะกรณีฉุกเฉิน)
