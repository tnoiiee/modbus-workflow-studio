import { AcquisitionMappingEditor } from './AcquisitionMappingEditor.js';
import { bindingCountLabel, loadReferenceCounts, type ReferenceCountState } from '../../lib/definitionReferences.js';
import { ReferenceDetails, type ReferenceDetailsState } from './ReferenceDetails.js';
import type { DefinitionReferenceSummary } from '../../lib/overviewApi.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, RefreshCw, Search, ChevronRight } from 'lucide-react';
import { DefinitionCatalogEditor } from '../overview/DefinitionCatalogEditor.js';
import { DeleteDefinitionDialog } from './DeleteDefinitionDialog.js';
import { fetchDefinitionWorkflows, fetchSourceDefinitions, fetchDefinitionReferences, updateSourceDefinition } from '../../lib/overviewApi.js';
import { definitionId, definitionIdentity, type DefinitionWorkflow, type SourceDefinition } from '../../lib/sourceDefinitions.js';
import { definitionKey, filterDefinitions, type SourceTypeFilter, type DefinitionStatusFilter } from '../../lib/definitionList.js';

type ReferenceState = ReferenceCountState;
export function DefinitionTable({ definitions, workflows, busy, references, onEdit, onToggle, onDelete, onReferences, onRetryReferences, openReferenceKey, onAcquisition }: {
  onAcquisition?: (definition: Extract<SourceDefinition, { sourceType: 'SHARED_TAG' }>) => void;
  definitions: readonly SourceDefinition[]; workflows: readonly DefinitionWorkflow[]; busy: boolean;
  references: Readonly<Record<string, ReferenceState>>;
  onEdit: (definition: SourceDefinition) => void; onToggle: (definition: SourceDefinition) => void;
  onDelete: (definition: SourceDefinition) => void; onReferences: (definition: SourceDefinition, invoker?: HTMLButtonElement) => void; onRetryReferences?: () => void; openReferenceKey?: string;
}) {
  return <div className="table-scroll"><table className="definition-table" role="table">
    <caption className="sr-only">Configuration definitions. Stable IDs are available in each row.</caption>
    <thead role="rowgroup"><tr role="row">{['Definition', 'Source / Workflow', 'Data type', 'Capability', 'Unit', 'Status', 'Saved references', 'Actions'].map(label => <th key={label} scope="col" role="columnheader">{label}</th>)}</tr></thead>
    <tbody role="rowgroup">{definitions.map(definition => {
      const key = definitionKey(definition), reference = references[key];
      return <tr key={key} role="row">
        <th scope="row" role="rowheader"><span className="definition-name">{definition.name}</span>
          {definition.description && <span className="definition-description">{definition.description}</span>}
          <details className="definition-identity"><summary>Stable ID</summary><code>{definitionId(definition)}</code></details>
        </th>
        <td role="cell" data-label="Source / Workflow"><span className="definition-source-type">{definition.sourceType}</span>{definition.sourceType === 'WORKFLOW_VARIABLE' && <span className="definition-owner">{workflows.find(workflow => workflow.id === definition.workflowId)?.name ?? definition.workflowId}</span>}</td>
        <td role="cell" data-label="Data type">{definition.dataType}</td><td role="cell" data-label="Capability" className="definition-capability">{definition.capability}</td><td role="cell" data-label="Unit">{definition.unit || '—'}</td>
        <td role="cell" data-label="Status"><span className={`definition-status${definition.enabled ? ' is-enabled' : ''}`}>{definition.enabled ? 'Enabled' : 'Disabled'}</span></td>
        <td role="cell" data-label="Saved references">
          {reference?.error ? <span className="definition-reference-error"><span role="status">Counts unavailable</span><button type="button" onClick={onRetryReferences} aria-label="Retry reference counts">Retry</button></span>
            : reference?.found === false ? <span role="status">Definition unavailable</span>
            : !reference || reference.loading || reference.count === undefined ? <span className="definition-reference-loading" role="status">Loading references…</span>
            : reference.count === 0 ? <span className="definition-reference-zero">0 bindings</span>
            : <button className="definition-reference" type="button" disabled={busy} onClick={event => onReferences(definition, event.currentTarget)}
              aria-label={`View ${bindingCountLabel(reference.count)} for ${definition.name}`} aria-haspopup="dialog" aria-expanded={openReferenceKey === key}>
              {bindingCountLabel(reference.count)}<ChevronRight size={13} aria-hidden="true" /></button>}
        </td>
        <td role="cell" data-label="Actions" className="definition-actions-cell"><div className="definition-row-actions">
          <button type="button" disabled={busy} onClick={() => onEdit(definition)} aria-label={`Edit ${definition.name}`}>Edit</button>
          <button type="button" disabled={busy} onClick={() => onToggle(definition)} aria-label={`${definition.enabled ? 'Disable' : 'Enable'} ${definition.name}`}>{definition.enabled ? 'Disable' : 'Enable'}</button>
          {definition.sourceType === 'SHARED_TAG' && onAcquisition && <button type="button" disabled={busy} onClick={() => onAcquisition(definition)} aria-label={`Configure acquisition for ${definition.name}`}>Acquisition</button>}
          <button type="button" className="definition-delete" disabled={busy} onClick={() => onDelete(definition)} aria-label={`Delete ${definition.name}`}>Delete</button>
        </div></td>
      </tr>;
    })}</tbody>
  </table></div>;
}

/** Configuration-only page. No Overview state, Runtime transport or command path. */
export function DataSourcesPage() {
  const [definitions, setDefinitions] = useState<SourceDefinition[]>([]);
  const [workflows, setWorkflows] = useState<DefinitionWorkflow[]>([]);
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [sourceType, setSourceType] = useState<SourceTypeFilter>('ALL');
  const [status, setStatus] = useState<DefinitionStatusFilter>('ALL');
  const [editor, setEditor] = useState<{ definition?: SourceDefinition }>();
  const [acquisition, setAcquisition] = useState<Extract<SourceDefinition, { sourceType: 'SHARED_TAG' }>>();
  const [deleting, setDeleting] = useState<SourceDefinition>();
  const [pending, setPending] = useState(false);
  const [references, setReferences] = useState<Record<string, ReferenceState>>({});
  const generation = useRef(0), inFlight = useRef(false);
  const referenceRequests = useRef(new Set<string>());
  const detailCache = useRef(new Map<string, DefinitionReferenceSummary>());
  const [referenceSource, setReferenceSource] = useState<SourceDefinition>();
  const [referenceDetails, setReferenceDetails] = useState<Record<string, ReferenceDetailsState>>({});
  const referenceInvoker = useRef<HTMLButtonElement | null>(null);
  const createRef = useRef<HTMLButtonElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  // Modal normally restores its invoker. A renamed/filtered-out row may no longer
  // exist after refresh; return to a usable catalog control instead of the body.
  const restoreDialogFocus = () => {
    globalThis.requestAnimationFrame?.(() => {
      if (document.activeElement && document.activeElement !== document.body) return;
      if (createRef.current && !createRef.current.disabled) createRef.current.focus();
      else toolbarRef.current?.focus();
    });
  };
  const closeEditor = () => { setEditor(undefined); restoreDialogFocus(); };
  const closeDelete = () => { setDeleting(undefined); restoreDialogFocus(); };

  const closeReferences = () => {
    setReferenceSource(undefined);
    globalThis.requestAnimationFrame?.(() => {
      const invoker = referenceInvoker.current;
      if (invoker?.isConnected && !invoker.disabled) invoker.focus({ preventScroll: true });
      else toolbarRef.current?.focus({ preventScroll: true });
    });
  };

  const refresh = useCallback(async () => {
    const request = ++generation.current;
    setAvailable(false); setError('');
    setReferences(previous => Object.fromEntries(Object.keys(previous).map(key => [key, { loading: true }])));
    referenceRequests.current.clear(); detailCache.current.clear(); setReferenceDetails({});
    if (typeof document !== 'undefined' && document.activeElement?.closest?.('[data-reference-details]')) closeReferences();
    else setReferenceSource(undefined);
    try {
      const [sources, owners] = await Promise.all([fetchSourceDefinitions(), fetchDefinitionWorkflows()]);
      if (request !== generation.current) return;
      setDefinitions(sources); setWorkflows(owners); setAvailable(true);
      void loadReferenceCounts(sources, () => request === generation.current, counts => {
        // A details read may be newer than an earlier batch while later batches load.
        for (const [key, impact] of detailCache.current) if (counts[key]) counts[key] = { found: true, count: impact.bindingCount, pageCount: impact.pageCount };
        setReferences(counts);
      });
    } catch (cause) {
      if (request === generation.current) {
        setError(cause instanceof Error ? cause.message : 'Unable to load Data Sources');
        setReferences(previous => Object.fromEntries(Object.keys(previous).map(key => [key, { error: 'Counts unavailable' }])));
      }
    }
  }, []);
  useEffect(() => {
    void refresh();
    const focus = () => { if (!inFlight.current) void refresh(); };
    window.addEventListener('focus', focus);
    return () => { ++generation.current; window.removeEventListener('focus', focus); };
  }, [refresh]);
  const toggle = async (definition: SourceDefinition) => {
    if (inFlight.current || !available) return;
    inFlight.current = true; setPending(true); setError(''); setNotice('');
    try {
      await updateSourceDefinition(definition, { enabled: !definition.enabled });
      await refresh(); setNotice(`${definition.name} ${definition.enabled ? 'disabled' : 'enabled'}. Overview bindings are unchanged.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to update definition'); }
    finally { inFlight.current = false; setPending(false); }
  };
  const inspectReferences = async (definition: SourceDefinition, invoker?: HTMLButtonElement, retry = false) => {
    const key = definitionKey(definition), request = generation.current;
    if (!available) return;
    if (invoker) referenceInvoker.current = invoker;
    setReferenceSource(definition);
    const cached = detailCache.current.get(key);
    if (cached && !retry) { setReferenceDetails(previous => ({ ...previous, [key]: { data: cached } })); return; }
    if (referenceRequests.current.has(key)) return;
    referenceRequests.current.add(key); setReferenceDetails(previous => ({ ...previous, [key]: { loading: true } }));
    try {
      const impact = await fetchDefinitionReferences(definitionIdentity(definition));
      if (request !== generation.current) return;
      detailCache.current.set(key, impact);
      setReferenceDetails(previous => ({ ...previous, [key]: { data: impact } }));
      setReferences(previous => ({ ...previous, [key]: { found: true, count: impact.bindingCount, pageCount: impact.pageCount } }));
    } catch {
      if (request === generation.current) setReferenceDetails(previous => ({ ...previous, [key]: { error: 'Unable to load saved references. The Definition may no longer be available.' } }));
    } finally { if (request === generation.current) referenceRequests.current.delete(key); }
  };
  const filtered = useMemo(() => filterDefinitions(definitions, workflows, query, sourceType, status), [definitions, workflows, query, sourceType, status]);
  const resetFilters = () => { setQuery(''); setSourceType('ALL'); setStatus('ALL'); };
  return <section className="data-sources-page" aria-label="Data Sources">
    <h2 className="sr-only">Definition catalog</h2>
    <div ref={toolbarRef} tabIndex={-1} className="data-sources-toolbar" role="region" aria-label="Definition toolbar">
      <div className="definition-type-filter" role="group" aria-label="Source type filter">{(['ALL', 'WORKFLOW_VARIABLE', 'SHARED_TAG'] as const).map(type => <button key={type} type="button" aria-pressed={sourceType === type} onClick={() => setSourceType(type)}>{type === 'ALL' ? 'All Sources' : type === 'WORKFLOW_VARIABLE' ? 'Workflow Variables' : 'Shared Tags'}</button>)}</div>
      <label className="definition-search"><span className="sr-only">Search definitions</span><Search size={15} aria-hidden="true" /><input type="search" aria-label="Search definitions" placeholder="Search name, Stable ID or Workflow" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <label className="definition-status-filter">Status<select aria-label="Definition status filter" value={status} onChange={event => setStatus(event.target.value as DefinitionStatusFilter)}><option value="ALL">All</option><option value="ENABLED">Enabled</option><option value="DISABLED">Disabled</option></select></label>
      <div className="data-sources-actions"><button type="button" className="btn" aria-label="Refresh definitions" disabled={pending || (!available && !error)} onClick={() => void refresh()}><RefreshCw size={14} aria-hidden="true" /> Refresh</button>
        <button ref={createRef} type="button" className="btn btn--primary" aria-label="Create Definition" disabled={!available || pending} onClick={() => setEditor({})}><Plus size={15} aria-hidden="true" /> Create Definition</button></div>
    </div>
    <aside className="data-sources-info" aria-label="Configuration only"><strong>Configuration only</strong><span>Definitions are configuration metadata. No runtime values or commands are enabled.</span></aside>
    {error && <div className="data-sources-feedback" role="alert"><strong>Could not complete the request</strong><p>{error}</p><button type="button" disabled={pending} onClick={() => void refresh()}>Retry loading definitions</button></div>}
    <p className="data-sources-summary" role="status" aria-live="polite">{!available && !error ? 'Loading definitions…' : pending ? 'Updating definition…' : notice || `${filtered.length} of ${definitions.length} definitions`}</p>
    {filtered.length > 0 && <DefinitionTable onAcquisition={setAcquisition} definitions={filtered} workflows={workflows} busy={!available || pending} references={references} onEdit={definition => setEditor({ definition })} onToggle={definition => void toggle(definition)} onDelete={setDeleting} onReferences={(definition, invoker) => void inspectReferences(definition, invoker)} onRetryReferences={() => void refresh()} openReferenceKey={referenceSource ? definitionKey(referenceSource) : undefined} />}
    {available && filtered.length === 0 && <div className="data-sources-empty"><h3>{definitions.length ? 'No matching definitions' : 'No Source definitions yet'}</h3>
      <p>{definitions.length ? 'Try a different search or clear the filters.' : 'Create a shared tag or workflow variable to configure stable Overview bindings.'}</p>
      {definitions.length ? <button type="button" onClick={resetFilters}>Clear filters</button> : <button type="button" className="btn btn--primary" onClick={() => setEditor({})}>Create your first definition</button>}</div>}
    <p className="data-sources-footnote">Reference counts cover saved Overview Pages only; unsaved browser Drafts are excluded. Counts load automatically and refresh with the catalog; they are not live Runtime values. Delete always requires confirmation.</p>
    {referenceSource && <ReferenceDetails definition={referenceSource} state={referenceDetails[definitionKey(referenceSource)]} onClose={closeReferences} onRetry={() => void inspectReferences(referenceSource, undefined, true)} />}
    {acquisition && <AcquisitionMappingEditor key={acquisition.sourceId} definition={acquisition} onClose={() => { setAcquisition(undefined); restoreDialogFocus(); }} />}
    {editor && <DefinitionCatalogEditor initialDefinition={editor.definition} initialSourceType={sourceType === 'ALL' ? 'SHARED_TAG' : sourceType} definitions={definitions} workflows={workflows} available={available} onClose={closeEditor} onChanged={async () => { await refresh(); setNotice('Definition saved. Overview Draft and Page revision are unchanged.'); }} />}
    {deleting && <DeleteDefinitionDialog definition={deleting} onClose={closeDelete} onDeleted={() => {
      setDeleting(undefined); setNotice('Definition deleted. Stored bindings are unchanged and resolve as MISSING after refresh.');
      void refresh().then(() => createRef.current?.focus());
    }} />}
  </section>;
}
