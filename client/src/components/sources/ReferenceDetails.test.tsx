import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ReferenceDetails } from './ReferenceDetails.js';
import { DefinitionTable } from './DataSourcesPage.js';
import type { SourceDefinition } from '../../lib/sourceDefinitions.js';
const definition: SourceDefinition = { sourceType: 'SHARED_TAG', sourceId: 'stable', name: 'Kiln pressure', unit: 'bar', description: '', dataType: 'Number', capability: 'MONITOR_ONLY', enabled: true };
const noop = vi.fn();
describe('dev.5 saved reference presentation', () => {
  it('shows readable Page/Element/type/direction and secondary ID without raw JSON', () => {
    const html = renderToStaticMarkup(<ReferenceDetails definition={definition} onClose={noop} onRetry={noop} state={{ data: {
      scope: 'SAVED_OVERVIEW_PAGES', pageCount: 1, bindingCount: 1, references: [{ pageId: 'p', pageName: 'Kiln overview', elementId: 'long-'.repeat(100), elementName: 'Outlet pressure', elementType: 'NUMERIC_LABEL', direction: 'MONITOR' }],
    } }} />);
    for (const text of ['Kiln overview', 'Outlet pressure', 'numeric label', 'MONITOR', 'Element ID', '1 binding across 1 Overview Page', 'Unsaved browser Drafts are excluded.', 'Close saved references']) expect(html).toContain(text);
    expect(html).toContain('aria-modal="false"'); expect(html).not.toContain('&quot;pageId&quot;');
  });
  it('displays empty, loading, error/retry and missing legacy direction clearly', () => {
    const render = (state: any) => renderToStaticMarkup(<ReferenceDetails definition={definition} state={state} onClose={noop} onRetry={noop} />);
    expect(render({ loading: true })).toContain('Loading saved references'); expect(render({ error: 'Unavailable' })).toContain('Retry reference details');
    expect(render({ data: { scope: 'SAVED_OVERVIEW_PAGES', pageCount: 0, bindingCount: 0, references: [] } })).toContain('No saved Elements');
    expect(render({ data: { scope: 'SAVED_OVERVIEW_PAGES', pageCount: 1, bindingCount: 1, references: [{ pageId: 'p', pageName: '', elementId: 'e', elementName: '', elementType: 'TEXT_LABEL' }] } })).toContain('Not specified (legacy)');
  });
  it.each([0, 1, 3])('exposes %s bindings by default; only non-zero counts are actions', count => {
    const html = renderToStaticMarkup(<DefinitionTable definitions={[definition]} workflows={[]} busy={false} references={{ 'SHARED_TAG:stable': { found: true, count, pageCount: count ? 1 : 0 } }} onReferences={noop} onEdit={noop} onToggle={noop} onDelete={noop} />);
    expect(html).toContain(count === 1 ? '1 binding' : `${count} bindings`);
    expect(html.includes('aria-haspopup="dialog"')).toBe(count > 0); expect(html).not.toContain('Check references');
  });
  it('a missing Definition is not presented as zero bindings', () => {
    const html = renderToStaticMarkup(<DefinitionTable definitions={[definition]} workflows={[]} busy={false} references={{ 'SHARED_TAG:stable': { found: false, count: 0 } }} onReferences={noop} onEdit={noop} onToggle={noop} onDelete={noop} />);
    expect(html).toContain('Definition unavailable'); expect(html).not.toContain('0 bindings');
  });
});
