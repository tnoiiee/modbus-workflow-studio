import { createServer, type Server } from 'node:net';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { afterEach, describe, expect, it } from 'vitest';

const children: ChildProcess[] = [], servers: Server[] = [], dirs: string[] = [];
afterEach(async () => {
  for (const child of children.splice(0)) {
    if (child.exitCode !== null || child.signalCode !== null) continue;
    const exited = once(child, 'exit'); child.kill('SIGTERM'); await exited.catch(() => undefined);
  }
  for (const server of servers.splice(0)) await new Promise<void>(resolve => server.close(() => resolve()));
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
});
async function freePort() {
  const server = createServer(); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw Error('No test port'); const port = address.port;
  await new Promise<void>(resolve => server.close(() => resolve())); return port;
}
async function waitForServer(url: string, child: ChildProcess) {
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw Error(`Server exited during startup (${child.exitCode})`);
    try { if ((await fetch(`${url}/api/health`)).ok) return; } catch { /* Wait for the local test Server to bind. */ }
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  throw Error('Server did not start');
}
describe('legacy direct Workflow write endpoint fails closed', () => {
  it('returns 410 without looking up or connecting a Device, changing Workflow state, or emitting write traffic', async () => {
    let deviceAccepts = 0, deviceWrites = 0;
    const simulator = createServer(socket => { deviceAccepts++; socket.on('data', data => { deviceWrites += data.length; }); });
    await new Promise<void>(resolve => simulator.listen(0, '127.0.0.1', resolve)); servers.push(simulator);
    const simAddress = simulator.address(); if (!simAddress || typeof simAddress === 'string') throw Error('Simulator not bound');
    const port = await freePort(), dir = await mkdtemp(path.join(tmpdir(), 'mws-legacy-write-')); dirs.push(dir);
    const child = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], { cwd: process.cwd(), env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dir, ALLOW_WRITES: 'true' }, stdio: ['ignore', 'pipe', 'pipe'] });
    children.push(child); const url = `http://127.0.0.1:${port}`; await waitForServer(url, child);
    const deviceConfig = { id: 'sim-secret', name: 'Simulator Secret Label', host: '127.0.0.1', port: simAddress.port, defaultUnitId: 1, timeout: 500, retryCount: 0, interRequestDelay: 0, reconnectDelay: 100, enabled: true };
    expect((await fetch(`${url}/api/devices`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(deviceConfig) })).status).toBe(201);
    const deviceDisconnect = await fetch(`${url}/api/devices/${deviceConfig.id}/disconnect`, { method: 'POST' }); expect(deviceDisconnect.status).toBe(200);
    const workflowsBefore = await (await fetch(`${url}/api/workflows`)).json();
    const selected = workflowsBefore[0] as { id: string };
    const runtimeBefore = await (await fetch(`${url}/api/workflows/${selected.id}/runtime`)).json();
    const trafficBefore = await (await fetch(`${url}/api/traffic`)).json();
    const auditBefore = await (await fetch(`${url}/api/audit`)).json();
    const sessionsBefore = await (await fetch(`${url}/api/runtime/summary`)).json();
    const attempts = [
      { params: { value: true }, expectedText: 'valid-looking' },
      { params: { value: 'not-a-boolean', deviceId: deviceConfig.id, configProbe: 'credential-sentinel-NOT-A-REAL-SECRET' }, expectedText: 'invalid-shape' },
    ];
    for (const attempt of attempts) {
      const response = await fetch(`${url}/api/nodes/arbitrary-output-id/write`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(attempt.params) });
      const payload = await response.json();
      expect(response.status, attempt.expectedText).toBe(410);
      expect(payload).toEqual({ code: 'LEGACY_DIRECT_WRITE_DISABLED', error: 'Direct node writes are disabled. Modbus writes must use the guarded Workflow runtime.' });
      expect(JSON.stringify(payload)).not.toContain('sim-secret'); expect(JSON.stringify(payload)).not.toContain('127.0.0.1'); expect(JSON.stringify(payload)).not.toContain('credential-sentinel-NOT-A-REAL-SECRET');
    }
    const workflowsAfter = await (await fetch(`${url}/api/workflows`)).json();
    const runtimeAfter = await (await fetch(`${url}/api/workflows/${selected.id}/runtime`)).json();
    const trafficAfter = await (await fetch(`${url}/api/traffic`)).json();
    const auditAfter = await (await fetch(`${url}/api/audit`)).json();
    const sessionsAfter = await (await fetch(`${url}/api/runtime/summary`)).json();
    const devicesAfter = await (await fetch(`${url}/api/devices`)).json() as Array<{ id: string; runtime: { actualState: string; queueLength: number } }>;
    expect(workflowsAfter).toEqual(workflowsBefore); expect(runtimeAfter).toEqual(runtimeBefore); expect(trafficAfter).toEqual(trafficBefore); expect(auditAfter).toEqual(auditBefore); expect(sessionsAfter).toEqual(sessionsBefore);
    expect(devicesAfter.find(item => item.id === deviceConfig.id)?.runtime).toMatchObject({ actualState: 'disconnected', queueLength: 0 });
    expect(deviceAccepts).toBe(0); expect(deviceWrites).toBe(0);
    expect((await (await fetch(`${url}/api/health`)).json()).allowWrites).toBe(true);
  });

  it('retains JSON parser and body-size rejection before the compatibility route', async () => {
    const port = await freePort(), dir = await mkdtemp(path.join(tmpdir(), 'mws-legacy-body-')); dirs.push(dir);
    const child = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], { cwd: process.cwd(), env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dir, ALLOW_WRITES: 'false' }, stdio: ['ignore', 'pipe', 'pipe'] });
    children.push(child); const url = `http://127.0.0.1:${port}`; await waitForServer(url, child);
    const malformed = await fetch(`${url}/api/nodes/x/write`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad json' });
    expect(malformed.status).toBe(400);
    const oversized = await fetch(`${url}/api/nodes/x/write`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ value: 'x'.repeat(300 * 1024) }) });
    expect(oversized.status).toBe(413);
    const validJson = await fetch(`${url}/api/nodes/x/write`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ value: 'invalid' }) });
    expect(validJson.status).toBe(410); expect(await validJson.json()).toMatchObject({ code: 'LEGACY_DIRECT_WRITE_DISABLED' });
    expect((await (await fetch(`${url}/api/health`)).json()).allowWrites).toBe(false);
  });
});
