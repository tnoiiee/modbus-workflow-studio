import { useCallback, useEffect, useRef, useState } from 'react';
import { DefinitionCatalogEditor } from '../overview/DefinitionCatalogEditor.js';
import { DeleteDefinitionDialog } from './DeleteDefinitionDialog.js';
import { fetchDefinitionWorkflows, fetchSourceDefinitions } from '../../lib/overviewApi.js';
import { definitionId, type DefinitionWorkflow, type SourceDefinition } from '../../lib/sourceDefinitions.js';

/** Standalone configuration management. No Overview Edit dependency or Runtime path. */
export function DataSourcesPage() {
  const [definitions, setDefinitions] = useState<SourceDefinition[]>([]);
  const [workflows, setWorkflows] = useState<DefinitionWorkflow[]>([]);
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editor, setEditor] = useState<{ definition?: SourceDefinition }>();
  const [deleting, setDeleting] = useState<SourceDefinition>();
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    setAvailable(false); setError('');
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
    const focus = () => { void refresh(); };
    window.addEventListener('focus', focus);
    return () => { ++generation.current; window.removeEventListener('focus', focus); };
  }, [refresh]);
  return <section className="page-grid data-sources-page" aria-label="Data Sources">
    <div className="panel wide">
      <h2>Data Sources</h2>
      <p>WORKFLOW_VARIABLE and SHARED_TAG definitions. Configuration only — no Runtime values, acquisition, or commands. Overview Edit Mode is not required.</p>
      <div className="data-sources-actions"><button type="button" onClick={() => void refresh()}>Refresh definitions</button>
        <button type="button" disabled={!available} onClick={() => setEditor({})}>New definition</button></div>
      {error && <p role="alert">{error}</p>}
      <p role="status" aria-live="polite">{!available && !error ? 'Loading definitions…' : notice}</p>
      {available && definitions.length === 0 && <p>No Source definitions. Create a definition to begin.</p>}
      <div className="table-scroll"><table><caption>Configuration definitions — names are display metadata, IDs are immutable</caption>
        <thead><tr>{['Name / Stable ID', 'Source Type / Workflow', 'Data type', 'Capability', 'Enabled', 'Actions'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{definitions.map(definition => <tr key={`${definition.sourceType}:${definitionId(definition)}`}>
          <th scope="row">{definition.name}<br /><small>{definitionId(definition)}</small></th>
          <td>{definition.sourceType}{definition.sourceType === 'WORKFLOW_VARIABLE' && <><br />{workflows.find(workflow => workflow.id === definition.workflowId)?.name ?? definition.workflowId}<br /><small>{definition.workflowId}</small></>}</td>
          <td>{definition.dataType}</td><td>{definition.capability}</td><td>{definition.enabled ? 'Yes' : 'Disabled'}</td>
          <td><button type="button" disabled={!available} onClick={() => setEditor({ definition })} aria-label={`Edit ${definition.name}`}>Edit / Enable / Disable</button>
            <button type="button" className="btn btn--danger" disabled={!available} onClick={() => setDeleting(definition)} aria-label={`Delete ${definition.name}`}>Delete</button></td>
        </tr>)}</tbody>
      </table></div>
    </div>
    {editor && <DefinitionCatalogEditor initialDefinition={editor.definition} definitions={definitions} workflows={workflows} available={available} onClose={() => setEditor(undefined)} onChanged={refresh} />}
    {deleting && <DeleteDefinitionDialog definition={deleting} onClose={() => setDeleting(undefined)} onDeleted={() => {
      setDeleting(undefined); setNotice('Definition deleted. Stored bindings are unchanged and resolve as MISSING after refresh.'); void refresh();
    }} />}
  </section>;
}
