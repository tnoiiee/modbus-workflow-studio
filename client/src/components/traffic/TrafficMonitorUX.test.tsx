import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { TrafficMonitor } from './TrafficMonitor.js';
const hooks = vi.hoisted(() => ({ slots: [] as any[], index: 0 }));
vi.mock('react', async original => {
  const actual = await original<typeof import('react')>();
  return { ...actual, useState: (initial: any) => { const i = hooks.index++; if (!(i in hooks.slots)) hooks.slots[i] = initial; return [hooks.slots[i], (next: any) => { hooks.slots[i] = next; }]; },
    useRef: (initial: any) => { const i = hooks.index++; return hooks.slots[i] ?? (hooks.slots[i] = { current: initial }); }, useId: () => `traffic-test-${hooks.index++}`, useMemo: (fn: () => any) => { hooks.index++; return fn(); } };
});
const row = { timestamp: '2026-09-26T12:00:00Z', direction: 'RX', deviceId: 'plc', tx: 0, fc: 3, address: 0, duration: 0, result: 'success', payload: 'A'.repeat(20000), error: '<script>bad</script>', workflowId: 'w', nodeId: 'n', requestClass: 'workflow' };
function nodes(node: ReactNode): ReactElement<any>[] { if (Array.isArray(node)) return node.flatMap(nodes); if (!isValidElement(node)) return []; return [node, ...nodes((node.props as any).children)]; }
const draw = (rows: unknown[]) => { hooks.index = 0; return nodes(TrafficMonitor({ rows })); };
const buttons = (tree: ReactElement<any>[]) => tree.filter(n => n.type === 'button' && 'aria-expanded' in n.props);
beforeEach(() => { hooks.slots = []; hooks.index = 0; });
describe('Traffic event callbacks (not browser layout/keyboard proof)', () => {
  it('opens bounded escaped details for one event, with all optional fields and clear truncation', () => {
    let tree = draw([row]); buttons(tree)[0].props.onClick(); tree = draw([row]); const button = buttons(tree)[0];
    expect(button.props['aria-expanded']).toBe(true); expect(tree.some(n => n.props.id === button.props['aria-controls'])).toBe(true);
    const detail = tree.find(n => typeof n.type === 'function')!; const html = renderToStaticMarkup(detail);
    for (const label of ['Workflow ID','Node ID','Monitor list ID','Request class','Payload (protocol hex)','Encoded payload','Display truncated at 16384']) expect(html).toContain(label);
    expect(html).not.toContain('<script>'); expect(html).toContain('&lt;script&gt;'); expect(html.length).toBeLessThan(21000);
    button.props.onClick(); tree = draw([row]); expect(buttons(tree)[0].props['aria-expanded']).toBe(false);
  });
  it('retains open event across prepends without collapsing reused transaction IDs together', () => {
    let tree = draw([row, { ...row }]); buttons(tree)[0].props.onClick(); tree = draw([{ ...row }, row, { ...row }]);
    expect(buttons(tree).map(button => button.props['aria-expanded'])).toEqual([false, true, false]);
    buttons(tree)[0].props.onClick(); tree = draw([{ ...row }, row]); expect(buttons(tree).filter(button => button.props['aria-expanded'])).toHaveLength(0); // New objects are not persisted identities.
  });
  it('pages are bounded and controls enable/disable at the boundaries', () => {
    const rows = Array.from({ length: 51 }, () => ({ ...row })); let tree = draw(rows);
    expect(buttons(tree)).toHaveLength(50); const next = tree.find(n => n.type === 'button' && n.props.children === 'Next')!; expect(next.props.disabled).toBe(false); next.props.onClick();
    tree = draw(rows); expect(buttons(tree)).toHaveLength(1); expect(tree.find(n => n.type === 'button' && n.props.children === 'Next')!.props.disabled).toBe(true);
    tree.find(n => n.type === 'button' && n.props.children === 'Previous')!.props.onClick(); expect(buttons(draw(rows))).toHaveLength(50);
  });
});
