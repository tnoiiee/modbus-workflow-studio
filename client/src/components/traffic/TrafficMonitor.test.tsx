import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { TrafficMonitor } from './TrafficMonitor.js';
import { TRAFFIC_COLUMNS } from '../../lib/traffic.js';
const row = { timestamp: '2026-09-26T12:00:00Z', direction: 'RX', deviceId: 'plc', tx: 0, fc: 3, address: 0, duration: 0, result: 'success', payload: '010203', requestClass: 'acquisition' };
describe('Traffic SSR layout and wiring (browser review still required)', () => {
  it('fixed headers stay identical across changing origins and malformed records', () => {
    const headers = (rows: unknown[]) => renderToStaticMarkup(<TrafficMonitor rows={rows} />).match(/<thead>.*?<\/thead>/)?.[0];
    expect(headers([row])).toBe(headers([{ ...row, workflowId: 'workflow', requestClass: 'workflow' }, null]));
    expect(headers([])).toBe(headers([row])); for (const label of TRAFFIC_COLUMNS) expect(headers([row])).toContain(label.replace(' / ', ' / '));
  });
  it('shows result, payload, zero values, origin and event-level details button', () => {
    const html = renderToStaticMarkup(<TrafficMonitor rows={[row]} />); for (const value of ['Shared Tag Acquisition','success','010203','0 ms','aria-expanded="false"','aria-controls=', 'Best-effort']) expect(html).toContain(value);
  });
  it('escapes markup, bounds long previews and never assumes raw objects', () => {
    const html = renderToStaticMarkup(<TrafficMonitor rows={[null, {}, { ...row, payload: '<script>alert(1)</script>', error: 'X'.repeat(1000000) }]} />);
    expect(html).not.toContain('<script>'); expect(html).toContain('&lt;script&gt;'); expect(html).toContain('—'); expect(html.length).toBeLessThan(18000);
  });
  it('renders only one 50-record page out of the existing 5000-record retention', () => {
    const html = renderToStaticMarkup(<TrafficMonitor rows={Array.from({ length: 5000 }, () => ({ ...row }))} />);
    expect(html.match(/aria-expanded=/g)).toHaveLength(50); expect(html).toContain('Page 1 of 100'); expect(html).toContain('5000 retained events');
  });
  it('changes only Traffic route; retains existing App REST/WS cap and generic runtime Table', () => {
    const app = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8'); expect(app).toContain("page==='Traffic Monitor'&&<TrafficMonitor rows={traffic}/>");
    expect(app).toContain('slice(0,5000)'); expect(app).toContain('function Table('); expect(app).toContain('slice(0,10)');
    const source = readFileSync(new URL('./TrafficMonitor.tsx', import.meta.url), 'utf8'); expect(source).not.toMatch(/dangerouslySetInnerHTML|WebSocket|fetch\(|JSON.stringify|Object.keys/);
    expect(source).toContain('key={row.key}'); expect(source).toContain('TRAFFIC_DETAIL_CHARS');
  });
});
