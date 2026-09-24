import { useEffect, useRef, useState } from 'react';
import { Modal } from '../ui/Modal.js';
import { deleteSourceDefinition, fetchDefinitionReferences, type DefinitionReferenceSummary } from '../../lib/overviewApi.js';
import { definitionId, definitionIdentity, type SourceDefinition } from '../../lib/sourceDefinitions.js';

export function DefinitionImpact({ impact }: { impact: DefinitionReferenceSummary }) {
  return <div>
    <p><strong>{impact.bindingCount} saved binding(s) on {impact.pageCount} Overview page(s)</strong></p>
    <p>Saved configuration only; unsaved browser Drafts are not included. References may change after this summary was loaded.</p>
    {impact.references.length > 0 && <ul className="definition-impact-list">{impact.references.map(reference =>
      <li key={`${reference.pageId}:${reference.elementId}`}>{reference.pageName} · {reference.elementName} ({reference.elementType})<br />
        <small>Page {reference.pageId} / Element {reference.elementId}</small></li>)}</ul>}
    <p>Deleting keeps every stored binding identity unchanged. Those bindings resolve as MISSING after Catalog refresh. Recreating the same name will not restore them.</p>
  </div>;
}

export function DeleteDefinitionDialog({ definition, onClose, onDeleted }: {
  definition: SourceDefinition; onClose: () => void; onDeleted: () => void;
}) {
  const [impact, setImpact] = useState<DefinitionReferenceSummary>();
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setImpact(undefined); setError('');
    void fetchDefinitionReferences(definitionIdentity(definition)).then(value => {
      if (!cancelled) setImpact(value);
    }).catch(cause => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Unable to load reference impact'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [definition, reload]);
  const confirm = async () => {
    if (!impact || loading || inFlight.current) return;
    inFlight.current = true; setPending(true); setError('');
    try {
      await deleteSourceDefinition(definitionIdentity(definition));
      onDeleted();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to delete definition'); }
    finally { inFlight.current = false; setPending(false); }
  };
  return <Modal open title="Delete Source definition" tone="danger" onClose={() => { if (!pending) onClose(); }} initialFocusRef={cancelRef}
    description={<>Delete <strong>{definition.name}</strong>? This cannot be undone. Disable is still available as a reversible alternative.</>}
    footer={<><button ref={cancelRef} type="button" onClick={onClose} disabled={pending}>Keep definition</button>
      <button type="button" className="btn btn--danger" onClick={() => void confirm()} disabled={loading || !impact || pending} aria-busy={pending || undefined}>{pending ? 'Deleting…' : 'Delete definition'}</button></>}>
    <p>{definition.sourceType} · {definitionId(definition)}</p>
    {definition.sourceType === 'WORKFLOW_VARIABLE' && <p>Workflow ID: {definition.workflowId}</p>}
    {loading && <p role="status">Loading saved reference impact…</p>}
    {error && <p role="alert">{error}</p>}
    {!loading && !pending && <button type="button" onClick={() => setReload(value => value + 1)}>Refresh reference impact</button>}
    {impact && <DefinitionImpact impact={impact} />}
  </Modal>;
}
