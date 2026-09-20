# คู่มือทำความสะอาด Git history และ push ใหม่

[อ่านฉบับภาษาอังกฤษ](CLEAN_HISTORY_PUSH_RUNBOOK.md) | **ฉบับภาษาไทย**

## สถานะและผู้อ่าน

เอกสารนี้เป็นขั้นตอนสำหรับ **เจ้าของ repository / ผู้ดูแลระบบ / ผู้รับผิดชอบการเผยแพร่** ไม่ใช่ขั้นตอนที่ผู้ร่วมพัฒนาทั่วไปต้องทำใน pull request ปกติ

บริบทของ `modbus-workflow-studio` v1.2.10 คือ repository ใหม่มีประวัติสะอาดเพียง 1 commit แล้ว จึงไม่ต้อง rewrite history อีก การตรวจสอบและนโยบายในเอกสารนี้ยังคงเป็น runbook สำหรับกรณีที่ checkout อื่นหรือ repository อื่นเคยเผยแพร่ runtime data, device endpoint, audit record, credential หรือ build output

- runtime data ได้แก่ `data/**`, `server/data/**` เช่น `audit.json`, `devices.json`, monitor lists และ workflows
- build output ได้แก่ `*.tsbuildinfo`, `dist/`, `coverage/` และไฟล์ generated อื่น ๆ
- ห้ามนำ backup ที่มีข้อมูลเดิมกลับเข้า Git หรือแนบใน issue, chat, PR หรือ artifact สาธารณะ
- ตั้งค่า hook แยกในแต่ละ clone ด้วย `npm run hooks:install` เพราะ Git ไม่ clone `.githooks` ให้ใช้งานโดยอัตโนมัติ

ฉบับนี้เชื่อมกับ [ฉบับภาษาอังกฤษ](CLEAN_HISTORY_PUSH_RUNBOOK.md) และฉบับภาษาอังกฤษควรเชื่อมกลับมาที่ไฟล์นี้เมื่อมีการแก้ไขขั้นตอนสำคัญ

## ตารางตัดสินใจ: repository ใหม่ หรือ rewrite ในที่เดิม

| ทางเลือก | ใช้เมื่อ | ผลต่อประวัติและผู้ใช้ | คำแนะนำ |
| --- | --- | --- | --- |
| สร้าง repository ใหม่ แล้ว push clean first commit | มีข้อมูลปฏิบัติการหรือ credential หลุด และต้องการจุดเริ่มต้นที่ตรวจสอบได้ | issues, PR, stars และ watchers ของ repo เดิมไม่ย้ายมา; ทุกคนต้อง clone ใหม่ | แนะนำสำหรับข้อมูลที่ถูกเผยแพร่จริง |
| Rewrite history ใน repository เดิม | ต้องรักษา issues/PR และยอมรับภาระจัดการ refs, forks และ cache | force-push ไม่ลบ object ที่อยู่ใน PR refs, fork, clone หรือระบบสำรองโดยอัตโนมัติ | ใช้เมื่อเจ้าของประเมินผลกระทบครบแล้วเท่านั้น |

การลบไฟล์ออกจาก commit ล่าสุดไม่เท่ากับการลบออกจาก history การเลือก repository ใหม่ทำให้ผลลัพธ์สุดท้ายเข้าใจง่ายกว่า แต่ก็ไม่ได้ลบสำเนาที่อยู่นอก repository เดิม

## ตารางเครื่องมือ

| เครื่องมือ | หน้าที่ | ข้อควรจำ |
| --- | --- | --- |
| `scripts/hygiene-check.mjs` | ตรวจ tree, staged index, tracked tree และ reachable history | `--all` คือ tracked tree + history ในรันเดียว; `--strict` เปลี่ยน warning เป็น error |
| `scripts/untrack-runtime-data.mjs` | `git rm --cached` runtime/build โดยไม่ลบไฟล์บน disk, คืน `.gitkeep`, เติม ignore block และตรวจซ้ำ | ไฟล์ `.env`, key และ credential แค่รายงาน ไม่ตัดสินแทนคน |
| `scripts/prepare-clean-history.mjs` | backup `.git`, bundle, รายการ refs และสร้าง history ใหม่แบบ reinit | ค่าเริ่มต้นเป็น dry run; ไม่ push และไม่ตั้ง remote |
| `scripts/apply-toolkit.mjs` | merge เฉพาะ `package.json` → `scripts`, backup `package.json.bak`, ติดตั้ง hook และสแกน | ใช้ `--write` เมื่อตั้งใจแก้ไฟล์จริง |
| `scripts/build-toolkit-zip.mjs` | สร้าง `release/hygiene-toolkit.zip` พร้อม manifest SHA-256 ภายใน payload | `release/` ถูก ignore ไม่ควร commit |
| `scripts/verify-toolkit-zip.mjs` | ตรวจ ZIP, payload, manifest, syntax, hook, YAML และ hygiene scan | ต้องได้ `14/14` เมื่อมี ZIP |
| `npm run hooks:install` | ตั้ง `core.hooksPath=.githooks` ใน clone ปัจจุบัน | ต้องรันหลัง clone ใหม่ทุกครั้ง |
| `gh` / GitHub UI | สร้าง PR, ตรวจ Actions, ตั้ง secret scanning และ push protection | ไม่ใช่เครื่องมือสำหรับลบ fork/clone ของคนอื่น |

## สคริปต์ทำอะไรไปแล้ว 10 ข้อ

ตารางนี้อธิบายสิ่งที่ `prepare-clean-history.mjs` ทำเมื่อสั่ง execute สำเร็จ โดย **ข้อ 10 คือยังไม่ push** อย่างชัดเจน:

| ข้อ | สิ่งที่สคริปต์ทำ |
| ---: | --- |
| 1 | ตรวจว่าอยู่ใน Git repository และตรวจ branch/ตัวเลือกที่ขอ |
| 2 | ถ้า tree ไม่สะอาด จะหยุดก่อน เว้นแต่มี `--allow-dirty` |
| 3 | รัน hygiene scan กับ tree และรายงาน history เดิมแบบ soft warning ก่อนทำลาย history |
| 4 | สร้าง backup directory ที่ต้องว่าง และคัดลอก `.git` ทั้งโฟลเดอร์ไว้ที่ `git-directory/` |
| 5 | สร้างและ verify `history.bundle`; ถ้า clone bundle ไม่ได้จะรายงานและให้ใช้ `git-directory/` |
| 6 | เก็บ `tracked-files.txt`, `refs.txt`, `log.txt`, `status.txt`, `stashes.txt` และ `RESTORE.md` |
| 7 | เมื่อใช้ `--allow-dirty` เก็บ `working-tree.patch`, `staged.patch`, `untracked/` และ `untracked-files.txt` |
| 8 | โหมด `reinit` ลบ `.git`, รัน `git init -b <branch>`, คืน identity/line-ending config, `add -A` และ commit เดียว |
| 9 | ตั้ง `core.hooksPath=.githooks` แล้วสแกน `--all --strict` หลังสร้าง commit |
| 10 | **ไม่ push และไม่ตั้ง remote**; แค่พิมพ์คำสั่งให้เจ้าของตรวจแล้วรันเอง |

## ขั้นที่ 0 — ตรวจว่ามี toolkit และ npm scripts แล้ว

จาก root ของ repository:

```bash
npm run verify:publish
```

ถ้าเห็นข้อความ `npm error ... To see a list of scripts` แปลว่ายังไม่ได้ merge scripts ลง `package.json` ไม่ใช่ผลตรวจที่ผ่าน ให้ใช้ fallback นี้ก่อน:

```bash
node scripts/hygiene-check.mjs --all --strict
node scripts/apply-toolkit.mjs --write
```

ตรวจ `git diff package.json` แล้วจึงเรียก `npm run verify:publish` อีกครั้ง อย่าตีความการที่ npm หา script ไม่เจอว่า hygiene ผ่าน

## ขั้นที่ 1 — ติดตั้ง hook ใน clone นี้

```bash
npm run hooks:install
git config --get core.hooksPath
```

ค่าที่คาดหวังคือ `.githooks` ตรวจ permission ของ hook บน macOS/Linux ด้วย `ls -l .githooks/` และตรวจว่า `pre-commit` กับ `pre-push` มี execute bit

## ขั้นที่ 2 — ตรวจ tree, staged และ history ก่อนแก้

```bash
npm run hygiene
npm run hygiene:staged
npm run hygiene:history
npm run hygiene:all
```

`npm run hygiene` ตรวจ tracked files รวมถึง untracked ที่ไม่ถูก ignore ส่วน `--history` ตรวจทุก path ที่ reachable ใน history

ถ้ายัง track runtime/build ให้ดูแผนก่อน แล้วค่อย apply:

```bash
npm run untrack:runtime-data
npm run untrack:runtime-data -- --write
# หรือ
node scripts/untrack-runtime-data.mjs --write
```

คำสั่งนี้ใช้ `git rm --cached` เท่านั้น ไฟล์ยังอยู่บน disk เติม `data/.gitkeep` และ `server/data/.gitkeep`, ตรวจด้วย `git check-ignore -v --no-index -- <path>`, เติม managed ignore block หากยังไม่มี และรัน scanner กับ staged index และ worktree ปิดท้าย

ถ้าเป็น `.env`, key, credential หรือ content ที่ดูเป็น secret สคริปต์จะรายงานแต่ไม่ลบหรือ rotate ให้ ต้องตัดสินใจเองก่อน และต้องถือว่าค่าที่เคย publish ถูกเปิดเผยแล้ว

## ขั้นที่ 3 — สร้าง backup ที่เข้าถึงได้เฉพาะผู้ดูแล

รัน dry run ก่อน:

```bash
npm run clean-history:prepare
```

เมื่อพร้อมจริง ให้ใช้ backup path นอก repository หรือระบุ path ที่ยังไม่มีไฟล์:

```bash
node scripts/prepare-clean-history.mjs \
  --execute --confirm=DELETE-OLD-HISTORY \
  --backup-dir=../modbus-workflow-studio-history-backup-YYYYMMDD
```

backup ต้องมี `git-directory/`, `history.bundle`, `RESTORE.md`, `tracked-files.txt`, `refs.txt`, `log.txt`, `status.txt` และ `stashes.txt` เสมอ ส่วน `--allow-dirty` จะเพิ่ม patch และสำเนา untracked

ถ้า repository shallow หรือ fetch มาไม่ครบ การ verify/clone bundle อาจล้มเหลว สคริปต์ต้องรายงานสถานะนั้น แต่ห้ามลบ `git-directory/` เพราะนั่นคือ recovery path ที่ใช้ได้เสมอ

## ขั้นที่ 4 — จัดการ working tree ที่ไม่สะอาด

ถ้า execute โดยไม่ใส่ `--allow-dirty` แล้วมีการแก้ไข สคริปต์ต้องหยุดพร้อมทางเลือก 2 ทาง:

- **A:** งานที่ยังไม่ commit คือเวอร์ชันที่ต้องการ publish ให้ใช้ `--allow-dirty` สคริปต์จะเก็บ `working-tree.patch` จาก `git diff HEAD --binary`, `staged.patch` จาก `git diff --cached --binary` และคัดลอก untracked ไป `untracked/`
- **B:** งานที่ยังไม่เสร็จไม่ควร publish ให้ commit หรือ stash ก่อน แล้วรันใหม่โดยไม่ใช้ `--allow-dirty`

อ่าน `RESTORE.md` สำหรับคำสั่ง `git apply --binary` และการคัดลอก `untracked/` กลับ อย่าใช้ `--allow-dirty` เพียงเพื่อข้าม safety gate โดยไม่ตรวจเนื้อหา

## ขั้นที่ 5 — สร้าง clean history แบบหนึ่ง commit

หลังแก้ tree ให้รัน dry run แล้ว execute:

```bash
npm run clean-history:prepare
node scripts/prepare-clean-history.mjs \
  --execute --confirm=DELETE-OLD-HISTORY \
  --branch=main \
  --message="chore: publish modbus-workflow-studio v1.2.10"
```

โหมด `reinit` เป็นค่าเริ่มต้นและทำดังนี้:

1. ตรวจ tree ที่จะ publish และ audit history เดิม
2. backup `.git` และ metadata ทั้งหมด
3. ลบ `.git` แล้ว `git init -b main`
4. คืน `user.name`, `user.email` และ config เรื่อง line ending ที่บันทึกไว้
5. `git add -A` แล้วสร้าง commit เดียว
6. ตั้ง `core.hooksPath=.githooks`
7. สแกน `--all --strict`
8. ไม่ push และไม่ตั้ง remote

ถ้า commit ล้มเหลว สคริปต์ต้องพิมพ์ recovery message ที่ชี้ไป backup path ให้ใช้ `RESTORE.md`, `git clone history.bundle ...` เมื่อ bundle ใช้ได้ หรือคืน `.git` จาก `git-directory/` ห้าม push จนกว่าจะ verify สำเร็จ

## ขั้นที่ 6 — ตรวจผล local และความต่างกับ backup

```bash
git status --short --branch
git rev-list --all --count       # ต้องได้ 1
git log --oneline --all
node scripts/hygiene-check.mjs --all --strict
```

เปรียบเทียบ `tracked-files.txt` ใน backup กับ `git ls-files` หรือรายการจาก commit ใหม่เพื่ออธิบายไฟล์ที่หายไป:

- ถ้าเดิมยัง track runtime จะเห็นบรรทัดลักษณะ `-  server/data/....json`
- ถ้า tree สะอาดอยู่แล้ว diff อาจไม่มีผลต่างเลย เป็นเรื่องปกติ เพราะสิ่งที่ถูกลบคือ object ใน history ไม่ใช่รายการไฟล์ปัจจุบัน
- หลักฐานสำคัญคือ `node scripts/hygiene-check.mjs --history` ต้องได้ 0 errors

## ขั้นที่ 7 — สร้าง repository ใหม่และ push ด้วยมือ

1. สร้าง empty repository ใหม่ก่อน โดยยังเป็น private และไม่ให้ GitHub สร้าง README, license หรือ `.gitignore`
2. เพิ่ม remote ด้วยตนเอง หลังตรวจ clean commit แล้วเท่านั้น
3. push branch `main`

```bash
git remote add origin https://github.com/<owner>/<new-repository>.git
git push -u origin main
```

สคริปต์ไม่รับผิดชอบการตั้ง remote และไม่ push ให้อัตโนมัติ จุดนี้ตั้งใจให้คนตรวจ URL และสิทธิ์ก่อน

## ขั้นที่ 8 — ตรวจ repository บน GitHub และ fresh clone

ใช้คำสั่งที่ตรวจ tree ของ commit/remote จริง ไม่ใช้ `git ls-files` แทน:

```bash
git ls-tree -r --name-only origin/main
git ls-tree -r --name-only origin/main | grep -E '^(data|server/data)/'
# ต้องมีเพียง data/.gitkeep และ server/data/.gitkeep

git rev-list --objects --all | grep -E 'server/data/(audit|devices|monitor-lists|workflow|workflows)|tsbuildinfo' || echo "ไม่พบ ✓"
git rev-list --all --count       # ต้องได้ 1

git clone -b main https://github.com/<owner>/<new-repository>.git verify-clean
cd verify-clean
npm run hygiene
npm run hygiene:history
```

ตรวจว่าไม่มี `.env`, key, credential, `server/data` runtime files หรือ build output ก่อนเปลี่ยน visibility เป็น public และตรวจผล `Check`/`Hygiene` ใน GitHub Actions

## ขั้นที่ 9 — harden และแจ้งผู้ร่วมพัฒนา

เปิด secret scanning, push protection, Dependabot และ branch protection ตามนโยบายขององค์กร ตั้ง `main` ให้ต้องผ่าน PR และ required checks ก่อน merge

แจ้งผู้ร่วมพัฒนาทุกคนให้ลบหรือย้าย clone เดิม แล้ว clone ใหม่ด้วย `-b main` และรัน:

```bash
npm run hooks:install
```

ห้ามนำ branch ที่สร้างจาก clone เก่ามา push เข้า repository ใหม่ เพราะ branch นั้นอาจมี object เดิมติดไปด้วย

## ขั้นที่ 10 — บันทึกผลและเก็บ backup ตาม retention policy

อัปเดต `docs/CURRENT_STATE.md` ด้วย commit SHA, วันที่, URL และสถานะว่า history remediation เสร็จแล้วหรือยังต้อง rewrite ตรวจ `docs/RELEASE_CHECKLIST.md`, acceptance evidence และ CI result ตามจริง

เก็บ backup ในที่ access-controlled ชั่วคราวตามนโยบายองค์กร แล้วทำลายเมื่อครบ retention การเก็บ backup ไว้นานไม่ใช่การลบข้อมูลที่เคยหลุด และ backup ห้ามอยู่ใน Git

## ทางเลือก manual: ทำเองโดยไม่ใช้สคริปต์

ใช้เฉพาะเมื่อเข้าใจผลกระทบและมี backup แล้ว ตัวอย่างนี้ตั้งใจสร้าง branch `main` ใหม่:

```bash
cd <repository>
mkdir -p ../history-backup
git bundle create ../history-backup/history.bundle --all || true
cp -a .git ../history-backup/git-directory
printf '%s\n' "$(git ls-files)" > ../history-backup/tracked-files.txt

git status --short
# แก้/ยกเลิก dirty work ตามที่ตัดสินใจก่อนขั้น destructive
rm -rf .git
git init -b main
git add -A
git commit -m "chore: publish modbus-workflow-studio v1.2.10"
npm run hooks:install
node scripts/hygiene-check.mjs --all --strict
```

คำสั่ง manual ไม่มีการ clone-check bundle, ไม่มี `RESTORE.md` อัตโนมัติ และอาจพลาด config/refs หากไม่บันทึกเอง ดังนั้นใช้สคริปต์เป็นทางเลือกหลัก

## สิ่งที่ขั้นตอนนี้ทำไม่ได้

| สิ่งที่อยู่นอกขอบเขต | ความจริงและสิ่งที่ต้องทำต่อ |
| --- | --- |
| fork | fork มี object และ refs ของตัวเอง เจ้าของ fork หรือ GitHub Support ต้องจัดการ |
| clone ของผู้ร่วมพัฒนา | ลบ/ย้าย clone เดิมแล้ว clone ใหม่ ไม่ควร force-push branch เดิมกลับมา |
| CI cache และ artifact | ลบ cache, artifact, backup และ release asset ของระบบเก่าตามสิทธิ์ |
| GitHub PR refs / tags / branches เดิม | ตรวจและ retire/delete repository เดิม; force-push อย่างเดียวไม่รับประกันการลบ |
| search index และ code-search site | ขอ removal จากผู้ให้บริการที่เกี่ยวข้อง ไม่สามารถสั่งจาก Git ได้ |
| screenshot, chat, issue attachment และ log | ต้องลบหรือจำกัดการเข้าถึงในระบบต้นทาง |
| backup ขององค์กรหรือ mirror | ทำ incident response และ retention deletion ตามเจ้าของระบบ |
| credential ที่เคย publish | ถือว่าถูกเปิดเผย ต้อง rotate/revoke แม้หาใน tree ใหม่ไม่พบ |
| device topology/IP ที่เคยหลุด | ตรวจ access control, firewall และ audit log เพิ่ม; Git cleanup ไม่ undo การรับรู้ข้อมูล |

## ตารางแก้ปัญหา 9 เคส

| เคส | สาเหตุ | วิธีแก้ |
| ---: | --- | --- |
| 1. `npm error ... To see a list of scripts` | ยังไม่ได้ merge package scripts | รัน `node scripts/hygiene-check.mjs --all --strict` เป็น fallback แล้ว `node scripts/apply-toolkit.mjs --write` |
| 2. execute หยุดเพราะ dirty tree | มี staged/unstaged/untracked work และไม่ได้อนุญาต | เลือก commit/stash ก่อน หรือใช้ `--allow-dirty` แล้วตรวจ patch/untracked ใน backup |
| 3. `runtime-data` ยังเป็น error | ไฟล์ยัง tracked หรือ ignore rule ไม่ครอบ | รัน `node scripts/untrack-runtime-data.mjs --write`; ตรวจ `git check-ignore -v --no-index -- <path>` |
| 4. พบ `.env`, key หรือ credential | เป็นข้อมูลที่ต้องให้คนตัดสินและ rotate | ห้ามให้ untrack script ลบแทน; rotate/revoke แล้วทำ clean history ตาม incident policy |
| 5. `Bundle restore check: FAILED` | repository shallow/partial หรือ bundle ขาดฐาน | อย่าลบ backup; ใช้ `git-directory/` ตาม `RESTORE.md` และแจ้งสถานะในผลส่งงาน |
| 6. clean commit ล้มเหลว | identity, hook, permission, line ending หรือ Git error | ใช้ recovery message, ตรวจ `git status`, กู้ `.git` จาก backup และแก้ error ก่อนลองใหม่ |
| 7. `hygiene-check [history] FAIL` หรือ history error หลัง reinit | มี ref, tag, stash หรือ remote object เก่าค้าง | ตรวจ `git for-each-ref`, `git stash list`; ใช้ reinit หรือ prune ตามที่ผู้ดูแลอนุมัติ |
| 8. push ถูก GitHub push protection ปฏิเสธ | มี credential จริงใน commit หรือ history | หยุด push, rotate credential, แก้ commit ใหม่ และตรวจ scanner อย่าปิด protection |
| 9. remote มีไฟล์เก่าหรือ commit ไม่ใช่ 1 | push ผิด remote/branch หรือ repository ไม่ว่าง | หยุดเผยแพร่, ตรวจ `git ls-tree -r --name-only origin/main` และ `git rev-list --all --count`, ลบ repo ใหม่ที่ผิดแล้วเริ่มจาก clean commit |

## นโยบาย `HYGIENE_SKIP`

`HYGIENE_SKIP=1` เป็น emergency bypass เท่านั้น ใช้ได้เมื่อมีเหตุผลที่บันทึกได้และคนรับผิดชอบ review เนื้อหาทุกไฟล์ด้วยมือก่อน commit/push เช่น:

```bash
HYGIENE_SKIP=1 git commit -m "เหตุผลที่ได้รับอนุมัติ"
HYGIENE_SKIP=1 git push origin main
```

ทุก bypass ต้องอธิบายใน PR/incident record ที่ตามมา พร้อมผลตรวจ manual และแผนแก้ถาวร `HYGIENE_SKIP` ไม่เปลี่ยน server-side `Hygiene` workflow และไม่ทำให้ข้อมูลที่เคย publish หายไป ห้ามใช้เพื่อข้าม credential rotation หรือเพื่อเปลี่ยนผลตรวจให้ดูเหมือนผ่าน

## ลิงก์อ้างอิง

- [คู่มือภาษาอังกฤษ: Clean History and Fresh Push Runbook](CLEAN_HISTORY_PUSH_RUNBOOK.md)
- [สถานะปัจจุบัน](CURRENT_STATE.md)
- [นโยบายพื้นที่ห้ามแก้](PROTECTED_AREAS.md)
