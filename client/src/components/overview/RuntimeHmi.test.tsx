import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { RuntimeMonitoringView } from './RuntimeMonitoring.js';
import { RuntimeDetails } from './RuntimeDetails.js';
import { OverviewRuntimeStatus } from './OverviewRuntimeStatus.js';
import { OverviewRuntimeProvider } from './OverviewRuntimeProvider.js';
import { ElementNode } from './ElementNode.js';
import { runtimePresentation } from '../../lib/overviewRuntimePresentation.js';
import { configuration, sampleItem, harness, time } from '../../lib/overviewRuntimeFixtures.js';
import type { OverviewElementType } from '../../lib/overviewElements.js';
const visibleText = (html: string) => html.replace(/<[^>]*>/g, '');
function view(type: OverviewElementType = 'NUMERIC_LABEL', caption = '', value: number | boolean = 20) {
  const f = configuration(1, type); f.element.style.text = caption;
  const p = runtimePresentation(f.element, f.resolution, sampleItem(1, value), 'Connected');
  return { f, p, html: renderToStaticMarkup(<RuntimeMonitoringView element={f.element} presentation={p} age="12s since receive" onDetails={() => {}} />) };
}
describe('dev.12 HMI component presentation', () => {
  it('Numeric caption is secondary, value/Unit primary, with no permanent diagnostics', () => {
    const { html } = view('NUMERIC_LABEL', 'Boiler Temp'); const text = visibleText(html);
    expect(text).toContain('Boiler Temp'); expect(text).toContain('20'); expect(text).toContain('bar');
    expect(html.indexOf('overview-runtime-caption')).toBeLessThan(html.indexOf('overview-runtime-reading'));
    expect(text).not.toMatch(/BOUND|GOOD|Binding|SHARED_TAG|Snapshot|12s since receive|READ_OK/);
  });
  it.each(['', '   '])('empty Text %j does not invent caption from Element/Definition names', caption => {
    const { html, f } = view('NUMERIC_LABEL', caption); const text = visibleText(html);
    expect(html).not.toContain('overview-runtime-caption'); expect(text).not.toContain(f.element.name); expect(text).not.toContain(f.definition.name);
    expect(text).toBe('20barⓘ');
  });
  it('no Unit displays only the value, with optional Details action', () => {
    const { f, p } = view(); const html = renderToStaticMarkup(<RuntimeMonitoringView element={f.element} presentation={{ ...p, unit: '' }} age="" />);
    expect(visibleText(html)).toBe('20'); expect(html).not.toContain('overview-runtime-unit');
  });
  it.each([0, -20, 4.25, 1e20])('Number %s has fixed Element dimensions and full accessible precision', value => {
    const { f, p } = view('NUMERIC_LABEL', '', value); const before = JSON.stringify(f.element); Object.freeze(f.element);
    const html = renderToStaticMarkup(<RuntimeMonitoringView element={f.element} presentation={p} age="" />);
    expect(html).toContain(p.text); expect(html).toContain(p.fullValue); expect(JSON.stringify(f.element)).toBe(before); expect(html).not.toMatch(/width:|height:/);
  });
  it('STALE and disconnected states have one visible concise indication', () => {
    const f = configuration();
    for (const quality of ['STALE', 'DISCONNECTED'] as const) {
      const p = runtimePresentation(f.element, f.resolution, sampleItem(1, 20, quality), 'Connected');
      const text = visibleText(renderToStaticMarkup(<RuntimeMonitoringView element={f.element} presentation={p} age="12s since receive" />));
      if (quality === 'STALE') { expect(text.match(/STALE/g)).toHaveLength(1); expect(text).toContain('12s since receive'); }
      else { expect(text.match(/Device disconnected/g)).toHaveLength(1); expect(text).toContain('Last good'); expect(text).not.toContain('DISCONNECTED'); }
      expect(text).not.toContain('READ_OK');
    }
  });
  it.each([true, false])('Status Light %s is read-only, readable, and has no interaction on its indicator', value => {
    const { f, p } = view('STATUS_LIGHT', 'Burner Ready', value);
    const node = RuntimeMonitoringView({ element: f.element, presentation: p, age: '' });
    const html = renderToStaticMarkup(node); expect(html).toContain(value ? 'TRUE' : 'FALSE'); expect(html).toContain(value ? 'lamp-true' : 'lamp-false');
    expect(html).toContain('Read-only monitoring'); expect(html).not.toMatch(/role="switch"|aria-pressed|<button|aria-live/);
  });
  it('FALSE differs from no sample, BAD, disconnected and unsupported', () => {
    const f = configuration(1, 'STATUS_LIGHT');
    const empty = runtimePresentation(f.element, f.resolution, undefined, 'Connected'); expect(empty.text).toBe('—');
    expect(visibleText(renderToStaticMarkup(<RuntimeMonitoringView element={f.element} presentation={empty} age="" />))).not.toContain('FALSE');
    for (const quality of ['BAD', 'DISCONNECTED'] as const) {
      const p = runtimePresentation(f.element, f.resolution, sampleItem(1, false, quality), 'Connected');
      const html = renderToStaticMarkup(<RuntimeMonitoringView element={f.element} presentation={p} age="" />);
      expect(html).toContain('Last good'); expect(html).toContain('lamp-unavailable'); expect(html).not.toContain('lamp-false');
    }
  });
  it.each([4.25, false, true])('Value Badge %s is compact without conversion', value => {
    const f = configuration(1, 'VALUE_BADGE');
    if (typeof value === 'boolean') { f.definition.dataType = 'Boolean'; f.element.binding.dataType = 'Boolean'; }
    f.element.style.text = 'Pressure';
    const p = runtimePresentation(f.element, { ...f.resolution, definition: f.definition }, sampleItem(1, value), 'Connected');
    const html = renderToStaticMarkup(<RuntimeMonitoringView element={f.element} presentation={p} age="" />);
    expect(html).toContain('is-compact'); expect(visibleText(html)).toContain(typeof value === 'boolean' ? value ? 'TRUE' : 'FALSE' : '4.25');
  });
  it('unsupported String has caption plus placeholder, not fabricated process text or MISSING', () => {
    const f = configuration(1, 'TEXT_LABEL'); f.element.style.text = 'Operator caption';
    const p = runtimePresentation(f.element, f.resolution, undefined, 'Connected');
    const text = visibleText(renderToStaticMarkup(<RuntimeMonitoringView element={f.element} presentation={p} age="" />));
    expect(text.match(/Operator caption/g)).toHaveLength(1); expect(text).toContain('—'); expect(text).toContain('Unsupported producer'); expect(text).not.toContain('MISSING');
  });
  it('micro Element retains full accessible value/status and keyboard Details button', () => {
    const { f, p } = view('NUMERIC_LABEL', 'Very long configured caption', 1.123456789); f.element.width = 24; f.element.height = 24;
    const open = vi.fn(), stop = vi.fn(), tree = RuntimeMonitoringView({ element: f.element, presentation: p, age: '', onDetails: open });
    const button = (tree.props.children as any[]).find(child => child?.type === 'button');
    expect(button.props.type).toBe('button'); expect(button.props['aria-label']).toContain('Runtime details:');
    button.props.onClick({ stopPropagation: stop }); expect(open).toHaveBeenCalledTimes(1); expect(stop).toHaveBeenCalledTimes(1);
    const html = renderToStaticMarkup(tree); expect(html).toContain('is-micro'); expect(html).toContain('1.123456789'); expect(html).not.toContain('tabindex="-1"');
  });
  it('long caption/value are escaped, full text accessible and samples never aria-live', () => {
    const { html } = view('NUMERIC_LABEL', '<script>' + 'caption '.repeat(50), 1.123456789);
    expect(html).not.toContain('<script>'); expect(html).toContain('…'); expect(html).toContain('1.123456789'); expect(html).not.toContain('aria-live');
  });
  it('Edit preserves configuration preview/BOUND; View removes Binding diagnostics', () => {
    const { f } = view('NUMERIC_LABEL', 'Boiler'); const make = (mode: string) => renderToStaticMarkup(<ElementNode {...({ data: { element: f.element, mode, bindingResolution: f.resolution }, selected: false } as any)} />);
    const edit = make('EDIT'), runtime = make('VIEW');
    expect(edit).toContain('Editor Preview'); expect(edit).toContain('BOUND'); expect(edit).not.toContain('overview-runtime-value');
    expect(runtime).toContain('overview-runtime-value'); expect(runtime).not.toContain('Binding:'); expect(runtime).not.toContain('overview-element__resolution');
  });
});

describe('dev.12 on-demand diagnostics and Page-level status', () => {
  function render(quality: 'GOOD' | 'STALE' | 'BAD' = 'GOOD', transport: 'Connected' | 'Error' | 'Disposed' = 'Connected', enabled = true, error = '') {
    const f = configuration(), h = harness(), item = sampleItem(1, 1.123456789, quality); item.sample!.lastGoodValue = 0; item.reason = 'INTERNAL_REASON';
    h.store.publish([item], new Set([item.source.sourceId])); h.store.setStatus(transport, transport === 'Error' ? 'Recovery budget exhausted' : 'Latest received only', 'page');
    const before = JSON.stringify([h.store.getItem(item.source.sourceId), f.element]);
    const html = renderToStaticMarkup(<OverviewRuntimeProvider adapter={h.adapter} enabled={enabled} pageId="page" selection={{ ...f.selection, error }} elements={[f.element]} resolutions={{ [f.element.id]: f.resolution }}><OverviewRuntimeStatus selection={{ ...f.selection, error }} elements={[f.element]} /><RuntimeDetails element={f.element} resolution={f.resolution} onClose={() => {}} /></OverviewRuntimeProvider>);
    expect(JSON.stringify([h.store.getItem(item.source.sourceId), f.element])).toBe(before); expect(h.io.snapshot).not.toHaveBeenCalled(); expect(h.io.socket).not.toHaveBeenCalled(); h.adapter.stop(); return html;
  }
  it('Details retain full precision, identity, Binding, quality, reason and all timestamps plus last-good value', () => {
    const html = render('BAD');
    for (const text of ['Source identity', 'SHARED_TAG', 'BOUND', 'Producer availability', 'Browser transport', '1.123456789', 'Last-good value', '<dd>0</dd>', 'BAD', 'INTERNAL_REASON', time, 'Source timestamp', 'Not supplied by Device', 'Last GOOD receive timestamp', 'Age of displayed value', 'clock skew', 'No replay-complete', 'role="dialog"', 'Close details']) expect(html).toContain(text);
  });
  it('healthy Page header is compact with active Tag count, trust boundary and small-Element access', () => {
    const html = render(), header = html.slice(0, html.indexOf('<details>'));
    expect(header).toContain('Transport: Connected'); expect(header).toContain('1 Tags'); expect(header).toContain('Trusted network only'); expect(header).not.toContain('unavailable'); expect(header).not.toContain('Latest received only');
    expect(html).toContain('Runtime details &amp; safety'); expect(html).toContain('— Runtime details'); expect(html).toContain('authenticated reverse proxy');
  });
  it('Page exposes nonzero stale/unavailable counts without per-sample announcements', () => {
    expect(render('STALE')).toContain('1 stale'); expect(render('BAD')).toContain('1 unavailable');
    const source = readFileSync(new URL('./OverviewRuntimeStatus.tsx', import.meta.url), 'utf8');
    expect(source).toContain('useRuntimeClock(context.adapter)'); expect(source).not.toContain('subscribeItem'); expect(source).toContain('500)');
  });
  it('failure, limits and disabled state remain outside the disclosure', () => {
    expect(render('GOOD', 'Error').split('<details>')[0]).toContain('Recovery budget exhausted');
    expect(render('GOOD', 'Disposed', false).split('<details>')[0]).toContain('Runtime disabled');
    expect(render('GOOD', 'Error', false, 'Page exceeds 200 identities').split('<details>')[0]).toContain('Page exceeds 200 identities');
  });
  it('Runtime CSS stays scoped and protects fixed layout, control warnings, focus and reduced motion', () => {
    const css = readFileSync(new URL('../../styles/overview-runtime.css', import.meta.url), 'utf8');
    for (const text of ['tabular-nums', 'text-overflow: ellipsis', 'min-width: 0', 'box-sizing: border-box', 'focus-visible', 'prefers-reduced-motion', '.overview-control-runtime-warning { display: block']) expect(css).toContain(text);
    expect(css).not.toMatch(/\.react-flow|savedViewport|transition: all|animation:.*infinite/);
    const node = readFileSync(new URL('./ElementNode.tsx', import.meta.url), 'utf8'); expect(node).toContain('width: element.width'); expect(node).toContain('height: element.height');
  });
});
