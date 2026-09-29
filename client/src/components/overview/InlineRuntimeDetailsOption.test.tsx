import { isValidElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { ElementInspector } from './ElementInspector.js';
import { EditorMonitoring, RuntimeMonitoringView } from './RuntimeMonitoring.js';
import { RuntimeDetails } from './RuntimeDetails.js';
import { RuntimeSafetyPanel } from './RuntimeSafetyPanel.js';
import { OverviewRuntimeProvider } from './OverviewRuntimeProvider.js';
import { OverviewTagClientAdapter } from '../../lib/overviewTagClientAdapter.js';
import { canvasMonitoringLayout } from '../../lib/overviewCanvasPresentation.js';
import { runtimePresentation } from '../../lib/overviewRuntimePresentation.js';
import { overviewRuntimeSelection, isRuntimeMonitoring } from '../../lib/overviewRuntimeSelection.js';
import { showsRuntimeDetails, validatePresentationStyle } from '../../lib/overviewPresentationStyle.js';
import { configuration, sampleItem } from '../../lib/overviewRuntimeFixtures.js';
import { createOverviewElement, OVERVIEW_ALL_ELEMENT_TYPES, validateOverviewElements, emptyOverviewHistory, pushOverviewHistory, undoOverviewHistory, redoOverviewHistory, type OverviewElementType } from '../../lib/overviewElements.js';
import { beginOverviewEdit, cancelOverviewEdit, finishOverviewSave, overviewDraftMatchesBaseline } from '../../lib/overviewState.js';

// Deterministic hook stand-ins (as in RuntimeSafetyPanel.test); no browser/keyboard mount.
const h = vi.hoisted(() => ({ refs: [] as any[], effects: [] as any[], ri: 0, ei: 0 }));
vi.mock('react', async original => ({ ...await original<typeof import('react')>(), useId: () => 'inspector-test',
  useState: (initial: any) => [initial, () => undefined],
  useRef: (initial: any) => h.refs[h.ri++] ??= { current: initial },
  useEffect: () => { h.ei++; } }));
vi.mock('react-dom', async original => ({ ...await original<typeof import('react-dom')>(), createPortal: (content: any) => content }));
beforeEach(() => { h.refs = []; h.effects = []; h.ri = h.ei = 0; });

const ELIGIBLE = ['NUMERIC_LABEL', 'VALUE_BADGE', 'STATUS_LIGHT', 'TEXT_LABEL'] as const;
const INELIGIBLE = OVERVIEW_ALL_ELEMENT_TYPES.filter(t => !(ELIGIBLE as readonly string[]).includes(t));
const nodes = (node: ReactNode): any[] => Array.isArray(node) ? node.flatMap(nodes) : isValidElement(node) ? [node, ...nodes((node.props as any).children)] : [];
const text = (node: ReactNode): string => Array.isArray(node) ? node.map(text).join('') : typeof node === 'string' || typeof node === 'number' ? String(node) : isValidElement(node) ? text((node.props as any).children) : '';
function inspector(type: OverviewElementType, mutate?: (e: ReturnType<typeof createOverviewElement>) => void) {
  const element = createOverviewElement(type, { id: 'e', x: 32, y: 48 }); mutate?.(element);
  const patch = vi.fn(), other = vi.fn();
  const tree = ElementInspector({ element, onPatchStyle: patch, onPatch: other, onPatchBinding: other, onToggleLock: other, onToggleVisible: other, onDuplicate: other, onDelete: other, onBringForward: other, onBringToFront: other, onSendBackward: other, onSendToBack: other });
  const all = nodes(tree), checkbox = all.find(n => n.type === 'input' && n.props.type === 'checkbox' && String(n.props.id).endsWith('runtime-details'));
  return { element, patch, other, tree, all, checkbox };
}
const layoutFixture = (type: OverviewElementType = 'NUMERIC_LABEL', on?: boolean, width = 320, height = 120) => {
  const f = configuration(1, type); if (on === undefined) delete f.element.style.showRuntimeDetails; else f.element.style.showRuntimeDetails = on;
  f.element.width = width; f.element.height = height; return f;
};
const view = (f: ReturnType<typeof configuration>, onDetails?: () => void, quality: 'GOOD' | 'BAD' = 'GOOD') => renderToStaticMarkup(<RuntimeMonitoringView element={f.element} presentation={runtimePresentation(f.element, f.resolution, sampleItem(1, f.element.type === 'STATUS_LIGHT' ? false : 8888.88, quality), 'Connected')} age="1s" onDetails={onDetails} />);

describe('dev.16 showRuntimeDetails schema and fallback', () => {
  it.each(OVERVIEW_ALL_ELEMENT_TYPES)('%s new-element default: explicit false only for the four eligible Monitoring types', type => {
    const e = createOverviewElement(type, { id: 'e', x: 0, y: 0 });
    if ((ELIGIBLE as readonly string[]).includes(type)) expect(e.style.showRuntimeDetails).toBe(false); else expect(e.style).not.toHaveProperty('showRuntimeDetails');
    expect(validateOverviewElements({ id: 'page', layerOrder: ['e'] }, [e])).toEqual([]);
  });
  it('eligible set equals the unchanged Runtime Monitoring contract', () => {
    for (const type of OVERVIEW_ALL_ELEMENT_TYPES) expect(isRuntimeMonitoring(type)).toBe((ELIGIBLE as readonly string[]).includes(type));
  });
  it('absent field resolves false without writing or dirtying; explicit values are honoured', () => {
    const e = createOverviewElement('NUMERIC_LABEL', { id: 'e', x: 0, y: 0 }); delete e.style.showRuntimeDetails;
    const page = { id: 'p', revision: 3, elements: [e], layerOrder: ['e'], savedViewport: { x: 1, y: 2, zoom: 1 } } as any;
    const before = JSON.stringify(page), session = beginOverviewEdit(page);
    expect(showsRuntimeDetails(e)).toBe(false); canvasMonitoringLayout(e); inspector('NUMERIC_LABEL', x => { delete x.style.showRuntimeDetails; });
    expect(JSON.stringify(page)).toBe(before); expect(e.style).not.toHaveProperty('showRuntimeDetails');
    expect(overviewDraftMatchesBaseline(session.draft, session.baseline)).toBe(true);
    expect(showsRuntimeDetails({ ...e, style: { ...e.style, showRuntimeDetails: true } })).toBe(true);
    expect(showsRuntimeDetails({ ...e, style: { ...e.style, showRuntimeDetails: false } })).toBe(false);
  });
  it('validation accepts booleans/absence and rejects non-boolean values only for this field', () => {
    const style = createOverviewElement('NUMERIC_LABEL', { id: 'e', x: 0, y: 0 }).style;
    expect(validatePresentationStyle(style)).toEqual([]); expect(validatePresentationStyle({ ...style, showRuntimeDetails: true })).toEqual([]);
    expect(validatePresentationStyle({ ...style, showRuntimeDetails: 'yes' as any })).toEqual(['showRuntimeDetails must be boolean']);
  });
  it('no migration site: the field is referenced only by the type, the new-element default and validation', () => {
    const count = (p: string) => (readFileSync(new URL(p, import.meta.url), 'utf8').match(/showRuntimeDetails/g) ?? []).length;
    expect(count('../../lib/overviewState.ts')).toBe(0); expect(count('../../lib/overviewElements.ts')).toBe(2);
  });
});

describe('dev.16 Inspector checkbox', () => {
  it.each(ELIGIBLE)('%s: checkbox shown Off for an absent field, no write on open', type => {
    const f = inspector(type, e => { delete e.style.showRuntimeDetails; });
    expect(f.checkbox).toBeDefined(); expect(f.checkbox.props.checked).toBe(false); expect(f.patch).not.toHaveBeenCalled(); expect(f.other).not.toHaveBeenCalled();
    expect(f.element.style).not.toHaveProperty('showRuntimeDetails');
  });
  it.each(INELIGIBLE)('%s: no Show Runtime Details control and no field', type => {
    const f = inspector(type); expect(f.checkbox).toBeUndefined(); expect(text(f.tree)).not.toContain('Show Runtime Details'); expect(f.element.style).not.toHaveProperty('showRuntimeDetails');
  });
  it('checkbox commits only one boolean style patch; no Binding/geometry callback', () => {
    const f = inspector('NUMERIC_LABEL');
    f.checkbox.props.onChange({ target: { checked: true } }); expect(f.patch).toHaveBeenLastCalledWith({ showRuntimeDetails: true });
    f.checkbox.props.onChange({ target: { checked: false } }); expect(f.patch).toHaveBeenLastCalledWith({ showRuntimeDetails: false });
    expect(f.patch).toHaveBeenCalledTimes(2); expect(f.other).not.toHaveBeenCalled();
  });
  it('accessible label, supporting text and native keyboard semantics', () => {
    const f = inspector('STATUS_LIGHT'), label = f.all.find(n => n.type === 'label' && n.props.htmlFor === f.checkbox.props.id);
    expect(label).toBeDefined(); expect(text(label)).toContain('Show Runtime Details');
    const help = f.all.find(n => n.type === 'small' && n.props.id === f.checkbox.props['aria-describedby']);
    expect(text(help)).toBe('Show the Runtime Details action directly on this Element. Details remain available from the Page-level Runtime panel when hidden.');
    expect(f.checkbox.props.type).toBe('checkbox'); expect(f.checkbox.props.tabIndex).toBeUndefined(); expect(f.checkbox.props.disabled).toBeUndefined();
  });
  it('lives in the existing Appearance group (no new group), in logical DOM/Tab order after Show Text and before Background', () => {
    const f = inspector('STATUS_LIGHT'), groups = f.all.filter(n => n.type === 'fieldset');
    const owner = groups.find(g => nodes(g).includes(f.checkbox)); expect(text(nodes(owner).find(n => n.type === 'legend'))).toBe('Appearance');
    expect(groups.map(g => text(nodes(g).find(n => n.type === 'legend')))).toEqual(['Content', 'Typography', 'Appearance', 'Border', 'Geometry', 'Draft Tag binding']);
    const focusables = nodes(owner).filter(n => ['input', 'select'].includes(n.type)).map(n => n.props['aria-label'] ?? n.props.type);
    expect(focusables.indexOf('Show Text')).toBeLessThan(focusables.indexOf('checkbox')); expect(focusables.indexOf('checkbox')).toBeLessThan(focusables.indexOf('color'));
    expect(f.checkbox.props.disabled).toBeUndefined(); expect(owner.props.disabled).toBe(false);
  });
  it('locked Element disables the whole Appearance group like the other fields', () => {
    const f = inspector('NUMERIC_LABEL', e => { e.locked = true; }); const owner = f.all.filter(n => n.type === 'fieldset').find(g => nodes(g).includes(f.checkbox)); expect(owner.props.disabled).toBe(true);
  });
  it('CSS keeps the checkbox a native 16px control with a visible label', () => {
    const css = readFileSync(new URL('../../styles/overview.css', import.meta.url), 'utf8');
    expect(css).toContain(".element-inspector__field--check input[type='checkbox']"); expect(css).not.toMatch(/element-inspector__field--check[^}]*(display: none|visibility: hidden|opacity: 0)/);
  });
});

describe('dev.16 Inline action layout', () => {
  it.each(ELIGIBLE)('%s On: existing dev.15 button, centered Info SVG, accessible name, nodrag/nopan, action slot', type => {
    const f = layoutFixture(type, true), open = vi.fn(), stop = vi.fn();
    const tree = RuntimeMonitoringView({ element: f.element, presentation: runtimePresentation(f.element, f.resolution, sampleItem(1, 1), 'Connected'), age: '', onDetails: open });
    const button = (tree.props.children as any[]).find(n => n?.type === 'button'); expect(button.props.className).toBe('overview-runtime-detail-button nodrag nopan');
    expect(button.props['aria-label']).toContain('Runtime details:'); button.props.onClick({ stopPropagation: stop }); expect(open).toHaveBeenCalledOnce(); expect(stop).toHaveBeenCalledOnce();
    const html = renderToStaticMarkup(tree); expect(html).toContain('has-action-slot'); expect(html).not.toContain('has-page-action'); expect(html).toContain('<svg');
    expect(canvasMonitoringLayout(f.element).inlineAction).toBe(true);
  });
  it.each([undefined, false] as const)('%s (Off/absent): no button, no action gutter class, no hidden focusable, no hiding tricks', on => {
    for (const type of ELIGIBLE) {
      const f = layoutFixture(type, on), html = view(f, () => undefined);
      expect(html).not.toContain('<button'); expect(html).not.toContain('overview-runtime-detail-button'); expect(html).not.toContain('has-action-slot'); expect(html).toContain('has-page-action');
      expect(html).not.toMatch(/tabindex|visibility:|clip:|left:\s*-|opacity:\s*0/i);
      expect(canvasMonitoringLayout(f.element).inlineAction).toBe(false);
      expect(html).toContain('Runtime details available from Page Runtime details and safety');
    }
  });
  it('Off releases the 26px gutter: content width is larger and Caption/Value/Unit use the space', () => {
    const narrow = (on: boolean) => { const f = layoutFixture('NUMERIC_LABEL', on, 120, 44); return canvasMonitoringLayout(f.element); };
    expect(narrow(true).inlineAction).toBe(false); // geometry gate still applies when On
    const css = readFileSync(new URL('../../styles/overview-runtime.css', import.meta.url), 'utf8');
    expect(css).toContain('.overview-runtime-value.has-action-slot { padding-right: 36px; }'); expect(css).toContain('.overview-runtime-value.has-page-action { padding-right: 10px; }');
    for (const width of [116, 120]) {
      const light = (on: boolean) => { const f = layoutFixture('STATUS_LIGHT', on, width, 48); f.element.style.showText = true; return canvasMonitoringLayout(f.element); };
      expect(light(true)).toMatchObject({ inlineAction: true, lightText: false }); expect(light(false)).toMatchObject({ inlineAction: false, lightText: true });
    }
  });
  it('small-Element fallback is unchanged even when On: no button, Page-level path retained', () => {
    for (const [w, h2] of [[8, 8], [24, 24], [48, 48], [111, 60], [200, 31]] as const) {
      const f = layoutFixture('NUMERIC_LABEL', true, w, h2), html = view(f, () => undefined);
      expect(canvasMonitoringLayout(f.element).inlineAction).toBe(false); expect(html).not.toContain('<button'); expect(html).toContain('has-page-action');
    }
  });
  it.each(ELIGIBLE)('%s Edit/View parity: same saved setting, same slot class, same layout; geometry untouched', type => {
    for (const on of [true, false, undefined]) {
      const f = layoutFixture(type, on), before = JSON.stringify(f.element);
      const edit = renderToStaticMarkup(<EditorMonitoring element={f.element} resolution={f.resolution} />), run = view(f);
      const cls = (html: string) => (html.match(/^<span class="([^"]*)"/)?.[1] ?? '').split(' ').filter(c => c.startsWith('has-') && (c.includes('action') || c.includes('status')) || c === 'is-micro' || c === 'is-compact').sort();
      expect(cls(edit)).toEqual(cls(run)); expect(edit.includes('has-action-slot')).toBe(on === true); expect(run.includes('has-action-slot')).toBe(on === true);
      expect(edit).not.toContain('<button'); expect(JSON.stringify(f.element)).toBe(before);
    }
  });
  it('geometry x/y/width/height/rotation and presentation projection are identical for On and Off', () => {
    const on = layoutFixture('NUMERIC_LABEL', true), off = layoutFixture('NUMERIC_LABEL', false);
    expect({ ...on.element, style: { ...on.element.style, showRuntimeDetails: undefined } }).toEqual({ ...off.element, style: { ...off.element.style, showRuntimeDetails: undefined } });
    expect(runtimePresentation(on.element, on.resolution, sampleItem(1, 5), 'Connected')).toEqual(runtimePresentation(off.element, off.resolution, sampleItem(1, 5), 'Connected'));
  });
  it('abnormal status remains concise and visible with the action Off', () => {
    const html = view(layoutFixture('NUMERIC_LABEL', false), () => undefined, 'BAD'); expect(html).toContain('overview-runtime-status-text'); expect(html).toContain('BAD'); expect(html).not.toContain('<button');
  });
});

describe('dev.16 Page-level Details fallback and Runtime isolation', () => {
  const page = (on?: boolean) => { const f = layoutFixture('NUMERIC_LABEL', on); return { f, selection: overviewRuntimeSelection([f.element], { [f.element.id]: f.resolution }) }; };
  it('eligibility, subscription sources and selection key are identical for absent/Off/On', () => {
    const [a, b, c] = [undefined, false, true].map(on => page(on).selection);
    expect(b).toEqual(a); expect(c).toEqual(a); expect(a.elementIds).toEqual(['element-1']); expect(a.sources).toHaveLength(1); expect(a.key).not.toBe('');
  });
  it.each([undefined, false, true] as const)('Page-level list still names the eligible Element and opens the same Details (%s)', on => {
    const { f, selection } = page(on), details = vi.fn(); h.ri = h.ei = 0;
    const tree = RuntimeSafetyPanel({ id: 'p', selection, elements: [f.element], message: 'READ_ONLY', origin: { current: null }, onClose: vi.fn(), onDetails: details });
    const item = nodes(tree).filter(n => n.type === 'button').find(n => text(n).includes('Runtime details')); expect(text(item)).toContain(f.element.name);
    const listed = nodes(tree).filter(n => n.type === 'button' && text(n).endsWith('— Runtime details')); expect(listed).toHaveLength(1); listed[0].props.onClick(); expect(details).toHaveBeenCalledWith('element-1');
  });
  it('Element Runtime Details diagnostics are identical whether or not the inline action is shown', () => {
    const render = (on: boolean) => { const f = layoutFixture('NUMERIC_LABEL', on), sel = overviewRuntimeSelection([f.element], { [f.element.id]: f.resolution }), adapter = new OverviewTagClientAdapter();
      adapter.store.publish([sampleItem(1, 1.123456789)], new Set(sel.sources.map(s => s.sourceId)));
      const html = renderToStaticMarkup(<OverviewRuntimeProvider adapter={adapter} enabled pageId="p" selection={sel} elements={[f.element]} resolutions={{ [f.element.id]: f.resolution }}><RuntimeDetails element={f.element} resolution={f.resolution} onClose={() => undefined} /></OverviewRuntimeProvider>);
      adapter.stop(); return html; };
    const on = render(true), off = render(false);
    expect(off).toBe(on); for (const token of ['1.123456789', 'Source timestamp', 'Source and Binding', 'Producer availability', 'Age of displayed value', 'Close details']) expect(off).toContain(token);
  });
  it('setting adds/removes no Runtime subscription, protocol or provider code path', () => {
    for (const p of ['./OverviewRuntimeProvider.tsx', './RuntimeDetails.tsx', './RuntimeSafetyPanel.tsx', './OverviewRuntimeStatus.tsx', '../../lib/overviewRuntimeSelection.ts', '../../lib/overviewRuntimeSession.ts', '../../lib/overviewBinding.ts', '../../lib/overviewRuntimePresentation.ts', '../../lib/tagRuntimeClient.ts', '../../lib/tagDeliveryProtocol.ts'])
      expect(readFileSync(new URL(p, import.meta.url), 'utf8')).not.toContain('showRuntimeDetails');
  });
});

describe('dev.16 persistence and transactions', () => {
  const base = () => createOverviewElement('NUMERIC_LABEL', { id: 'n', x: 16, y: 32 });
  it('explicit edit is one immutable style change: Undo/Redo, Cancel and Save without geometry/viewport/revision drift', () => {
    const element = base(); delete element.style.showRuntimeDetails;
    const page = { id: 'page', revision: 7, elements: [element], layerOrder: ['n'], savedViewport: { x: 24, y: 32, zoom: 1.25 } } as any;
    const before = JSON.stringify(page), session = beginOverviewEdit(page);
    const edited = { ...element, style: { ...element.style, showRuntimeDetails: true } };
    expect(overviewDraftMatchesBaseline({ ...session.draft, elements: [edited] }, session.baseline)).toBe(false);
    const history = pushOverviewHistory(emptyOverviewHistory(), [element]);
    const undo = undoOverviewHistory(history, [edited])!; expect(undo.value[0].style).not.toHaveProperty('showRuntimeDetails');
    const redo = redoOverviewHistory(undo.history, undo.value)!; expect(redo.value[0].style.showRuntimeDetails).toBe(true);
    expect(cancelOverviewEdit(page).draft.elements[0].style).not.toHaveProperty('showRuntimeDetails');
    const saved = { ...page, elements: [edited], revision: 8 }, done = finishOverviewSave(saved);
    expect(done.mode).toBe('VIEW'); expect((done.draft.elements as any)[0].style.showRuntimeDetails).toBe(true); expect(done.draft.savedViewport).toEqual(page.savedViewport);
    expect(JSON.stringify(page)).toBe(before); expect({ ...edited, style: element.style }).toEqual(element);
    expect(Object.keys(edited.style).filter(k => !(k in element.style))).toEqual(['showRuntimeDetails']);
  });
  it('Cancel restores an explicitly saved value', () => {
    const element = base(); element.style.showRuntimeDetails = true;
    const page = { id: 'page', revision: 2, elements: [element], layerOrder: ['n'] } as any; beginOverviewEdit(page);
    expect((cancelOverviewEdit(page).draft.elements as any)[0].style.showRuntimeDetails).toBe(true);
  });
});
