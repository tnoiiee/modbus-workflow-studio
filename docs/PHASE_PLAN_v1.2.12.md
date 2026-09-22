# แผน Phase v1.2.12 — UI/UX Modernization

สถานะ: **planning complete; รอ owner ยืนยัน open questions ก่อนเริ่มเขียน code (Milestone 1)**

เอกสารนี้แปลง handoff bundle ที่ owner อนุมัติแล้ว (2026-09-22) ให้เป็น planning document ของ
repository และกำหนดลำดับงานจริงที่ใช้ใน session นี้ เอกสารนี้ไม่อนุมัติให้เปลี่ยน behavior
นอกขอบเขต

- Scope ที่อนุมัติ: [docs/SCOPE_v1.2.12.md](SCOPE_v1.2.12.md)
- Design contract: [docs/UI_DESIGN_SYSTEM_v1.2.12.md](UI_DESIGN_SYSTEM_v1.2.12.md)
- Acceptance matrix: [docs/ACCEPTANCE_TESTS/v1.2.12.md](ACCEPTANCE_TESTS/v1.2.12.md)
- Baseline inventory: [docs/UI_INVENTORY_v1.2.12.md](UI_INVENTORY_v1.2.12.md)
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

### Milestone 1 — Design foundation

1. แตก `styles.css` เป็น `client/src/styles/tokens.css`, `components.css`, `responsive.css`
   (คง `@font-face` และ offline behavior เดิม)
2. สร้าง design tokens ตาม [UI_DESIGN_SYSTEM_v1.2.12.md §2](UI_DESIGN_SYSTEM_v1.2.12.md)
3. สร้าง UI primitives ใน `client/src/components/ui/`: `Button`, `IconButton`, `Field`, `Input`,
   `NumberInput`, `Select`, `Switch`, `Badge`/`StatusPill`, `Panel`, `Modal`, `ConfirmDialog`,
   `Toast`, `DataTable`, `EmptyState`, `LoadingState`, `ErrorState`, `CommandGroup`
4. สร้าง app shell ใหม่ (`components/shell/`) — sidebar/navigation, page header, connection status
   pill ที่อ่านค่าจาก reconnect state เดิมเท่านั้น
5. ยังไม่ย้าย state ownership; `App.tsx` ยังเป็นเจ้าของ state/API เหมือนเดิม

Gate: `npm run check` ผ่าน, keyboard/focus smoke ของ primitives, ไม่มี runtime/API behavior change

### Milestone 2 — Workflow command bar และ dialogs

1. สร้าง segmented command bar 4 กลุ่ม (management / editing / mode-safety / runtime)
2. เพิ่มปุ่ม Undo, Redo, Fit View ที่เรียก logic เดิม (`restoreSnapshot`, React Flow `fitView`)
3. แยก `Stop All` ออกจาก Run/Stop และ CRUD ชัดเจน
4. สร้าง modal/toast/inline validation และแทน native dialog ทั้ง 15 จุด
5. ยืนยัน save/revision flow เดิมไม่สร้าง save ซ้ำ

Gate: Workflow CRUD + revision behavior เหมือนเดิม, modal validation/focus/error ผ่าน,
safety controls ยัง explicit

### Milestone 3 — Library, inspector, duplicate, nodes

1. Block Library ใหม่: categorized interactive cards, collapse/expand, icon, คำอธิบายสั้น,
   accessible states (คง 48 types และ `addBlock` behavior เดิม)
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

### Milestone 5 — Responsive และ accessibility hardening

1024×768, 1366×768, 1920×1080 · zoom 90/100/110/125% · keyboard-only pass · focus/modal pass ·
contrast review (WCAG AA) · `prefers-reduced-motion` · empty/loading/error/long-content states ·
ตรวจ preview host ผ่าน relative URL

### Milestone 6 — Carryover reliability และ safety acceptance

รันแถว carryover ทั้งหมดจาก v1.2.11 (UI regression, write-disabled safety, isolated simulator write,
multiple lists + workflow reads, slow WebSocket consumer, soak/memory/handle, frame capture/hardware,
security disposition) และบันทึกผลตามจริง — สิ่งที่ทำใน environment นี้ไม่ได้ต้องคงสถานะ `NOT RUN`

### Milestone 7 — Release closure

ซิงก์เวอร์ชัน v1.2.12 (root/client/server/UI/startup banner/health API/README/CHANGELOG/
CURRENT_STATE/KNOWN_ISSUES/ROADMAP/ARCHITECTURE/acceptance evidence) · รัน full local gates และ
GitHub workflows · ตรวจว่าไม่มี runtime/generated file ถูก track ·
**ห้ามสร้าง tag หรือ ZIP จนกว่า mandatory gate จะผ่านครบและ owner อนุมัติ**

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

## 5. Open questions (ต้องได้คำตอบก่อน Milestone 1)

| # | ประเด็น | ทางเลือก | ค่าที่เสนอถ้า owner ไม่ระบุ |
| --- | --- | --- | --- |
| Q1 | Project Settings เป็น mock ที่ไม่ load/save จริง ขัดกับ acceptance E11 | (ก) redesign เป็น visual-only คงพฤติกรรมเดิม (ข) ผูกกับ `PUT /api/workflow` (`settings`) ให้ load/save จริง — เป็นการเพิ่ม behavior ต้องอนุมัติ | (ก) คงเป็น mock และแก้ acceptance E11 ให้ระบุว่า "presentation only, no persistence in v1.2.12" |
| Q2 | จังหวะ bump เวอร์ชัน 1.2.12 | (ก) bump ทุกจุดตั้งแต่ commit แรกของ Milestone 1 (ข) bump ตอน Milestone 7 ตาม handoff | (ก) เพื่อให้เป็นไปตาม AGENTS.md "ทุก code change สร้างเวอร์ชันใหม่ และเวอร์ชันต้องซิงก์กัน" |
| Q3 | ฟอนต์ไทย — Google Sans ที่ bundle ไว้ไม่มี glyph ไทย ปัจจุบันพึ่ง fallback ของระบบ (`Noto Sans Thai`, `Leelawadee UI`) ขณะที่ v1.2.12 ต้องแสดงคำอธิบายภาษาไทย และต้อง offline ได้ | (ก) bundle ฟอนต์ไทย (เช่น Noto Sans Thai subset) เพิ่ม (ข) พึ่ง system fallback ต่อไป | (ข) ใน Milestone 1 แล้วประเมินผลจริงบนหน้าจอ; ถ้า render ไม่สม่ำเสมอจะขออนุมัติ (ก) เป็น asset เพิ่ม |
| Q4 | การทดสอบ UI อัตโนมัติ — ต้องเพิ่ม dev dependency (`jsdom`, `@testing-library/react`, อาจมี `@testing-library/user-event`) จึงจะทดสอบ focus trap/duplicate block/dialog ได้ | (ก) อนุมัติเพิ่ม dev deps และเขียน component tests (ข) ไม่เพิ่ม dependency ใช้ manual browser acceptance อย่างเดียว | (ก) เพราะ acceptance C04–C07, D07–D10 ตรวจด้วยมือล้วนเสี่ยงตกหล่น; จะแนบเหตุผล lockfile diff และ audit impact ตาม I03 |
| Q5 | Block Library search/filter | (ก) ทำใน v1.2.12 (ข) เลื่อน | (ข) — handoff ระบุว่าเป็น optional |
| Q6 | Traffic Monitor clear (server มี `DELETE /api/traffic` แต่ UI ไม่มีปุ่ม) | (ก) คงไม่มีปุ่ม (behavior-preserving) (ข) เพิ่มปุ่ม clear + destructive confirm | (ก) แล้วบันทึกเป็น known gap; acceptance E08 จะตรวจเฉพาะ ordering/events |
| Q7 | Devices form — ปัจจุบัน `id` แก้ไขได้และ label เป็นชื่อดิบของ field | (ก) แสดง label ที่เป็นมิตร แต่คงให้แก้ `id` ได้เหมือนเดิม (ข) ล็อก `id` หลังสร้าง | (ก) เพื่อไม่เปลี่ยน payload/behavior |
| Q8 | รูปแบบ PR | (ก) PR เดียวตอนจบ พร้อม commit แยกตาม milestone (ข) PR ต่อ milestone | (ก) เพราะ session นี้ผูกกับ branch เดียว |

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
