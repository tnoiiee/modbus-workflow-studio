import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RuntimeDetails } from './RuntimeDetails.js';
import { OverviewRuntimeStatus } from './OverviewRuntimeStatus.js';
import { OverviewRuntimeProvider } from './OverviewRuntimeProvider.js';
import { configuration, harness, sampleItem } from '../../lib/overviewRuntimeFixtures.js';
import type { OverviewTransport } from '../../lib/overviewRuntimeStore.js';
import type { ClientTagItem } from '../../lib/tagDeliveryProtocol.js';
function render(item: ClientTagItem | undefined = sampleItem(1, 123.456789123), transport: OverviewTransport = 'Connected', error = '', enabled = true) {
  const f = configuration(), h = harness();
  if (item) h.store.publish([item], new Set([item.source.sourceId]));
  h.store.setStatus(transport, transport === 'Error' ? 'Recovery budget exhausted' : 'Latest received; catch-up not confirmed', 'page');
  const selection = { ...f.selection, error }, before = JSON.stringify([f.element, h.store.getItem(f.definition.sourceId)]);
  const wrap = (child: React.ReactNode) => renderToStaticMarkup(<OverviewRuntimeProvider adapter={h.adapter} enabled={enabled} pageId="page" selection={selection} elements={[f.element]} resolutions={{ [f.element.id]: f.resolution }}>{child}</OverviewRuntimeProvider>);
  const details = wrap(<RuntimeDetails element={f.element} resolution={f.resolution} onClose={() => {}} />);
  const page = wrap(<OverviewRuntimeStatus selection={selection} elements={[f.element]} />);
  expect(JSON.stringify([f.element, h.store.getItem(f.definition.sourceId)])).toBe(before);
  expect(h.io.snapshot).not.toHaveBeenCalled(); expect(h.io.socket).not.toHaveBeenCalled(); h.adapter.stop();
  return { details, page, normal: page.split('<details>')[0] };
}
describe('dev.13 Runtime Details hierarchy', () => {
  it('GOOD value is primary once, with historical duplicate demoted inside a native disclosure', () => {
    const { details } = render(); const beforeHistory = details.split('<details')[0];
    expect(beforeHistory.match(/123\.456789123/g)).toHaveLength(1);
    expect(beforeHistory).toContain('<strong>123.456789123 bar</strong>');
    expect(beforeHistory).not.toContain('Latest received sample — full precision (quality applies)');
    expect(details).toContain('<details class="overview-runtime-history"><summary>Historical Last-good — not current');
    expect(details.indexOf('Historical Last-good')).toBeGreaterThan(details.indexOf('Sample Quality and timestamps'));
  });
  it.each(['BAD', 'DISCONNECTED'] as const)('%s keeps failed/raw sample diagnostic and displayed last-good explicitly historical', quality => {
    const item = sampleItem(1, 999, quality); item.sample!.lastGoodValue = 12.25; item.reason = 'SYNTHETIC_READ_FAILURE';
    const { details } = render(item);
    expect(details).toContain('Last good — full precision'); expect(details).toContain('<strong>12.25 bar</strong>');
    expect(details).toContain('Latest received sample — full precision (quality applies)</dt><dd>999</dd>');
    expect(details).toContain(quality); expect(details).toContain('SYNTHETIC_READ_FAILURE');
    expect(details).toContain('historical, not current'); expect(details).not.toContain('<strong>999');
  });
  it('all diagnostics and clock-skew/suspension/safety limitations remain available', () => {
    const item = sampleItem(1, 123); item.sample!.receiveTimestamp = '2999-01-01T00:00:00.000Z';
    const { details } = render(item);
    for (const text of ['Source and Binding', 'SHARED_TAG', 'Source identity', 'BOUND', 'Producer availability', 'Sample quality', 'Reason', 'Receive timestamp (Server)', 'Source timestamp (Device)', 'Last GOOD receive timestamp', 'Age unavailable: clock skew', 'Browser transport', 'does not change Device quality', 'No replay-complete or exactly-once guarantee', 'clock skew or suspension', 'Close details']) expect(details).toContain(text);
  });
  it('browser recovery is separate from GOOD Device quality and marks cached data', () => {
    const { details } = render(sampleItem(1, 1), 'Reconnecting');
    expect(details).toContain('Cached · latest received'); expect(details).toContain('<dd>GOOD</dd>'); expect(details).toContain('Reconnecting');
  });
});
describe('dev.13 compact Page Runtime status', () => {
  it('normal summary keeps transport/count; safety accessible without dominating Canvas height', () => {
    const { normal, page } = render();
    expect(normal).toContain('Transport: Connected'); expect(normal).toContain('1 Tags');
    expect(normal).not.toMatch(/unavailable|stale|bad|Trusted network|catch-up/);
    expect(page).toContain('<summary>Runtime details &amp; safety</summary>');
    expect(page).toContain('Trusted network only'); expect(page).toContain('Origin policy is not authentication');
    expect(page).toContain('— Runtime details</button>');
  });
  it.each(['STALE', 'BAD', 'DISCONNECTED', 'UNCERTAIN'] as const)('nonzero %s health remains outside disclosure', quality => {
    const { normal } = render(sampleItem(1, 1, quality));
    expect(normal).toContain(quality === 'STALE' ? '1 stale' : quality === 'UNCERTAIN' ? '1 uncertain' : '1 unavailable');
    if (quality === 'BAD') expect(normal).toContain('1 bad'); else expect(normal).not.toContain('1 bad');
  });
  it.each(['Reconnecting', 'Resynchronizing', 'Error', 'Offline'] as const)('%s recovery/failure cannot be hidden by closed details', transport => {
    const { normal } = render(sampleItem(), transport);
    expect(normal).toContain('Transport: ' + transport); expect(normal).toContain('overview-runtime-callout');
    if (transport === 'Error') { expect(normal).toContain('Recovery budget exhausted'); expect(normal).toContain('Retry Runtime'); }
  });
  it.each(['Page exceeds 200 identities', 'Page exceeds 200 Elements', 'Snapshot exceeds 512 KiB'])('limit %s remains visible', error => {
    const { normal } = render(sampleItem(), 'Error', error, false); expect(normal).toContain(error);
  });
  it('disabled Runtime is explicit; no fake live transport', () => {
    const { normal } = render(sampleItem(), 'Disposed', '', false); expect(normal).toContain('Runtime disabled'); expect(normal).toContain('Transport: Disposed');
  });
});
