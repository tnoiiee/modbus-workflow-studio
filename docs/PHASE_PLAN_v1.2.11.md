# แผน Phase v1.2.11 — Monitor Scheduler & WebSocket Reliability

สถานะ: **implementation complete; source/CI closure passed; standalone release acceptance not granted**

เอกสารนี้เป็น planning scope ที่ได้รับอนุมัติและถูกนำไป implement ใน follow-up PR #2 สำหรับ v1.2.11 ผลการทดสอบจริงอยู่ใน [Acceptance Test](ACCEPTANCE_TESTS/v1.2.11.md) และ [Local Acceptance Evidence](ACCEPTANCE_EVIDENCE/v1.2.11-local-matrix.md) เอกสารนี้ไม่อนุมัติให้เปลี่ยน behavior นอกขอบเขต

- Acceptance matrix: [docs/ACCEPTANCE_TESTS/v1.2.11.md](ACCEPTANCE_TESTS/v1.2.11.md)
- Governance: [AGENTS.md](../AGENTS.md)
- Baseline: [docs/CURRENT_STATE.md](CURRENT_STATE.md)
- Existing feature inventory: [README.md](../README.md) และ [docs/ARCHITECTURE.md](ARCHITECTURE.md)
- Protected areas: [docs/PROTECTED_AREAS.md](PROTECTED_AREAS.md)
- Existing proposal: [docs/ROADMAP.md](ROADMAP.md) และ [docs/KNOWN_ISSUES.md](KNOWN_ISSUES.md)

## 1. Baseline และเหตุผล

v1.2.10 มีฟีเจอร์ที่ต้องคงไว้ ได้แก่ React Flow workflow editor, workflow CRUD และ revisioned auto-save, concurrent workflow runtime, shared Modbus TCP device connections/queues, FC01-FC04 reads, FC05/FC06/FC16 writes, output ownership protection, read-only Modbus Monitor, Audit Viewer, Runtime Monitor, Traffic Monitor และ Validation

ปัญหาที่ roadmap ระบุไว้มี 2 กลุ่ม:

1. `ModbusMonitorManager` ใช้ interval เรียก `read()` โดยไม่มี single-flight guard เมื่ออ่านช้ากว่า interval รอบใหม่จะซ้อนกัน คำขอ monitor จึงสะสมใน FIFO ของ `DeviceConnection` ซึ่งยังไม่มี monitor backlog bound หรือ stop cancellation
2. WebSocket server broadcast ตรงไปยัง client โดยไม่มี per-client backpressure policy และ client เปิด connection ครั้งเดียว ไม่มี reconnect หรือ state resynchronization

ผลกระทบที่ต้องแก้คือ latency ที่โตโดยไม่มีขอบเขต, workflow read ที่อาจถูก monitor traffic เบียด, stale monitor result หลัง Stop/Restart และ UI ที่ค้างหลัง network/server restart

## 2. เป้าหมายที่วัดได้

- Monitor list เดียวกันมี Modbus read ที่ active ได้ไม่เกินหนึ่งรายการ
- Monitor work ที่รออยู่มีขอบเขต finite และ coalesce งาน stale แทนการสะสมไม่จำกัด
- Stop/Restart ป้องกันงาน generation เก่าไม่ให้แก้ runtime หรือ broadcast ผลใหม่
- Workflow read และ write safety ไม่ถูก monitor traffic starve
- Slow WebSocket client ไม่ทำให้ broadcast ของ client อื่นหยุดหรือใช้ memory ไม่จำกัด
- Client กลับมาเชื่อมต่อได้ด้วย backoff ที่มี upper bound และโหลด state ล่าสุดกลับมา
- ผู้ใช้เห็นสถานะ `LIVE`, `RECONNECTING` และ `OFFLINE`
- ไม่มีการเปลี่ยน Modbus addressing, frame semantics, write guards หรือ React Flow behavior

## 3. Scope ที่อนุมัติ

### 3.1 Monitor scheduler และ cancellation

1. แทนที่การพึ่งพา `setInterval(() => read())` ด้วย single-flight scheduler ต่อ monitor list
2. `start` ซ้ำต้อง idempotent และไม่สร้าง timer/loop ซ้ำ
3. `stop` ซ้ำต้อง idempotent และต้อง invalidate generation ปัจจุบัน
4. กำหนด generation/cancellation token ให้แต่ละ monitor run:
   - งานที่ยังไม่เริ่มถูกยกเลิกจาก queue ได้
   - งานที่กำลังใช้ TCP อยู่ไม่ถูกตัด socket แบบเสี่ยงต่อ Modbus framing แต่ผลที่กลับมาจาก generation เก่าต้องถูกทิ้ง
   - งาน generation เก่าห้าม update `values`, audit หรือ WebSocket monitor event หลัง Stop/Restart
5. เมื่อรอบเดิมยังทำงานอยู่ รอบใหม่ต้อง coalesce/skip ไม่ enqueue ซ้ำ
6. การ disconnect device ต้องหยุด monitor ของ device นั้นและไม่ทิ้ง stale result กลับมา

### 3.2 Bounded shared device queue

เพิ่ม request classification ให้แยกอย่างน้อย `workflow`, `monitor` และ `write` โดยรักษา FIFO/priority semantics ที่ปลอดภัย:

- monitor queue ต่อ device มี default bound **32 รายการ**
- ค่า bound ต้องตั้งได้ผ่าน typed reliability configuration และต้องแสดงค่าที่ใช้ใน diagnostics/health evidence
- monitor list หนึ่งรายการมีได้ 1 in-flight และ 1 pending request สูงสุด
- pending monitor request ที่ซ้ำ/stale ต้อง coalesce หรือ drop พร้อม counter/audit reason
- workflow read และ write request ต้องไม่ถูก drop เพราะ monitor overflow
- output write ที่มี `priority` และ safety guard เดิมต้องคง behavior เดิม
- queue saturation ต้องเป็น observable state ไม่ใช่ silently grow
- Stop monitor list ต้อง cancel pending monitor requests ของ list นั้นโดยไม่ล้าง workflow หรือ write request ของ device

ค่าที่ configure ได้ต้องมีอย่างน้อย:

| Setting | Default | ขอบเขต |
| --- | ---: | --- |
| monitor queue limit ต่อ device | 32 jobs | positive finite integer |
| monitor request timeout | ใช้ `DeviceConfig.timeout` เดิมเป็นค่าเริ่มต้น | ต้องไม่ขัดกับ Modbus timeout เดิม |
| monitor minimum interval | 100 ms ตาม behavior เดิม | ห้ามลดจนสร้าง busy loop |
| max monitor pending ต่อ list | 1 | ห้ามเพิ่มเกิน 1 ใน v1.2.11 |

### 3.3 WebSocket server backpressure

สร้าง per-client outbound queue/dispatcher แทนการ `send()` ตรงจาก broadcast loop:

- default สูงสุด **256 messages หรือ 1 MiB ต่อ client** และค่าต้อง configure ได้
- slow client หนึ่งรายต้องไม่ block healthy client รายอื่น
- control/state event เช่น workflow state, workflow list, revision และ safety/audit event ห้ามถูก drop แบบเงียบ
- telemetry event เช่น traffic, runtime และ monitor update สามารถ coalesce/drop ตาม event key เมื่อ queue เต็ม โดยต้องมี counter/reason
- เมื่อ state event ส่งไม่ทัน ต้องส่งสัญญาณ resync หรือปิด connection อย่างชัดเจนเพื่อให้ client reconnect/resync แทนการใช้ข้อมูลค้าง
- จำกัด memory และทำความสะอาด queue เมื่อ client close/error
- เก็บ metrics สำหรับ queued, sent, coalesced, dropped, overflow และ resync-required

ค่าที่ configure ได้ต้องมีอย่างน้อย:

| Setting | Default |
| --- | ---: |
| max outbound messages ต่อ client | 256 |
| max outbound bytes ต่อ client | 1 MiB |
| telemetry coalesce window | 100 ms |

### 3.4 WebSocket client reconnect และ resync

เพิ่ม live transport module ที่ทดสอบแยกจาก React component ได้:

- reconnect เมื่อ close/error/network interruption
- exponential backoff พร้อม jitter: **250 ms ถึง 30 s** และค่าต้อง configure ได้
- หยุด reconnect เมื่อ component/app ถูก unmount
- สถานะ UI: `LIVE`, `RECONNECTING`, `OFFLINE`
- หลัง reconnect เรียก resync ของ workflow revision, devices, runtime, monitor state และข้อมูลที่จำเป็นต่อหน้า active
- ใช้ revision/sequence guard ไม่ให้ event เก่าทับ state ใหม่
- แจ้ง user เมื่อ resync ล้มเหลว และลองใหม่ตาม backoff โดยไม่สร้าง socket ซ้ำซ้อน
- คง relative WebSocket URL ที่รองรับ preview/proxy environment ห้าม hard-code localhost

ค่าที่ configure ได้ต้องมีอย่างน้อย:

| Setting | Default |
| --- | ---: |
| reconnect base delay | 250 ms |
| reconnect max delay | 30 s |
| reconnect jitter | 0–20% |
| resync request timeout | ใช้ API timeout เดิม 10 s เป็นค่าเริ่มต้น |

## 4. แผน implementation เป็นลำดับ

### Milestone 0 — Contract และ instrumentation

- กำหนด request class, cancellation contract, queue limits, event drop/coalesce policy และ reliability settings
- เพิ่ม typed metrics ที่ไม่ expose runtime data/credentials
- เพิ่ม unit-test fixtures สำหรับ fake device connection และ slow WebSocket client

### Milestone 1 — Monitor single-flight และ queue bound

- แยก scheduler lifecycle จาก `ModbusMonitorManager.read()`
- เพิ่ม generation/cancellation และ monitor queue admission/coalescing ใน `DeviceConnection`
- รักษา workflow FIFO, write priority, disconnect behavior และ existing audit vocabulary
- เพิ่ม tests สำหรับ overlap, Stop/Restart, queue bound และ fairness

### Milestone 2 — Server WebSocket dispatcher

- เพิ่ม per-client bounded queue
- จัดประเภท control/state กับ telemetry events
- เพิ่ม slow-consumer, overflow, cleanup และ resync-required tests

### Milestone 3 — Client reconnect/resync/UI

- เพิ่ม testable live socket module
- เชื่อมกับ existing `load()`/revision handling โดยไม่สร้าง duplicate state owner
- เพิ่ม status indicator และ reconnect/resync error state
- เพิ่ม browser tests สำหรับ restart, offline/online และ no-stale-revision behavior

### Milestone 4 — Integration และ hardware validation

- fake Modbus TCP integration: monitor load + workflow reads + stop/restart
- WebSocket slow-client and reconnect integration
- Modbus TCP simulator/PLC test ตาม matrix ใน acceptance document
- ตรวจ output safety, read-back, ownership conflict และ read-only monitor

### Milestone 5 — Release gate

- อัปเดต version เป็น `1.2.11` ให้ตรงกันใน root/client/server, UI/startup/health API, README, CHANGELOG และ CURRENT_STATE ตาม `AGENTS.md`
- รัน local validation, browser, hardware และ CI
- บันทึก evidence จริงใน `docs/ACCEPTANCE_TESTS/v1.2.11.md`
- ห้าม tag/release หากมี test หรือ evidence รายการใดที่ยังไม่ผ่าน

## 5. ไฟล์ที่คาดว่าจะเปลี่ยนเมื่อเริ่ม implementation

รายการนี้เป็น implementation forecast ไม่ใช่รายการที่แก้ใน planning PR:

- `server/src/monitor.ts` — scheduler lifecycle, single-flight, cancellation
- `server/src/modbus.ts` — request class, bounded monitor admission, cancellation/coalescing และ metrics
- `server/src/index.ts` — WebSocket client dispatcher, reliability configuration, health/diagnostics
- `server/src/types.ts` — typed reliability/metrics contracts หากจำเป็น
- `client/src/App.tsx` และโมดูล live transport ใหม่ — reconnect, resync, status UI
- `server/test/*`, `client/src/*.test.ts` และ browser/integration test fixtures
- `package.json`, workspace manifests, README, CHANGELOG, version banners/health API
- `docs/CURRENT_STATE.md`, `docs/KNOWN_ISSUES.md`, `docs/ROADMAP.md` และ acceptance evidence

ห้ามเพิ่ม `data/**`, `server/data/**`, generated workflows, monitor lists, logs, credentials หรือ build output เข้า Git

## 6. Explicit exclusions และ safety constraints

- ห้ามเปลี่ยน React Flow node/edge behavior, dynamic ports, auto-save, Undo/Redo หรือ workflow CRUD
- ห้ามเปลี่ยน workflow runtime isolation หรือ Manual Trigger semantics
- ห้ามเปลี่ยน FC01-FC04/FC05/FC06/FC16, zero-based address, frame encoding หรือ Modbus safety rules
- ห้ามให้ read-only Modbus Monitor เขียน Modbus
- ห้ามให้ monitor cancellation ยกเลิกหรือ reorder safety-critical output write โดยไม่ผ่าน contract ที่ตรวจสอบแล้ว
- ห้ามแก้ scheduler/WebSocket แบบ opportunistic นอก test matrix
- v1.3.0 Cross-workflow Published Signals และ v1.4.0 LIVE arbitration ยังอยู่นอก scope

## 7. Merge และ PR policy

PR #1 เป็น hygiene/documentation PR และสามารถ merge ได้เมื่อ required checks ผ่าน ไม่ต้องรอ implementation v1.2.11

Implementation v1.2.11 ต้องเป็น follow-up PR ที่มี:

- target version และ changed-file scope ที่ review ได้
- acceptance test document ฉบับเดียวกันกับ code scope
- evidence จริงของ local/CI/browser/hardware ตามที่ทำได้
- รายการ protected-area regression และ explicit exclusions

หาก implementation พบว่าต้องเปลี่ยน queue policy, write safety, Modbus semantics หรือ React Flow behavior ให้หยุดและขอ scope approval ใหม่ เพราะเป็น material scope change ตาม `AGENTS.md`

## 8. Closure disposition — 2026-09-22

- Implementation ส่งมอบผ่าน PR #2 จาก source commit `a393cf3f2521abc41d21c13e5e6db02a481aa56a`
- Local automated gates, GitHub Check/Hygiene และ selected simulator/browser reliability scenarios ผ่าน
- Monitor single-flight, bounded pending/coalescing, Stop/Restart, disconnect/reconnect, persistence และ browser resync มี evidence ตามไฟล์ acceptance
- General UI regression, write-disabled/write-enabled safety, mixed load, slow consumer, soak, frame capture และ hardware checks ยังไม่ผ่านการรับรองครบ
- เจ้าของโครงการตัดสินใจย้ายรายการที่เหลือไปทดสอบหลัง v1.2.12 UI/UX Modernization เพื่อทดสอบ frontend เพียงรอบเดียวกับ UI ใหม่
- v1.2.11 จึงเป็น source baseline สำหรับ v1.2.12 และไม่มี standalone release tag หรือ release ZIP
- Security audit findings ยังไม่ resolved และเป็น mandatory pre-release gate ของ v1.2.12
- v1.2.12 ห้ามเปลี่ยน reliability/runtime/Modbus/write-safety behavior โดยไม่มี scope approval ใหม่
