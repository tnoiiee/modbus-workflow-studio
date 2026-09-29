import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const masterPlan = readFileSync(new URL('../../docs/MASTER_PLAN.md', import.meta.url), 'utf8');
const scope = readFileSync(new URL('../../docs/SCOPE_GATES/O2-B-WORKFLOW-WRITE-FOUNDATION-v1.4.0-dev.18.md', import.meta.url), 'utf8');
const acceptance = readFileSync(new URL('../../docs/ACCEPTANCE_TESTS/O2-B-WORKFLOW-WRITE-MANUAL-REVIEW-v1.4.0-dev.18.md', import.meta.url), 'utf8');

describe('Owner roadmap and development boundary', () => {
  it('records all seven Major roadmap phases and the practical checkpoint Definition of Done', () => {
    for (const title of [
      'Stable Modbus I/O Foundation', 'Canonical Data Management', 'Workflow and Logic Management',
      'Operator HMI and UX', 'Reliability, Recovery, and Deployment', 'Practical OT Access Boundary',
      'Practical Validation and Commissioning',
    ]) expect(masterPlan).toContain(title);
    expect(masterPlan).toContain('## Practical checkpoint Definition of Done');
    for (const item of ['atomic persistence', 'backup/restore', '`DATA_DIR`', 'offline deployment', 'upgrade and rollback', 'basic roles', 'simulator', 'representative hardware']) {
      expect(masterPlan.toLowerCase()).toContain(item.toLowerCase());
    }
  });

  it('keeps industrial guidance non-certifying and future transport optional and adapter-ready', () => {
    expect(masterPlan).toMatch(/not current compliance targets/i);
    expect(masterPlan).toMatch(/not a certification plan/i);
    expect(masterPlan).toMatch(/MQTT\/Sparkplug is \*\*not implemented\*\*/);
    expect(masterPlan).toMatch(/not a committed requirement/i);
    expect(masterPlan).toMatch(/core signals and Published Workflow Outputs do not contain transport-specific identities/i);
    expect(masterPlan).toMatch(/MQTT topics and Sparkplug identifiers do not belong in SHARED_TAG/i);
    expect(masterPlan).toMatch(/no adapter may write `DeviceConnection` directly/i);
    expect(masterPlan).not.toMatch(/\b(?:IEC|ISA|SIL)\s+(?:compliant|certified|certification target)\b/i);
  });

  it('preserves the exact execution priority, deferred O2-C record, and dev.18 scope boundary', () => {
    const ordered = [
      'Complete v1.4.0-dev.18', 'Owner Simulator Write review', 'Shared Tag Input', 'Explicit state/latch lifecycle',
      'Published Workflow Output', 'Workflow Command Input', 'Overview Operator Control', 'Backup/restore',
      'Practical access boundary', 'Hardware validation', 'Soak validation', 'Optional scopes',
    ];
    let position = -1;
    for (const item of ordered) { const next = masterPlan.indexOf(item, position + 1); expect(next).toBeGreaterThan(position); position = next; }
    expect(masterPlan).toContain('SCOPE_GATES/O2-C-PICTURE-BOX-ASSETS-DEFERRED.md');
    expect(masterPlan).toMatch(/O2-C Picture Box and Assets remains \*\*DEFERRED, not cancelled\*\*/);
    expect(scope).toContain('HTTP 410');
    expect(scope).toContain('LEGACY_DIRECT_WRITE_DISABLED');
    expect(scope).toContain('ALLOW_WRITES=false');
    expect(scope).toMatch(/no read-on-demand, new poller\/connection, or automatic mismatch retry/);
    expect(acceptance).toContain('PENDING Owner review');
    expect(acceptance).toContain('not authorization for production devices');
  });
});
