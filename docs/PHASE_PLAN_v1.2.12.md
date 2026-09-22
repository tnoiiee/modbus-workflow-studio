# แผน Phase v1.2.12 — UI/UX Modernization

สถานะ: **owner อนุมัติ version split และ scope direction แล้ว (2026-09-22) พร้อมมติแก้ไขเอกสาร A-H —
แผนนี้ถูกอัปเดตตามมติดังกล่าว และกำลังรออนุมัติเริ่ม Milestone 1 (source code)**

เอกสารนี้แปลง handoff bundle ที่ owner อนุมัติแล้ว (2026-09-22) ให้เป็น planning document ของ
repository และกำหนดลำดับงานจริงที่ใช้ใน session นี้ เอกสารนี้ไม่อนุมัติให้เปลี่ยน behavior
นอกขอบเขต

- Scope ที่อนุมัติ: [docs/SCOPE_v1.2.12.md](SCOPE_v1.2.12.md)
- Design contract: [docs/UI_DESIGN_SYSTEM_v1.2.12.md](UI_DESIGN_SYSTEM_v1.2.12.md)
- Acceptance matrix: [docs/ACCEPTANCE_TESTS/v1.2.12.md](ACCEPTANCE_TESTS/v1.2.12.md)
- Baseline inventory: [docs/UI_INVENTORY_v1.2.12.md](UI_INVENTORY_v1.2.12.md)
- Scope traceability: [docs/SCOPE_TRACEABILITY_v1.2.12.md](SCOPE_TRACEABILITY_v1.2.12.md)
- Governance: [AGENTS.md](../AGENTS.md) · Protected areas: [docs/PROTECTED_AREAS.md](PROTECTED_AREAS.md)
- Carryover: [docs/ACCEPTANCE_TESTS/v1.2.11.md](ACCEPTANCE_TESTS/v1.2.11.md),
  [docs/ACCEPTANCE_EVIDENCE/v1.2.11-local-matrix.md](ACCEPTANCE_EVIDENCE/v1.2.11-local-matrix.md)

## 1. Baseline ที่ตรวจแล้ว (Milestone 0)

| รายการ | ผล |
| --- | --- |
| Branch | `arena/01a0c748-modbus-workflow-studio` |
| HEAD | `efcd15bda9608a6d68cfbf944b1599d50ff65306` |
| `origin/main` | `efcd15bda9608a6d68cfbf944b1599d50ff65306` (ตรงกัน — `main` ไม่ขยับจาก expected base) |
| Ancestry | expected base เป็น ancestor ของ HEAD (merge commit ของ PR #2) |
| Working tree ก่อนแก้ | clean (handoff bundle ถูกเก็บไว้นอก repository ที่ `../v1.2.12-ui-ux-handoff-src/`) |
| `npm ci --include=optional` | exit 0, 249 packages, lockfile ไม่เปลี่ยน |
| `npm run check` | exit 0 — server/client typecheck, server 13/13, client 3/3, ทั้งสอง production build |
| `node scripts/hygiene-check.mjs --all --strict` | PASS — 173 files, 0 errors, 0 warnings |
| `npm run verify:publish` | exit 0 |
| `npm audit` (full) | 5 moderate, 1 high, 1 critical — ตรงกับ handoff snapshot |
| `npm audit --omit=dev` | 2 moderate (`express`, `qs`) — ตรงกับ handoff snapshot |
| `npm audit fix` / `--force` | **ไม่ถูกรัน** |

ไม่พบความขัดแย้งระหว่าง repository จริงกับ handoff bundle ดังนั้นจึงไม่ต้องรายงาน diff ของ base

## 2. สิ่งที่ inventory พบ (สรุปประเด็นที่มีผลต่อแผน)

รายละเอียดเต็มอยู่ใน [UI_INVENTORY_v1.2.12.md](UI_INVENTORY_v1.2.12.md)

- UI ทั้งหมดอยู่ใน `client/src/App.tsx` ไฟล์เดียว 92,682 B / 306 บรรทัด (บรรทัดยาวสุด ≈ 10,021 ตัวอักษร)
  และมี `styles.css` 14,389 B ที่มี custom property เดียวคือ `--accent`
- มี 8 หน้า, native dialog 15 จุด (`prompt` 3, `confirm` 8, `alert` 4), ไม่มี modal/toast/focus-trap ใด ๆ
- Block Library มี 6 หมวดหมู่ 48 block types ใช้ `<details>/<summary>` + ปุ่มธรรมดา ไม่มี icon/คำอธิบาย/search
- React Flow มี custom node type เดียว (`block`) และมี quick action เดียวคือลบ (ผ่าน window event
  `mws:delete-node`) — ยังไม่มี Duplicate
- Undo/Redo มีเฉพาะ keyboard shortcut; ยังไม่มีปุ่ม Undo/Redo/Fit View บน UI
- Inspector มี 16 branch ตาม `node.type`, `THAI_PARAM_DESCRIPTIONS` 60 รายการ แต่มี
  `<ParamDescription>` จริง 16 จุด และไม่มี block-level metadata (title/EN/TH/safety)
- สถานะการเชื่อมต่อถูกแสดงเป็นข้อความใน notice ของ header เท่านั้น ไม่มี `LIVE`/`RECONNECTING`/`OFFLINE` pill
- breakpoint เดิมคือ 1200/1100/760 px ไม่มี 1024 px tablet-landscape ตาม target ใหม่
- client ไม่มี DOM test environment (`jsdom`/`@testing-library`) จึงยังทดสอบ component/focus อัตโนมัติไม่ได้
- **Project Settings เป็น mock ที่ไม่ทำงาน** (9 input ใช้ `defaultValue`, ปุ่ม `SAVE SETTINGS` ไม่มี handler,
  ไม่มีการเรียก API ทั้ง load และ save)
- **Traffic Monitor ไม่มีปุ่ม clear** แม้ server มี `DELETE /api/traffic`

## 3. ลำดับ milestone ที่จะทำจริง

แต่ละ milestone ต้องเล็กพอที่ review ได้ และต้องรัน targeted regression ก่อนขยับต่อไป
ห้าม rewrite ทั้งแอปในรอบเดียว

### Milestone 1 — Design foundation (scope ที่อัปเดตตามมติ A-H แล้ว — ดู §5)

1. **Bump เวอร์ชันเป็น `1.2.12` ใน implementation commit แรก** (มติ F) และซิงก์ให้ตรงกันใน
   root/client/server `package.json`, `package-lock.json`, UI version label, server startup banner,
   `GET /api/health` — ห้ามสร้าง tag หรือ ZIP
2. แตก `styles.css` เป็น `client/src/styles/tokens.css`, `components.css`, `responsive.css`
   (คง `@font-face` และ offline behavior เดิม)
3. สร้าง design tokens ตามรายการชื่อเต็มใน
   [UI_DESIGN_SYSTEM_v1.2.12.md §2.1](UI_DESIGN_SYSTEM_v1.2.12.md) (มติ E — ชื่อ token เป็น ASCII
   เต็มรูป ห้ามใช้แบบย่อ/escaped) รวมถึง block accent tokens ใน §2.2
4. สร้าง UI primitives ใน `client/src/components/ui/`: `Button`, `IconButton`, `Field`, `Input`,
   `NumberInput`, `Select`, `Switch`, `Badge`/`StatusPill`, `Panel`, `Modal`, `ConfirmDialog`,
   `Toast`, `DataTable`, `EmptyState`, `LoadingState`, `ErrorState`, `CommandGroup`
5. สร้าง app shell ใหม่ (`components/shell/`) — sidebar/navigation (`aria-current`), page header,
   และ **connection status pill `LIVE`/`RECONNECTING`/`OFFLINE`** ที่อ่านจาก reconnect state เดิมเท่านั้น
6. เพิ่ม automated tests ชุดแรกของแผน (token list, native-dialog source scan) — ดู §8
7. ยังไม่ย้าย state ownership; `App.tsx` ยังเป็นเจ้าของ state/API เหมือนเดิม และไม่แตะ
   `server/src/*` นอกเหนือจาก version string

Gate: `npm run check` ผ่าน, hygiene strict ผ่าน, keyboard/focus smoke ของ primitives,
version sync ครบ, ไม่มี runtime/API behavior change, B01/B04/B05/B06/C02/C03 เริ่มมี evidence

### Milestone 2 — Workflow command bar และ dialogs

1. สร้าง segmented command bar 4 กลุ่ม (management / editing / mode-safety / runtime)
2. **เพิ่มปุ่ม Undo, Redo, Fit View ที่มองเห็นได้ (มติ C)** โดยเรียก logic เดิมเท่านั้น:
   - Undo/Redo → `restoreSnapshot('undo'|'redo')` บน `undoHistoryRef`/`redoHistoryRef` stack เดิม
   - Fit View → React Flow viewport API เดิม
   - คง keyboard shortcut เดิมทุกตัว (`Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`, `Ctrl/Cmd+Y`) และพฤติกรรม
     ต้อง parity กัน (acceptance D17)
   - คง history semantics และ React Flow state ownership เดิม ห้ามสร้าง history model ที่สอง
   - **Fit View ต้องไม่แก้ node position ที่ persist และต้องไม่ทำให้เกิด save/revision/`PUT`** (D16)
   - enabled/disabled state ต้องถูกต้อง: Undo disabled เมื่อ undo stack ว่าง, Redo disabled เมื่อ
     redo stack ว่าง, และประเมินใหม่เมื่อสลับ workflow (D14, D15, D18)
3. แยก `Stop All` ออกจาก Run/Stop และ CRUD ชัดเจน
4. สร้าง modal/toast/inline validation และแทน native dialog ทั้ง 15 จุด พร้อม suppress canvas
   shortcut ขณะ modal เปิด (C10)
5. ยืนยัน save/revision flow เดิมไม่สร้าง save ซ้ำ และไม่มี UI ใดรายงาน success
   สำหรับงานที่ backend ไม่ได้ทำ (C11)

Gate: Workflow CRUD + revision behavior เหมือนเดิม, modal validation/focus/error ผ่าน,
safety controls ยัง explicit, D14-D18 มี evidence

### Milestone 3 — Library, inspector, duplicate, nodes

1. Block Library ใหม่: categorized interactive cards, collapse/expand, icon, คำอธิบายสั้น,
   accessible states (คง 48 types และ `addBlock` behavior เดิม)
   - **search/filter เป็น optional enhancement และ non-blocking (มติ D)** — ไม่อยู่ใน mandatory
     scope และไม่เป็น release gate ถ้าทำต้องเป็น client-side ล้วน และไม่เปลี่ยน add behavior (D19 = `NB`)
2. สร้าง `client/src/metadata/blocks.ts` เป็น metadata กลาง (title, EN, TH, input/output behavior,
   safety note) สำหรับทุก block type และผูกกับ Inspector ที่เดียว
3. Inspector layout ใหม่: metadata → `PARAMETERS` → Block Name → actions
4. Duplicate Block ใน Inspector และ node quick action (new ID, copy type/params, unique `Copy` name,
   offset position, ไม่ copy edges, รักษา dynamic ports, รองรับ Undo/Redo, source ไม่เปลี่ยน)
5. ปรับ Function Block layout แยกโซน header/identity/value/status/ports/actions ไม่ให้ทับ handle

Gate: ทุก block type render ได้, duplicate ได้ ID/config/offset ตามข้อกำหนด และไม่มีการ์ด edge ใดถูก copy,
dynamic-port duplicate มี port เท่าเดิมทุกช่อง, zoom/long-label matrix ผ่าน

### Milestone 4 — Devices และหน้า operational (ทำทีละหน้า)

ลำดับ: Devices → Modbus Monitor → Runtime Monitor → Traffic Monitor → Audit Log → Validation →
Project Settings · หลังจบแต่ละหน้า ให้รัน functional regression ของหน้านั้นก่อนไปหน้าถัดไป
คง API contract, filter, link, CSV export (UTF-8 BOM + CRLF), diagnostics และ safety visibility เดิม

ข้อกำหนดเฉพาะหน้าที่ owner ระบุ (มติ A และ B):

- **Traffic Monitor (มติ B)** — baseline UI ไม่มี Traffic Clear และ **ยังไม่อนุมัติให้เพิ่มปุ่ม Clear**
  ให้คง events, ordering, columns, values, timestamps, filters, links และ display behavior เดิม
  `DELETE /api/traffic` ต้องไม่มี caller จาก UI ต่อไป (ตรวจด้วย code search ใน E08)
- **Project Settings (มติ A)** — redesign UI only: คง field/ค่า default ที่แสดงอยู่เดิม,
  **ไม่มี Settings API, ไม่มี persistence schema/migration/backend storage, ไม่มี false
  successful-save state** และต้องสื่อสารชัดว่าค่าที่แก้ไม่ถูกบันทึก (notice ถาวรบนหน้า +
  คำอธิบายบนปุ่ม save) คงป้ายเตือนเรื่อง no authentication และ `ALLOW_WRITES`
- **Devices** — เปลี่ยน label ให้เป็นมิตรได้ แต่ payload/key และความสามารถในการแก้ไข (รวม `id`)
  ต้องเหมือน baseline

### Milestone 5 — Responsive และ accessibility hardening

1024×768, 1366×768, 1920×1080 · zoom 90/100/110/125% · keyboard-only pass · focus/modal pass ·
contrast review (WCAG AA) · `prefers-reduced-motion` · empty/loading/error/long-content states ·
ตรวจ preview host ผ่าน relative URL

### Milestone 6 — Carryover reliability และ safety acceptance (มติ G และ H)

preserve และ rerun พฤติกรรม v1.2.11 ทั้งหมดหลัง UI modernization ตามแถว H01-H16:

- H01 monitor one-in-flight / one-pending · H02 coalescing และ bounded queue
- H03 no stale publication หลัง Stop · H04 no stale publication หลัง Disconnect
- H05 no monitor auto-start หลัง device reconnect · H06 safe repeated-Stop (assert safe state
  ไม่ assert ค่า internal generation)
- H07 same `DATA_DIR` persistence และ runtime กลับ safe/stopped · H08 browser reconnect ไม่มี duplicate (`M-MERGE`)
- H09 write-disabled safety (`ALLOW_WRITES=false`) · H10 approved simulator write tests
- H11 multiple lists + workflow reads · H12 slow WebSocket consumer · H13 read-only monitor frames
- H14 soak 30 นาที · H15 extended soak 2-8 ชั่วโมง · H16 approved hardware (test PLC)
- security disposition (I01, I02): remediate หรือบันทึก risk acceptance ที่มี package, advisory,
  exploitability, deployment controls, owner, review date

แถว `COND` ที่ไม่มี environment ต้องคง `NOT RUN` และห้ามแปลงเป็น `PASS` เด็ดขาด

### Milestone 7 — Release closure

ซิงก์เวอร์ชัน `1.2.12` ให้ครบทุกจุดตามที่มติ F กำหนด (root/client/server `package.json`,
`package-lock.json`, UI label, startup banner, `GET /api/health`) และอัปเดต README, CHANGELOG,
CURRENT_STATE, KNOWN_ISSUES, ROADMAP, ARCHITECTURE, RELEASE_CHECKLIST และ acceptance evidence ·
รัน full local gates (`npm ci --include=optional`, `npm run check`,
`node scripts/hygiene-check.mjs --all --strict`, `npm run verify:publish`) และ GitHub workflows ·
ตรวจว่าไม่มี runtime/generated file ถูก track ·
**ห้ามสร้าง tag หรือ ZIP จนกว่า mandatory gate จะผ่านครบและ owner อนุมัติ (มติ F และ J11)**

## 4. โครงสร้างไฟล์ที่จะใช้ (behavior-preserving decomposition)

```text
client/src/
  App.tsx                  (state owner เดิม — ค่อย ๆ บางลง)
  components/
    ui/                    (primitives)
    shell/                 (sidebar, header, connection status)
    workflow/              (command bar, library, canvas, node, inspector)
    devices/
    monitor/
    operational/           (runtime, traffic, audit, validation, settings)
  metadata/
    blocks.ts              (block metadata กลาง EN + TH)
  hooks/
  styles/
    tokens.css
    components.css
    responsive.css
```

กติกา: state owner และ API request path เดิมต้องคงที่, ห้าม rewrite runtime architecture,
ห้ามแก้ `server/src/*` เพื่อความสะดวกทางสายตา

## 5. มติ owner ที่ปิดแล้ว (2026-09-22) และคำถามที่ยังเปิด

### 5.1 ปิดแล้ว — ถูกบันทึกลงเอกสาร source of truth ทั้งหมด

| # | มติ | ผลต่อเอกสาร |
| --- | --- | --- |
| Version split | v1.2.12 = UI/UX modernization; Variable requirement ไป v1.3.0 แบบ `Publish Variable` / `Read Variable` และเป็น **Deferred ไม่ใช่ Cancelled** | SCOPE §Version split, §v1.3.0 boundary; ROADMAP คง v1.3.0 |
| A | Project Settings: redesign UI only, คง field/default เดิม, ไม่มี Settings API, ไม่มี persistence schema/migration/backend storage, ไม่มี false successful-save state, ต้องสื่อสารชัดว่าไม่บันทึก | SCOPE §10; ACCEPTANCE E11 เขียนใหม่; DESIGN §10 |
| B | Traffic Monitor: baseline ไม่มี Clear และยังไม่อนุมัติให้เพิ่ม — คง events/ordering/columns/values/timestamps/filters/links/display | SCOPE §10; ACCEPTANCE E08 ตัดเกณฑ์ clear ออก |
| C | เพิ่ม Visible Undo, Redo, Fit View บน existing logic; คง shortcut, history semantics, React Flow state ownership; Fit View ต้องไม่แก้ persisted position; เพิ่ม acceptance เรื่อง enabled/disabled และ parity | SCOPE §3; DESIGN §7; ACCEPTANCE เพิ่ม D14-D18 |
| D | Block Library search = Optional Enhancement, Non-blocking ไม่ใช่ mandatory scope หรือ release gate | SCOPE §5; DESIGN §9; ACCEPTANCE D19 = `NB` |
| E | แก้ encoding และ escaped token names ในเอกสาร Design System ให้เป็น UTF-8 ถูกต้อง | DESIGN §Encoding, §2.1 (รายชื่อ token เต็มรูปเป็น ASCII), §2.2 |
| F | bump เป็น `1.2.12` ใน first implementation commit และคงเวอร์ชันให้ตรงกันใน root/client/server/lockfile/UI/startup/health ตลอด branch; ห้ามสร้าง tag/release ก่อน final release gate | SCOPE §Version timing; ACCEPTANCE J06, J11 |
| G | ทุกแถว acceptance ต้องถูกจัดเป็น `M-MERGE` / `M-REL` / `COND` / `NB` อย่างใดอย่างหนึ่ง; hardware และ extended soak ที่ไม่มี environment ต้องคง `NOT RUN` ห้ามแปลงเป็น `PASS` | ACCEPTANCE §Classification legend และคอลัมน์ `Class` ทุกแถว |
| H | carryover จาก v1.2.11 ต้อง preserve และ rerun หลัง UI modernization (one-in-flight/one-pending, coalescing/bounded queue, no stale publication หลัง Stop/Disconnect, no monitor auto-start หลัง reconnect, safe repeated-Stop, same `DATA_DIR` persistence, browser reconnect ไม่มี duplicate, write-disabled safety, simulator write tests, load/pressure) | SCOPE §Acceptance carryover; ACCEPTANCE §H เขียนใหม่เป็น H01-H16 |

### 5.2 ยังเปิด — ไม่บล็อก Milestone 1 แต่ต้องตอบก่อนใช้

| # | ประเด็น | สถานะ |
| --- | --- | --- |
| Q3 | ฟอนต์ไทย: Google Sans ที่ bundle ไม่มี glyph ไทย ต้องพึ่ง system fallback (`Noto Sans Thai`, `Leelawadee UI`) ทั้งที่ v1.2.12 ต้องแสดงคำอธิบายภาษาไทยแบบ offline | เสนอ: ใช้ system fallback ก่อนใน Milestone 1 แล้วรายงานผลจริง; หาก render ไม่สม่ำเสมอจะขออนุมัติ bundle ฟอนต์ไทยเป็น asset เพิ่ม |
| Q4 | dev dependency สำหรับทดสอบ UI อัตโนมัติ (`jsdom`, `@testing-library/react`, `@testing-library/user-event`) — จำเป็นสำหรับ focus trap / dialog / duplicate block | เสนอ: อนุมัติเป็น dev-only ตาม I03 (แนบเหตุผล, lockfile diff, audit impact, test coverage); ถ้าไม่อนุมัติจะใช้ node-environment tests + manual browser acceptance แทน ซึ่งครอบคลุมได้น้อยกว่าในแถว C05-C07 |
| Q7 | Devices form: `id` แก้ไขได้ใน baseline และ label เป็นชื่อดิบของ field | เสนอ: เปลี่ยน label ให้เป็นมิตร แต่คง payload/key และความแก้ไขได้ของ `id` เหมือนเดิม |
| Q8 | รูปแบบ PR | เสนอ: PR เดียวเมื่อจบ milestone หลัก พร้อม commit แยกตาม milestone (session ผูกกับ branch เดียว) |

## 6. Risk และวิธีคุม

| ความเสี่ยง | การควบคุม |
| --- | --- |
| การแตกไฟล์ทำให้ React Flow / auto-save / revision เพี้ยน | แตกทีละก้อน, คง state owner เดิม, เทียบ before/after workflow JSON, รัน D12/D13/G01–G03 ทุก milestone |
| Duplicate Block ทำ dynamic port หรือ Undo/Redo พัง | ใช้ snapshot stack เดิม (`undoHistoryRef`/`redoHistoryRef`) + `useUpdateNodeInternals`, เทสต์ D07–D10 ด้วย fixture `MODBUS_MULTI_INPUT` 8 ช่อง |
| Modal/focus trap ไปชน keyboard shortcut เดิม (Delete, Ctrl+Z, Escape) | shortcut เดิมต้องถูก suppress ขณะ modal เปิด, Escape ของ modal ต้องไม่ deselect node พร้อมกัน |
| Glass/contrast ไม่ผ่าน WCAG AA | ตรวจ contrast ทุก token ก่อนใช้จริง, มี solid fallback |
| Dependency ใหม่ทำให้ audit แย่ลง | ไม่เพิ่ม runtime dependency; dev dependency ต้องขออนุมัติและรายงาน audit ก่อน |
| อ้าง acceptance ผ่านทั้งที่ไม่ได้รัน | ทุกแถวต้องแนบ command/fixture/evidence; `NOT RUN` คงเป็น `NOT RUN` |

## 7. เกณฑ์หยุด/รายงาน

จะหยุดและรายงาน owner ทันทีเมื่อ: พบว่าต้องแก้ protected behavior, ต้องเพิ่ม runtime dependency,
ต้องเปลี่ยน persistence schema, ต้องแตะ `server/src/*`, หรือพบ material conflict ระหว่าง repo จริง
กับเอกสารที่อนุมัติแล้ว

## 8. Automated tests และ manual browser tests ที่จะเพิ่ม

รายละเอียดแบบ trace ต่อ acceptance row อยู่ใน
[SCOPE_TRACEABILITY_v1.2.12.md §5](SCOPE_TRACEABILITY_v1.2.12.md)

### 8.1 Automated (เพิ่มใน `client/src/**.test.ts`, รันผ่าน `npm test -w client`)

| ไฟล์ | milestone | ตรวจอะไร | Acceptance |
| --- | --- | --- | --- |
| `client/src/styles/tokens.test.ts` | 1 | `tokens.css` ประกาศ token ครบตามรายชื่อใน DESIGN §2.1 ไม่มีชื่อซ้ำ/ขาด และ component styles ไม่มี literal hex | B01 |
| `client/src/nativeDialogs.test.ts` | 2 | scan source ทั้ง `client/src` แล้วไม่พบ `window.prompt` / `window.confirm` / `window.alert` / `prompt(` / `confirm(` / `alert(` | C04 |
| `client/src/metadata/blocks.test.ts` | 3 | block metadata กลางครอบคลุมทั้ง 48 types มี title, EN, TH, input/output behavior และ safety note เมื่อเกี่ยวข้อง โดยไม่ซ้ำใน JSX branch | D04, D06 |
| `client/src/duplicateNode.test.ts` | 3 | pure helper ของ Duplicate Block: new ID, copy type/params, unique `Copy` name, offset position, ไม่ copy edge, dynamic port คงจำนวนเดิม | D07-D10 |
| `client/src/editingControls.test.ts` | 2 | derivation ของ enabled/disabled สำหรับ Undo/Redo/Fit View และ parity กับ `restoreSnapshot` เดิม; Fit View ไม่สร้าง mutation ต่อ node position | D14-D18 |
| `client/src/connectionStatus.test.ts` | 1 | mapping จาก reconnect state เดิม → `LIVE` / `RECONNECTING` / `OFFLINE` (pure function ไม่แตะ socket logic) | C03 |

เงื่อนไข: เทสต์ทั้งหมดต้องไม่เพิ่ม runtime dependency · หากต้องใช้ DOM environment (`jsdom`,
`@testing-library/react`) จะทำเฉพาะเมื่อ owner ตอบ Q4 และต้องผ่าน I03 (เหตุผล, lockfile diff,
audit impact, coverage) ก่อน

### 8.2 Manual browser tests (บันทึกเป็น evidence ต่อ acceptance row)

| ชุดทดสอบ | milestone | Acceptance |
| --- | --- | --- |
| Keyboard/focus smoke ของ primitives (Tab order, focus ring, disabled) | 1 | B04, B05, F05, F06 |
| Connection pill ระหว่าง kill/restart server และระหว่าง backoff | 1, 6 | C03, G08, H08 |
| Modal focus trap, focus restoration, validation, pending state, destructive confirm | 2 | C05, C06, C07, C10 |
| Toast/error feedback ไม่ซ้ำและไม่บัง critical state | 2 | C08 |
| Undo/Redo/Fit View: ปุ่ม vs shortcut, enabled/disabled, ตรวจว่าไม่มี `PUT` เกิดขึ้นหลัง Fit View | 2 | D14-D18, D13 |
| Command bar grouping, `Stop All` แยกชัด, ชื่อ workflow ยาว | 2 | D01-D03 |
| Block Library: collapse/expand, keyboard, เพิ่ม block ครบ 48 types | 3 | D04, D05 |
| Duplicate Block จาก inspector และ node quick action เทียบ before/after workflow JSON | 3 | D07-D10 |
| Node layout ที่ zoom 90/100/110/125% และชื่อยาว | 3, 5 | D11, F04, F08 |
| Regression ต่อหน้า: Devices, Modbus Monitor, Runtime, Traffic, Audit, Validation, Settings | 4 | E01-E11 |
| Traffic Monitor: ยืนยันว่าไม่มี clear action และไม่มี call ไป `DELETE /api/traffic` | 4 | E08 |
| Project Settings: network trace แสดงว่าไม่มี request ใด ๆ และ UI ไม่โชว์สถานะ save สำเร็จ | 4 | E11, C11 |
| CSV export ตรวจ BOM/CRLF/columns ระดับ byte | 4 | E06, E09 |
| Viewport matrix 1024x768, 1366x768, 1920x1080 | 5 | F01-F03 |
| Contrast report ของ token และคู่สีข้อความจริง | 5 | F07, B03 |
| `prefers-reduced-motion` และ offline (ตัดเครือข่าย) | 5 | B07, B08 |
| Preview ผ่าน proxied host ด้วย relative URL | 5 | C09 |
| Carryover reliability/safety/load/soak/hardware (ต้องมี simulator, capture tool หรือ PLC) | 6 | H01-H16 |
