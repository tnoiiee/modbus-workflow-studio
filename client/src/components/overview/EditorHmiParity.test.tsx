import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { EditorMonitoring, RuntimeMonitoringView } from './RuntimeMonitoring.js';
import { ElementNode } from './ElementNode.js';
import { runtimePresentation } from '../../lib/overviewRuntimePresentation.js';
import { configuration, sampleItem } from '../../lib/overviewRuntimeFixtures.js';
import { createOverviewElement, validateOverviewElements } from '../../lib/overviewElements.js';
import * as provider from './OverviewRuntimeProvider.js';

const render = renderToStaticMarkup;
const reading = (html: string) => html.match(/<span class="overview-runtime-reading">.*?<\/span><\/span>/)?.[0];
const plain = (html: string) => html.replace(/<[^>]*>/g, '');
const css = readFileSync(new URL('../../styles/overview-runtime.css', import.meta.url), 'utf8');
describe('dev.13 shared Edit/View HMI surface (SSR/CSS contracts, not browser layout proof)', () => {
  it.each(['Pump pressure', ''] as const)('Numeric Label caption %s and unit use the same reading markup', caption => {
    const f = configuration(); f.element.style.text = caption;
    const edit = render(<EditorMonitoring element={f.element} resolution={f.resolution} />);
    const p = runtimePresentation(f.element, f.resolution, sampleItem(1, 8888.88), 'Connected');
    const view = render(<RuntimeMonitoringView element={f.element} presentation={p} age="" />);
    expect(reading(edit)).toBeDefined(); expect(reading(edit)).toBe(reading(view));
    for (const html of [edit, view]) {
      expect(html.includes('overview-runtime-caption')).toBe(Boolean(caption));
      expect(plain(html)).toContain('8888.88'); expect(html).toContain('overview-runtime-unit');
      expect(html).not.toContain(f.definition.name); expect(html).not.toContain(f.definition.sourceId);
    }
  });
  it.each(['left', 'center', 'right'] as const)('alignment %s is shared by caption and flex reading', alignment => {
    const f = configuration(); f.element.style.alignment = alignment;
    const edit = render(<EditorMonitoring element={f.element} resolution={f.resolution} />);
    const view = render(<RuntimeMonitoringView element={f.element} presentation={runtimePresentation(f.element, f.resolution, sampleItem(), 'Connected')} age="" />);
    const style = /style="([^"]+)"/.exec(edit)?.[1]; expect(style).toBe(/style="([^"]+)"/.exec(view)?.[1]);
    expect(style).toContain({ left: 'flex-start', center: 'center', right: 'flex-end' }[alignment]);
    expect(css).toContain('justify-content: var(--reading-align, flex-start)');
  });
  it.each([8, 16, 48, 96])('font size %s and geometry survive JSON Save/View unchanged', fontSize => {
    const f = configuration(); f.element.style.fontSize = fontSize; f.element.rotation = 12;
    const original = JSON.stringify(f.element), saved = JSON.parse(original);
    const node = (mode: string) => render(<ElementNode {...({ data: { element: saved, mode, bindingResolution: f.resolution }, selected: false } as any)} />);
    for (const html of [node('EDIT'), node('VIEW')]) {
      expect(html).toContain(`font-size:${fontSize}px`); expect(html).toContain('width:144px;height:48px');
      expect(html).toContain('rotate(12deg)'); expect(html).toContain('overview-element--runtime');
    }
    expect(JSON.stringify(saved)).toBe(original);
    expect(css).toContain('.overview-runtime-reading'); expect(css).toContain('font-size: inherit; font-weight: 650');
    expect(readFileSync(new URL('../../styles/overview.css', import.meta.url), 'utf8')).toContain('font-family: var(--font-sans)');
  });
  it('same padding, line height, tabular value hierarchy, long-value overflow and Badge proportions', () => {
    const f = configuration(1, 'VALUE_BADGE'); f.element.style.text = '';
    for (const value of [8888.88, 1.123456789012345, 1e20]) {
      const html = render(<RuntimeMonitoringView element={f.element} presentation={runtimePresentation(f.element, f.resolution, sampleItem(1, value), 'Connected')} age="" />);
      expect(html).toContain('is-compact'); expect(html).toContain(String(value));
    }
    expect(render(<EditorMonitoring element={f.element} resolution={f.resolution} />)).toContain('is-compact');
    for (const contract of ['padding: 8px 30px 8px 10px', 'line-height: 1.15', 'text-overflow: ellipsis', 'tabular-nums', 'min-width: 0']) expect(css).toContain(contract);
    expect(css).not.toMatch(/is-editable[^}]*font|data-editor-preview[^}]*padding/);
  });
  it('Edit never invokes Runtime hooks; representative value and external chrome retain Binding', () => {
    const hooks = ['useOverviewRuntime', 'useRuntimeItem', 'useRuntimeClock', 'useRuntimeStatus'] as const;
    const spies = hooks.map(key => vi.spyOn(provider, key).mockImplementation(() => { throw new Error('Edit must not access Runtime'); }));
    try {
      for (const type of ['NUMERIC_LABEL', 'STATUS_LIGHT', 'VALUE_BADGE', 'TEXT_LABEL'] as const) {
        const f = configuration(1, type);
        const html = render(<ElementNode {...({ data: { element: f.element, mode: 'EDIT', bindingResolution: f.resolution }, selected: false } as any)} />);
        expect(html).toContain('EDITOR PREVIEW'); expect(html).toContain('BOUND'); expect(html).toContain('data-editor-preview="true"');
        expect(html).not.toContain('Runtime details:');
      }
      spies.forEach(spy => expect(spy).not.toHaveBeenCalled());
    } finally { spies.forEach(spy => spy.mockRestore()); }
    expect(css).toContain('.overview-editor-chrome { position: absolute; bottom: calc(100% + 2px)');
  });
  it('String preview remains unsupported rather than a fabricated process value', () => {
    const f = configuration(1, 'TEXT_LABEL'); f.element.style.text = 'Configured caption';
    const html = render(<EditorMonitoring element={f.element} resolution={f.resolution} />);
    expect(plain(html)).toBe('Configured caption—!Unsupported producer');
    expect(html).not.toContain('8888.88');
  });
});

describe('dev.13 Status Light presentation-only schema', () => {
  it('new default is Off; absent legacy setting retains visible text without migration', () => {
    const f = configuration(1, 'STATUS_LIGHT'); expect(f.element.style.showText).toBe(false);
    delete f.element.style.showText; const before = JSON.stringify(f.element);
    const html = render(<RuntimeMonitoringView element={f.element} presentation={runtimePresentation(f.element, f.resolution, sampleItem(1, false), 'Connected')} age="" />);
    expect(html).toContain('overview-runtime-number">FALSE'); expect(JSON.stringify(f.element)).toBe(before);
  });
  it.each([true, false])('Show Text %s round-trips without changing geometry or Binding', showText => {
    const f = configuration(1, 'STATUS_LIGHT'); f.element.style.showText = showText;
    const copy = JSON.parse(JSON.stringify(f.element));
    expect(validateOverviewElements({ id: 'page', layerOrder: [copy.id] }, [copy])).toEqual([]);
    expect(copy).toEqual(f.element); expect([copy.width, copy.height]).toEqual([48, 48]);
    const edit = render(<EditorMonitoring element={copy} resolution={f.resolution} />);
    expect(edit).toContain(showText ? 'overview-runtime-number">FALSE' : 'overview-runtime-sr">FALSE');
  });
  it.each([true, false])('TRUE/FALSE remain distinct with Show Text %s and accessible status', showText => {
    const f = configuration(1, 'STATUS_LIGHT'); f.element.style.text = ''; f.element.style.showText = showText;
    for (const value of [true, false]) {
      const html = render(<RuntimeMonitoringView element={f.element} presentation={runtimePresentation(f.element, f.resolution, sampleItem(1, value), 'Connected')} age="" />);
      expect(html).toContain(`lamp-${value}`); expect(html).toContain(value ? '●' : '−');
      expect(html).toContain(`aria-label="${value ? 'TRUE' : 'FALSE'}`);
      expect(html).toContain(`${showText ? 'overview-runtime-number' : 'overview-runtime-sr'}">${value ? 'TRUE' : 'FALSE'}`);
      expect(html).not.toMatch(/role="switch"|aria-pressed|<button|onClick|overview-runtime-caption/);
    }
  });
  it.each(['no sample', 'BAD', 'DISCONNECTED'] as const)('%s is not a FALSE lamp even when visible text is Off', state => {
    const f = configuration(1, 'STATUS_LIGHT'); const item = state === 'no sample' ? undefined : sampleItem(1, false, state);
    const html = render(<RuntimeMonitoringView element={f.element} presentation={runtimePresentation(f.element, f.resolution, item, 'Connected')} age="" />);
    expect(html).toContain('lamp-unavailable'); expect(html).toContain('>?</i>'); expect(html).not.toContain('lamp-false');
    expect(html).toContain(state === 'no sample' ? 'Awaiting data' : state === 'BAD' ? 'BAD sample' : 'Device disconnected');
  });
  it('only Status Light accepts a boolean Show Text property; no coercion or new control field', () => {
    for (const [type, value] of [['NUMERIC_LABEL', true], ['STATUS_LIGHT', 'false'], ['STATUS_LIGHT', 0]] as const) {
      const e = createOverviewElement(type, { id: 'e', x: 0, y: 0 }); (e.style as any).showText = value;
      expect(validateOverviewElements({ id: 'p', layerOrder: ['e'] }, [e])).toContain('Element e: Show Text must be a Status Light boolean');
      expect(e.controlState).toBeUndefined();
    }
  });
});
