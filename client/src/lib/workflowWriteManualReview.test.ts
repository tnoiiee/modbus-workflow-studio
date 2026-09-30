import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const guide = readFileSync(new URL('../../../docs/ACCEPTANCE_TESTS/O2-B-WORKFLOW-WRITE-MANUAL-REVIEW-v1.4.0-dev.19.md', import.meta.url), 'utf8');
const scope = readFileSync(new URL('../../../docs/SCOPE_GATES/O2-B-WORKFLOW-WRITE-MANUAL-TESTABILITY-v1.4.0-dev.19.md', import.meta.url), 'utf8');
describe('dev.19 manual-testability boundaries', () => {
  it('documents deterministic hold, visible expiry deadline, explicit release and no second frame', () => {
    for (const phrase of ['hold its response', 'same Device', 'a specific expiry time', 'displayed boundary has passed', 'Release the first response explicitly', 'no second Modbus frame was sent', 'Effective value', 'COMMAND_EXPIRED']) expect(guide).toContain(phrase);
    expect(guide).toContain('Do not test this by arbitrary sleep alone');
    expect(guide).toContain('disposable external Simulator with controllable response timing');
  });
  it('documents the exact non-safety-rated FC05/FC01 mismatch and no side effects', () => {
    for (const phrase of ['FC05', 'Unit 1, zero-based Coil address 0', 'FC01, Unit 1, zero-based Coil address 1', 'Commanded `true`, Effective `true`, Read-back `false`', 'Write status MISMATCH', 'no second command, retry frame', 'SHARED_TAG mutation', 'extra Poller', 'Restore the correct read-back Mapping']) expect(guide).toContain(phrase);
  });
  it('keeps the approved scope narrow and the Owner review pending', () => {
    expect(scope).toContain('five-second expiry'); expect(scope).toContain('No change to dev.18 write admission');
    expect(scope).toContain('No new Server Audit event/schema'); expect(scope).toContain('Owner Simulator Manual Review remains **PENDING**');
    expect(guide).toContain('Production Device test: **NOT AUTHORIZED**');
  });
});
