import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { AcquisitionMappingEditor } from './AcquisitionMappingEditor.js';
import { defaultAcquisition } from '../../lib/acquisitionApi.js';
// Existing-dependency component event harness; not a real browser accessibility claim.
const hooks = vi.hoisted(() => ({ slots: [] as any[], index: 0, effects: [] as Array<() => any> }));
vi.mock('react', async original => {
  const actual = await original<typeof import('react')>();
  return { ...actual, useState: (initial: any) => { const i = hooks.index++; if (!(i in hooks.slots)) hooks.slots[i] = typeof initial === 'function' ? initial() : initial; return [hooks.slots[i], (next: any) => { hooks.slots[i] = typeof next === 'function' ? next(hooks.slots[i]) : next; }]; },
    useRef: (initial: any) => { const i = hooks.index++; return hooks.slots[i] ?? (hooks.slots[i] = { current: initial }); }, useId: () => `test-${hooks.index++}`, useEffect: (effect: () => any) => { hooks.effects.push(effect); } };
});
const id = '11111111-1111-4111-8111-111111111111';
const definition = { sourceType: 'SHARED_TAG' as const, sourceId: id, name: 'Pressure', dataType: 'Number' as const, capability: 'MONITOR_ONLY' as const, enabled: true, description: '', unit: '' };
let mapping: any, fetcher: ReturnType<typeof vi.fn>;
function nodes(node: ReactNode): ReactElement<any>[] { if (Array.isArray(node)) return node.flatMap(nodes); if (!isValidElement(node)) return []; const p = node.props as any; return [node, ...nodes(p.children), ...nodes(p.footer)]; }
const draw = () => { hooks.index = 0; hooks.effects = []; return nodes(AcquisitionMappingEditor({ definition, onClose: () => {} })); };
const field = (tree: ReactElement<any>[], name: string) => tree.find(n => n.props.name === name)!;
const flush = () => new Promise<void>(resolve => setImmediate(resolve));
const text = (node: ReactNode): string => Array.isArray(node) ? node.map(text).join('') : isValidElement(node) ? text((node.props as any).children) : typeof node === 'string' || typeof node === 'number' ? String(node) : '';
async function load() { draw(); for (const effect of [...hooks.effects]) effect(); await flush(); return draw(); }
beforeEach(() => {
  hooks.slots = []; hooks.index = 0; hooks.effects = [];
  mapping = { ...defaultAcquisition(id, false), deviceId: 'plc' };
  fetcher = vi.fn(async (url: string, init?: RequestInit) => ({ ok: true, json: async () => url === '/api/devices' ? [{ id: 'plc', name: 'PLC', enabled: true }] : { mapping: init?.body ? JSON.parse(String(init.body)) : mapping, availability: 'READY' } }));
  vi.stubGlobal('fetch', fetcher);
});
afterEach(() => vi.unstubAllGlobals());
describe('inline field and Save interaction', () => {
  it('shows immediate negative-address reason, aria association, clears with zero', async () => {
    let tree = await load(); field(tree, 'address').props.onChange({ target: { value: '-1' } }); tree = draw(); const input = field(tree, 'address');
    expect(input.props.value).toBe('-1'); expect(input.props['aria-invalid']).toBe(true);
    expect(tree.find(n => n.props.id === `${input.props.id}-error`)?.props.children).toBe('Error: Address must be zero or greater.');
    expect(input.props['aria-describedby']).toContain(`${input.props.id}-error`);
    input.props.onChange({ target: { value: '0' } }); tree = draw(); expect(field(tree, 'address').props['aria-invalid']).toBe(false); expect(text(tree)).not.toContain('Address must be zero or greater.');
  });
  it('invalid Save performs no request and focuses first invalid field; corrected Save sends a number', async () => {
    let tree = await load(); field(tree, 'address').props.onChange({ target: { value: '1e-' } }); tree = draw(); const focus = vi.fn(); (field(tree, 'address') as any).ref({ focus });
    tree.find(n => n.type === 'form')!.props.onSubmit({ preventDefault: vi.fn() }); await flush(); expect(focus).toHaveBeenCalledOnce(); expect(fetcher).toHaveBeenCalledTimes(2);
    expect(tree.find(n => n.type === 'button' && n.props.type === 'submit')!.props['aria-disabled']).toBe(true);
    field(tree, 'address').props.onChange({ target: { value: '0' } }); tree = draw(); tree.find(n => n.type === 'form')!.props.onSubmit({ preventDefault: vi.fn() }); await flush();
    expect(fetcher).toHaveBeenCalledTimes(3); expect(JSON.parse(String((fetcher.mock.calls[2][1] as RequestInit).body)).address).toBe(0);
  });
  it('all editable fields expose labels and invalid/error associations; text drafts preserve partial input', async () => {
    let tree = await load();
    for (const name of ['deviceId','unitId','functionCode','address','dataType','width','byteOrder','wordOrder','scale','offset','pollIntervalMs','staleAfterMs','enabled']) {
      const input = field(tree, name); expect(tree.some(n => n.type === 'label' && n.props.htmlFor === input.props.id)).toBe(true); expect(input.props['aria-describedby']).toContain(`${input.props.id}-error`);
    }
    field(tree, 'scale').props.onChange({ target: { value: '-' } }); tree = draw(); expect(field(tree, 'scale').props.value).toBe('-'); expect(field(tree, 'scale').props['aria-invalid']).toBe(true);
  });
  it('comboboxes are native fixed selects and stale values stay visible and invalid', async () => {
    mapping = { ...mapping, deviceId: 'deleted', functionCode: 99, dataType: 'ASCII', byteOrder: 'stale', wordOrder: 'stale' };
    const tree = await load();
    for (const name of ['deviceId','functionCode','dataType','byteOrder','wordOrder']) { const select = field(tree, name); expect(select.type).toBe('select'); expect(select.props['aria-invalid']).toBe(true); const options = nodes(select).filter(n => n.type === 'option'); expect(options.some(n => n.props.value === select.props.value && n.props.disabled)).toBe(true); }
    expect(field(tree, 'functionCode').props.value).toBe('99');
  });
  it('invalid stored Width is not repaired until an explicit user action', async () => {
    mapping.width = 3; let tree = await load(); expect(field(tree, 'width').props.value).toBe('3'); expect(field(tree, 'width').props['aria-invalid']).toBe(true);
    tree.find(n => n.type === 'button' && text(n).startsWith('Use required codec width'))!.props.onClick(); tree = draw(); expect(field(tree, 'width').props.value).toBe('1'); expect(text(tree)).toContain('Width explicitly corrected');
  });
  it('codec change announces width and retains scale/offset and FC', async () => {
    mapping.scale = 2; mapping.offset = 3; let tree = await load(); field(tree, 'dataType').props.onChange({ target: { value: 'Float64' } }); tree = draw();
    expect(field(tree, 'width').props.value).toBe('4'); expect(field(tree, 'scale').props.value).toBe('2'); expect(field(tree, 'offset').props.value).toBe('3'); expect(field(tree, 'functionCode').props.value).toBe('3'); expect(text(tree)).toContain('Derived Width is 4');
  });
  it('server errors stay in a form-level alert while field errors clear on correction', async () => {
    let tree = await load(); fetcher.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Device was removed' }) });
    tree.find(n => n.type === 'form')!.props.onSubmit({ preventDefault: vi.fn() }); await flush(); tree = draw(); expect(tree.some(n => n.props.role === 'alert' && text(n).includes('Device was removed'))).toBe(true);
    field(tree, 'address').props.onChange({ target: { value: '-1' } }); tree = draw(); field(tree, 'address').props.onChange({ target: { value: '0' } }); tree = draw(); expect(field(tree, 'address').props['aria-invalid']).toBe(false); expect(text(tree)).toContain('Device was removed');
  });
});
