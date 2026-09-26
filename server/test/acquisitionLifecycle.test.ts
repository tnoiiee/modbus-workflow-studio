import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { expect, it } from 'vitest';
import { fixture, device } from './acquisitionFixtures.js';

it('real server startup / WS reconnect never connects Device; acquisition outlives browsers and stops on manual disconnect', async () => {
  const f = fixture(); const sockets = new Set<net.Socket>(); let reads = 0;
  let onRead: (() => void) | undefined;
  const simulator = net.createServer(socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); socket.on('error', () => {}); socket.on('data', request => {
    reads++; expect(request[7]).toBe(3); const response = Buffer.from([request[0]!, request[1]!, 0, 0, 0, 5, 1, 3, 2, 0, 42]); socket.write(response.subarray(0, 5)); socket.write(response.subarray(5)); onRead?.();
  }); });
  simulator.listen(0, '127.0.0.1'); await once(simulator, 'listening');
  const probe = net.createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening'); const port = (probe.address() as net.AddressInfo).port; await new Promise<void>(r => probe.close(() => r()));
  fs.writeFileSync(path.join(f.dir, 'devices.json'), JSON.stringify([{ ...device, port: (simulator.address() as net.AddressInfo).port }])); const mapping = f.map(); f.config.put(mapping);
  const mappingBytes = fs.readFileSync(path.join(f.dir, 'shared-tag-acquisition.json'));
  const launch = () => spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], { cwd: process.cwd(), env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: f.dir, ALLOW_WRITES: 'false' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let child = launch();
  const clients: WebSocket[] = []; const liveTypes: string[] = []; let logs = ''; child.stderr.on('data', b => { logs += b; });
  const started = () => new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(Error(`Server startup timeout: ${logs}`)), 10000);
      child.once('exit', code => { clearTimeout(timeout); reject(Error(`Server exited ${code}: ${logs}`)); });
      child.stdout.on('data', chunk => { if (String(chunk).includes('MODBUS WORKFLOW STUDIO')) { clearTimeout(timeout); resolve(); } });
    });

  try {
    await started();
    const base = `http://127.0.0.1:${port}`;
    expect((await (await fetch(`${base}/api/health`)).json()).version).toBe('1.4.0-dev.7');
    const browser = async () => { const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/live`); clients.push(ws); ws.on('message', raw => { const message = JSON.parse(String(raw)); liveTypes.push(message.type); if (message.type === 'hello') expect(message.data.version).toBe('1.4.0-dev.7'); }); await once(ws, 'open'); ws.send(JSON.stringify({ type: 'resync' })); return ws; };
    const a = await browser(); a.close(); const b = await browser();
    expect((await (await fetch(`${base}/api/devices`)).json())[0].runtime.actualState).toBe('disconnected'); expect(reads).toBe(0);
    const waitRead = async () => {
      const before = reads;
      await new Promise<void>((resolve, reject) => { const timer = setTimeout(() => reject(Error('No acquisition read')), 2000); onRead = () => { if (reads > before) { clearTimeout(timer); onRead = undefined; resolve(); } }; });
    };
    expect((await fetch(`${base}/api/devices/plc/connect`, { method: 'POST' })).status).toBe(200); await waitRead(); b.close(); await waitRead();
    const workflows = await (await fetch(`${base}/api/workflows`)).json(); expect(workflows.every((w: { running: boolean }) => !w.running)).toBe(true);
    expect((await fetch(`${base}/api/tag-runtime/snapshot`, { method: 'POST' })).status).toBe(404);
    await fetch(`${base}/api/devices/plc/disconnect`, { method: 'POST' }); const stoppedAt = reads; await browser();
    await new Promise(r => setTimeout(r, 250)); expect(reads).toBe(stoppedAt); expect(liveTypes.some(type => type.startsWith('tag'))).toBe(false); expect(liveTypes).toContain('hello'); expect((await (await fetch(`${base}/api/devices`)).json())[0].runtime.actualState).toBe('disconnected');
    // Restart the actual application on the SAME DATA_DIR, without any runtime observer endpoint.
    for (const ws of clients) ws.terminate();
    child.kill('SIGTERM'); if (child.exitCode === null) await once(child, 'exit');
    child = launch(); child.stderr.on('data', chunk => { logs += chunk; }); await started();
    expect(fs.readFileSync(path.join(f.dir, 'shared-tag-acquisition.json'))).toEqual(mappingBytes);
    const loaded = await (await fetch(`${base}/api/shared-tag-acquisition/${mapping.sourceId}`)).json();
    expect(loaded.mapping).toEqual(mapping);
    expect((await (await fetch(`${base}/api/devices`)).json())[0].runtime.actualState).toBe('disconnected');
    const restartReads = reads; await browser(); await new Promise(r => setTimeout(r, 250));
    expect(reads).toBe(restartReads); expect(liveTypes.some(type => type.startsWith('tag'))).toBe(false);
    expect((await (await fetch(`${base}/api/devices`)).json())[0].runtime.actualState).toBe('disconnected');
  } finally {
    for (const ws of clients) ws.terminate();
    child.kill('SIGTERM'); if (child.exitCode === null) await once(child, 'exit');
    for (const socket of sockets) socket.destroy(); await new Promise<void>(r => simulator.close(() => r())); f.cleanup();
  }
}, 25000);
