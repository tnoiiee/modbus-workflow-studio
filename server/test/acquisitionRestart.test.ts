import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { fixture } from './acquisitionFixtures.js';
import { OverviewPageManager } from '../src/overviewPages.js';
import { OverviewControlStateStore } from '../src/overviewControlStates.js';
import type { TagSample, TagUpdate } from '../src/tagRuntime.js';
import type { AcquisitionMapping } from '../src/acquisitionConfig.js';
type Evidence = { pid: number; epoch: string; mapping: AcquisitionMapping; sample: TagSample; updates: TagUpdate[]; reads: number; connects: number };
function childEvidence(directory: string, id: string, phase: string): Promise<Evidence> {
  return new Promise((resolve, reject) => {
    const child = fork(fileURLToPath(new URL('./harness/acquisitionRestart.ts', import.meta.url)), [directory, id, phase], { execArgv: ['--import', 'tsx'], stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
    let evidence: Evidence | undefined, stderr = '';
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(Error(`Test harness timeout: ${stderr}`)); }, 8000);
    child.stderr?.on('data', chunk => { stderr += chunk; });
    child.on('message', message => { evidence = message as Evidence; });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); if (code === 0 && evidence) resolve(evidence); else reject(Error(`Test harness exited ${code}: ${stderr}`)); });
  });
}
it('separate processes on the same persisted directory get new epoch/no last-good, preserve configuration and do not autoconnect', async () => {
  const f = fixture();
  try {
    const mapping = f.map(); f.config.put(mapping);
    const pages = new OverviewPageManager(f.dir), page = pages.create({ name: 'Restart boundary' });
    new OverviewControlStateStore(f.dir).set(page.id, 'preview-test', false);
    const files = ['source-definitions.json', 'shared-tag-acquisition.json', 'overview-pages.json', `overview-pages/${page.id}.json`, 'overview-control-states.json'];
    const hashes = () => files.map(file => createHash('sha256').update(fs.readFileSync(path.join(f.dir, file))).digest('hex'));
    const before = hashes(), topFiles = fs.readdirSync(f.dir).sort();
    const first = await childEvidence(f.dir, mapping.sourceId, 'first');
    expect(first.sample).toMatchObject({ value: 42, quality: 'GOOD', lastGoodValue: 42 }); expect(first.reads).toBeGreaterThan(0); expect(first.connects).toBe(0);
    expect(hashes()).toEqual(before);
    const restart = await childEvidence(f.dir, mapping.sourceId, 'restart');
    expect(restart.pid).not.toBe(first.pid); expect(restart.epoch).not.toBe(first.epoch);
    expect(restart.mapping).toEqual(mapping); expect(restart.reads).toBe(0); expect(restart.connects).toBe(0);
    expect(restart.sample).toMatchObject({ quality: 'DISCONNECTED', value: null, hasValue: false, receiveTimestamp: null, lastGoodValue: null, lastGoodReceiveTimestamp: null, serverEpoch: restart.epoch });
    expect(restart.updates[0]).toMatchObject({ kind: 'updated', sample: { quality: 'UNCERTAIN', reason: 'NO_SAMPLE', hasValue: false, lastGoodValue: null } });
    expect(hashes()).toEqual(before); expect(fs.readdirSync(f.dir).sort()).toEqual(topFiles); expect(new OverviewPageManager(f.dir).get(page.id)?.revision).toBe(page.revision);
  } finally { f.cleanup(); }
}, 20000);
