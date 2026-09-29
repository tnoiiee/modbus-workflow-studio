import { AppShell } from '../shell/AppShell.js';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DataSourcesPage } from './DataSourcesPage.js';
import { DeleteDefinitionDialog, DefinitionImpact } from './DeleteDefinitionDialog.js';
import { DefinitionCatalogEditor } from '../overview/DefinitionCatalogEditor.js';
import { Sidebar, NAV_PAGE_IDS } from '../shell/Sidebar.js';
import type { SourceDefinition } from '../../lib/sourceDefinitions.js';
const id = '11111111-1111-4111-8111-111111111111';
const source: SourceDefinition = { sourceType: 'SHARED_TAG', sourceId: id, name: 'Temperature', dataType: 'Number', capability: 'MONITOR_ONLY', enabled: true, unit: 'C', description: 'Test metadata' };
const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8');
const noop = () => {};
describe('O2-A punchlist Data Sources page and Delete UI', () => {
  it('Data Sources is a first-class sidebar page with active state', () => {
    expect(NAV_PAGE_IDS).toContain('Data Sources');
    const html = renderToStaticMarkup(<Sidebar page="Data Sources" onNavigate={noop} />);
    expect(html).toContain('aria-current="page" title="Data Sources"');
  });
  it('configuration management page is accessible without Overview Edit', () => {
    const html = renderToStaticMarkup(<DataSourcesPage />);
    expect(html).toContain('aria-label="Data Sources"');
    expect(html).toContain('Workflow Variables'); expect(html).toContain('Shared Tags');
    expect(html).toContain('Configuration only'); expect(html).toContain('No runtime values or commands are enabled.');
    const app = read('../../App.tsx');
    expect(app).toContain("{page==='Data Sources'&&<DataSourcesPage/>}");
    expect(app).toContain("onOpenDataSources={()=>setPage('Data Sources')}");
    const page = read('../overview/OverviewPage.tsx');
    expect(page).toContain('onClick={onOpenDataSources}>Data Sources');
    expect(page).not.toContain('setCatalogOpen');
  });
  it.each(['SHARED_TAG', 'WORKFLOW_VARIABLE'] as const)('editor opens existing %s metadata without enabling identity edits', sourceType => {
    const definition: SourceDefinition = sourceType === 'SHARED_TAG' ? source : { ...source, sourceType, workflowId: id, variableId: id };
    const html = renderToStaticMarkup(<DefinitionCatalogEditor initialDefinition={definition} definitions={[definition]} workflows={[{ id, name: 'Workflow' }]} available onClose={noop} onChanged={async () => {}} />);
    expect(html).toContain('Save metadata'); expect(html).toContain('value="Temperature"'); expect(html).toContain('readonly=""');
    expect(html).toContain('Disable'); expect(html).toContain('disabled=""');
  });
  it('reference summary includes saved page/element counts, identities and unsaved-Draft caveat', () => {
    const html = renderToStaticMarkup(<DefinitionImpact impact={{ scope: 'SAVED_OVERVIEW_PAGES', pageCount: 1, bindingCount: 2,
      references: [{ pageId: id, pageName: 'Overview A', elementId: 'e1', elementName: 'Temperature', elementType: 'NUMERIC_LABEL' },
        { pageId: id, pageName: 'Overview A', elementId: 'e2', elementName: 'Badge', elementType: 'VALUE_BADGE' }] }} />);
    for (const label of ['2 saved binding(s)', '1 Overview page(s)', 'Overview A', 'e1', 'e2', 'unsaved browser Drafts', 'MISSING', 'identity unchanged']) expect(html).toContain(label);
  });
  it('Delete needs explicit confirmation; loading/error impact cannot authorize deletion', () => {
    const html = renderToStaticMarkup(<DeleteDefinitionDialog definition={source} onClose={noop} onDeleted={noop} />);
    expect(html).toContain('Delete Source definition'); expect(html).toContain('Keep definition');
    expect(html).toContain('Loading saved reference impact'); expect(html).toContain('disabled=""');
    const dialog = read('./DeleteDefinitionDialog.tsx');
    expect(dialog).toContain('disabled={loading || !impact || pending}');
    expect(dialog).toContain('if (!impact || loading || inFlight.current) return');
    expect(dialog).toContain('onClick={onClose} disabled={pending}>Keep definition');
    expect(dialog).toContain('await deleteSourceDefinition(definitionIdentity(definition))');
    expect(dialog).not.toMatch(/updateOverviewPage|tagName\s*===|setDraft|setHistory/);
  });
  it('first-class page and Delete are configuration only, without polling or command paths', () => {
    for (const file of ['./DataSourcesPage.tsx', './DeleteDefinitionDialog.tsx']) {
      expect(read(file)).not.toMatch(/setInterval|WebSocket|mqtt|manual-trigger|\/runtime|\/run|\/stop|\/write/);
    }
  });
});

describe('dev.4 Data Sources workspace presentation', () => {
  it('uses one full shell title/description and keeps Refresh/Create out of its header', () => {
    const app = read('../../App.tsx');
    const context = app.match(/context=\{page==='Data Sources'\?'([^']+)'/)?.[1];
    expect(context).toBe('Manage configuration definitions for Workflow Variables and Shared Tags.');
    const html = renderToStaticMarkup(<AppShell page="Data Sources" title="Data Sources" context={context} connectionState="UNKNOWN" onNavigate={noop}><DataSourcesPage /></AppShell>);
    const header = html.slice(html.indexOf('<header'), html.indexOf('</header>'));
    expect(header).toContain('<h1 class="page-header__title">Data Sources</h1>'); expect(header).toContain(context!);
    expect(header).not.toMatch(/Refresh|Create Definition|runtime values|WORKFLOW_VARIABLE/);
    expect(html).toContain('app-shell--data-sources');
  });
  it('places source group, accessible search/status and Refresh/Create together in keyboard DOM order', () => {
    const html = renderToStaticMarkup(<DataSourcesPage />);
    const names = ['Definition toolbar', 'Source type filter', 'All Sources', 'Workflow Variables', 'Shared Tags', 'Search definitions', 'Definition status filter', 'Refresh definitions', 'Create Definition'];
    const positions = names.map(name => html.indexOf(name));
    expect(positions.every(position => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(html).toContain('type="search" aria-label="Search definitions"');
    expect(html).toContain('aria-label="Configuration only"');
    expect(html).toContain('No runtime values or commands are enabled.');
    expect(html).not.toContain('data-sources-heading');
  });
  it('scopes wrapping/auto-height to Data Sources, visually hides only redundant labels, preserves focus and row detail semantics', () => {
    const css = read('../../styles/overview.css');
    expect(css).toContain('.app-shell--data-sources .app-main { grid-template-rows: auto minmax(0, 1fr); }');
    expect(css).toMatch(/\.app-shell--data-sources \.page-header__context\s*\{[^}]*white-space:\s*normal;[^}]*overflow:\s*visible;/s);
    expect(css).toMatch(/\.data-sources-page \.sr-only\s*\{[^}]*clip-path:\s*inset\(50%\)/s);
    expect(css).toMatch(/\.data-sources-page \.data-sources-toolbar\s*\{[^}]*flex-wrap:\s*wrap/s);
    expect(css).toContain('content: attr(data-label)'); expect(css).toContain('.data-sources-page .definition-delete');
    expect(css).toContain(':focus-visible'); expect(css).not.toMatch(/\.definition-status\s*\{[^}]*(?:display:\s*none|visibility:\s*hidden)/s);
    const shell = renderToStaticMarkup(<AppShell page="Workflow" title="Workflow" onNavigate={noop} connectionState="UNKNOWN">Workflow</AppShell>);
    expect(shell).not.toContain('app-shell--data-sources');
  });
});
