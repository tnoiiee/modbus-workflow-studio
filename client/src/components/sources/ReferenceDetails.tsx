import { definitionKey } from '../../lib/definitionList.js';
import { useEffect, useId, useRef } from 'react';
import { X, FileText } from 'lucide-react';
import type { DefinitionReferenceSummary } from '../../lib/overviewApi.js';
import { bindingCountLabel } from '../../lib/definitionReferences.js';
import { definitionId, type SourceDefinition } from '../../lib/sourceDefinitions.js';

export type ReferenceDetailsState = { loading?: boolean; error?: string; data?: DefinitionReferenceSummary };
const readableType = (value: string) => value.toLowerCase().replaceAll('_', ' ');

/** Non-modal inspector: no overlay/backdrop, no Tab trap, no navigation or writes. */
export function ReferenceDetails({ definition, state, onClose, onRetry }: {
  definition: SourceDefinition; state?: ReferenceDetailsState; onClose: () => void; onRetry: () => void;
}) {
  const heading = useId(), description = useId(), closeRef = useRef<HTMLButtonElement>(null);
  const sourceKey = definitionKey(definition);
  useEffect(() => { closeRef.current?.focus({ preventScroll: true }); }, [sourceKey]);
  const groups = new Map<string, { name: string; references: DefinitionReferenceSummary['references'] }>();
  for (const reference of state?.data?.references ?? []) {
    if (!groups.has(reference.pageId)) groups.set(reference.pageId, { name: reference.pageName || 'Unnamed Overview Page', references: [] });
    groups.get(reference.pageId)!.references.push(reference);
  }
  return <aside className="reference-details" data-reference-details role="dialog" aria-modal="false" aria-labelledby={heading} aria-describedby={description}
    onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); } }}>
    <div className="reference-details__head"><div><h2 id={heading}>Saved references</h2><p className="reference-details__name">{definition.name}</p></div>
      <button ref={closeRef} type="button" className="btn-icon" aria-label="Close saved references" onClick={onClose}><X size={18} aria-hidden="true" /></button></div>
    <p id={description} className="reference-details__scope">Saved Overview Pages only. Unsaved browser Drafts are excluded.</p>
    <details className="reference-details__identity"><summary>Source identity · {definition.sourceType === 'SHARED_TAG' ? 'Shared Tag' : 'Workflow Variable'}</summary><code>{definitionId(definition)}</code>
      {definition.sourceType === 'WORKFLOW_VARIABLE' && <p>Workflow ID <code>{definition.workflowId}</code></p>}</details>
    <div className="reference-details__body">
      {(!state || state.loading) && <p role="status">Loading saved references…</p>}
      {state?.error && <div role="alert"><p>{state.error}</p><button type="button" onClick={onRetry}>Retry reference details</button></div>}
      {state?.data && <>
        <p className="reference-details__summary" role="status">{bindingCountLabel(state.data.bindingCount)} across {state.data.pageCount} {state.data.pageCount === 1 ? 'Overview Page' : 'Overview Pages'}</p>
        {state.data.bindingCount === 0 && <p>No saved Elements currently use this Definition.</p>}
        {[...groups].map(([pageId, group]) => <section className="reference-details__page" key={pageId}><h3><FileText size={14} aria-hidden="true" />{group.name}</h3>
          <ul>{group.references.map(reference => <li key={reference.elementId}>
            <strong>{reference.elementName?.trim() || 'Unnamed element'}</strong>
            <p className="reference-details__metadata"><span>{readableType(reference.elementType)}</span><span>Direction: {reference.direction ?? 'Not specified (legacy)'}</span></p>
            <details><summary>Element ID</summary><code>{reference.elementId}</code></details>
          </li>)}</ul></section>)}
      </>}
    </div>
  </aside>;
}
