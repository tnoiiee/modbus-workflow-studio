import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, RefreshCw, Search } from 'lucide-react';
import { DefinitionCatalogEditor } from '../overview/DefinitionCatalogEditor.js';
import { DeleteDefinitionDialog } from './DeleteDefinitionDialog.js';
import { fetchDefinitionWorkflows, fetchSourceDefinitions, fetchDefinitionReferences, updateSourceDefinition } from '../../lib/overviewApi.js';
import { definitionId, definitionIdentity, type DefinitionWorkflow, type SourceDefinition } from '../../lib/sourceDefinitions.js';
import { definitionKey, filterDefinitions, type SourceTypeFilter, type DefinitionStatusFilter } from '../../lib/definitionList.js';

type ReferenceState = { count?: number; loading?: boolean; error?: string };
export function DefinitionTable({ definitions, workflows, busy, references, onEdit, onToggle, onDelete, onReferences }: {
  definitions: readonly SourceDefinition[]; workflows: readonly DefinitionWorkflow[]; busy: boolean;
  references: Readonly<Record<string, ReferenceState>>;
  onEdit: (definition: SourceDefinition) => void; onToggle: (definition: SourceDefinition) => void;
  onDelete: (definition: SourceDefinition) => void; onReferences: (definition: SourceDefinition) => void;
}) {
  return <div className="table-scroll"><table className="definition-table">
    <caption className="sr-only">Configuration definitions. Stable IDs are available in each row.</caption>
    <thead><tr>{['Definition', 'Source / Workflow', 'Data type', 'Capability', 'Unit', 'Status', 'Saved references', 'Actions'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
    <tbody>{definitions.map(definition => {
      const key = definitionKey(definition), reference = references[key];
      return <tr key={key}>
        <th scope="row"><span className="definition-name">{definition.name}</span>
          {definition.description && <span className="definition-description">{definition.description}</span>}
          <details className="definition-identity"><summary>Stable ID</summary><code>{definitionId(definition)}</code></details>
        </th>
        <td><span className="definition-source-type">{definition.sourceType}</span>{definition.sourceType === 'WORKFLOW_VARIABLE' && <span className="definition-owner">{workflows.find(workflow => workflow.id === definition.workflowId)?.name ?? definition.workflowId}</span>}</td>
        <td>{definition.dataType}</td><td className="definition-capability">{definition.capability}</td><td>{definition.unit || '—'}</td>
        <td><span className={`definition-status${definition.enabled ? ' is-enabled' : ''}`}>{definition.enabled ? 'Enabled' : 'Disabled'}</span></td>
        <td><button className="definition-reference" type="button" disabled={busy || reference?.loading} onClick={() => onReferences(definition)} aria-label={`Check saved references for ${definition.name}`}>
          {reference?.loading ? 'Checking…' : reference?.count !== undefined ? `${reference.count} binding(s)` : 'Check references'}</button>
          {reference?.error && <small role="alert">{reference.error} — retry above</small>}</td>
        <td><div className="definition-row-actions">
          <button type="button" disabled={busy} onClick={() => onEdit(definition)} aria-label={`Edit ${definition.name}`}>Edit</button>
          <button type="button" disabled={busy} onClick={() => onToggle(definition)} aria-label={`${definition.enabled ? 'Disable' : 'Enable'} ${definition.name}`}>{definition.enabled ? 'Disable' : 'Enable'}</button>
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
  const [deleting, setDeleting] = useState<SourceDefinition>();
  const [pending, setPending] = useState(false);
  const [references, setReferences] = useState<Record<string, ReferenceState>>({});
  const generation = useRef(0), inFlight = useRef(false);
  const referenceRequests = useRef(new Set<string>());
  const createRef = useRef<HTMLButtonElement>(null);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    setAvailable(false); setError(''); setReferences({}); referenceRequests.current.clear();
    try {
      const [sources, owners] = await Promise.all([fetchSourceDefinitions(), fetchDefinitionWorkflows()]);
      if (request !== generation.current) return;
      setDefinitions(sources); setWorkflows(owners); setAvailable(true);
    } catch (cause) {
      if (request === generation.current) setError(cause instanceof Error ? cause.message : 'Unable to load Data Sources');
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
  const inspectReferences = async (definition: SourceDefinition) => {
    const key = definitionKey(definition), request = generation.current;
    if (referenceRequests.current.has(key) || !available) return;
    referenceRequests.current.add(key); setReferences(previous => ({ ...previous, [key]: { loading: true } }));
    try {
      const impact = await fetchDefinitionReferences(definitionIdentity(definition));
      if (request === generation.current) setReferences(previous => ({ ...previous, [key]: { count: impact.bindingCount } }));
    } catch (cause) {
      if (request === generation.current) setReferences(previous => ({ ...previous, [key]: { error: cause instanceof Error ? cause.message : 'Unable to load references' } }));
    } finally { if (request === generation.current) referenceRequests.current.delete(key); }
  };
  const filtered = useMemo(() => filterDefinitions(definitions, workflows, query, sourceType, status), [definitions, workflows, query, sourceType, status]);
  const resetFilters = () => { setQuery(''); setSourceType('ALL'); setStatus('ALL'); };
  return <section className="data-sources-page" aria-label="Data Sources">
    <header className="data-sources-heading"><div><span className="data-sources-eyebrow">Configuration</span><h2>Data Sources</h2>
      <p>WORKFLOW_VARIABLE and SHARED_TAG definitions. No Runtime values or commands. Overview Edit Mode is not required.</p></div>
      <div className="data-sources-actions"><button type="button" className="btn" disabled={pending || (!available && !error)} onClick={() => void refresh()}><RefreshCw size={14} aria-hidden="true" /> Refresh</button>
        <button ref={createRef} type="button" className="btn btn--primary" disabled={!available || pending} onClick={() => setEditor({})}><Plus size={15} aria-hidden="true" /> Create definition</button></div>
    </header>
    <div className="data-sources-toolbar">
      <div className="definition-type-filter" role="group" aria-label="Source type filter">{(['ALL', 'WORKFLOW_VARIABLE', 'SHARED_TAG'] as const).map(type => <button key={type} type="button" aria-pressed={sourceType === type} onClick={() => setSourceType(type)}>{type === 'ALL' ? 'All sources' : type === 'WORKFLOW_VARIABLE' ? 'Workflow variables' : 'Shared tags'}</button>)}</div>
      <label className="definition-search"><span className="sr-only">Search definitions</span><Search size={15} aria-hidden="true" /><input type="search" placeholder="Search name, ID, workflow, unit…" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <label className="definition-status-filter">Status<select value={status} onChange={event => setStatus(event.target.value as DefinitionStatusFilter)}><option value="ALL">All</option><option value="ENABLED">Enabled</option><option value="DISABLED">Disabled</option></select></label>
    </div>
    {error && <div className="data-sources-feedback" role="alert"><strong>Could not complete the request</strong><p>{error}</p><button type="button" disabled={pending} onClick={() => void refresh()}>Retry loading definitions</button></div>}
    <p className="data-sources-summary" role="status" aria-live="polite">{!available && !error ? 'Loading definitions…' : pending ? 'Updating definition…' : notice || `${filtered.length} of ${definitions.length} definitions`}</p>
    {filtered.length > 0 && <DefinitionTable definitions={filtered} workflows={workflows} busy={!available || pending} references={references} onEdit={definition => setEditor({ definition })} onToggle={definition => void toggle(definition)} onDelete={setDeleting} onReferences={definition => void inspectReferences(definition)} />}
    {available && filtered.length === 0 && <div className="data-sources-empty"><h3>{definitions.length ? 'No matching definitions' : 'No Source definitions yet'}</h3>
      <p>{definitions.length ? 'Try a different search or clear the filters.' : 'Create a shared tag or workflow variable to configure stable Overview bindings.'}</p>
      {definitions.length ? <button type="button" onClick={resetFilters}>Clear filters</button> : <button type="button" className="btn btn--primary" onClick={() => setEditor({})}>Create your first definition</button>}</div>}
    <p className="data-sources-footnote">Reference counts cover saved Overview Pages only; unsaved browser Drafts are excluded. Counts are checked on request, not live. Delete always requires confirmation.</p>
    {editor && <DefinitionCatalogEditor initialDefinition={editor.definition} initialSourceType={sourceType === 'ALL' ? 'SHARED_TAG' : sourceType} definitions={definitions} workflows={workflows} available={available} onClose={() => setEditor(undefined)} onChanged={async () => { await refresh(); setNotice('Definition saved. Overview Draft and Page revision are unchanged.'); }} />}
    {deleting && <DeleteDefinitionDialog definition={deleting} onClose={() => setDeleting(undefined)} onDeleted={() => {
      setDeleting(undefined); setNotice('Definition deleted. Stored bindings are unchanged and resolve as MISSING after refresh.');
      void refresh().then(() => createRef.current?.focus());
    }} />}
  </section>;
}
