import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { OverviewElement } from '../../lib/overviewElements.js';
import type { RuntimeSelection } from '../../lib/overviewRuntimeSelection.js';
import { captionText } from '../../lib/overviewRuntimePresentation.js';

/** Non-modal UI-only portal. No scroll lock, Canvas measurements or Runtime hooks. */
export function RuntimeSafetyPanel({ id, selection, elements, message, origin, onClose, onDetails }: {
  id: string; selection: RuntimeSelection; elements: readonly OverviewElement[]; message: string;
  origin: RefObject<HTMLButtonElement>; onClose: () => void; onDetails: (id: string) => void;
}) {
  const root = useRef<HTMLElement>(null), close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const panel = root.current, trigger = origin.current;
    close.current?.focus({ preventScroll: true });
    return () => {
      // Do not steal focus if the user has deliberately moved outside the non-modal panel.
      if ((panel?.contains(document.activeElement) || document.activeElement === document.body) && trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [origin]);
  const content = <aside ref={root} id={id} className="overview-runtime-safety-panel" role="dialog" aria-modal="false" aria-labelledby={`${id}-heading`}
    onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); } }}>
    <header><h2 id={`${id}-heading`}>Runtime details &amp; safety</h2>
      <button ref={close} type="button" aria-label="Close Runtime details and safety" onClick={onClose}><X size={18} aria-hidden="true" /></button></header>
    <div className="overview-runtime-safety-body">
      <p>Trusted network only. BAD is included in the unavailable count; counts summarize the existing cache.</p>
      <p>{selection.elementIds.length} Elements · {message}</p>
      <p>Latest received data only. Transport connected does not mean every Tag is GOOD, fresh, Device-connected or replay caught up. No exactly-once guarantee.</p>
      <p>Trusted network or authenticated reverse proxy only. No integrated authentication/authorization. Origin policy is not authentication. Not public-Internet ready.</p>
      <p>Display may coalesce intermediate samples; this is not an alarm/event history. Automatic recovery: at most 5 attempts / rolling 60 seconds. Manual Retry: at most once per second.</p>
      <h3>Element Runtime Details</h3>
      {selection.elementIds.length === 0 && <p>No eligible Runtime Elements on this Page.</p>}
      <ul>{selection.elementIds.map(id => { const element = elements.find(e => e.id === id); return element ? <li key={id}><button type="button" onClick={() => onDetails(id)}>{captionText(element.name)} — Runtime details</button></li> : null; })}</ul>
    </div>
  </aside>;
  return typeof document === 'undefined' ? content : createPortal(content, document.body);
}

/** Key this UI leaf by Page, never the Provider/Canvas. Close commits before Details opens. */
export function RuntimeSafetyAction({ selection, elements, message, onDetails }: {
  selection: RuntimeSelection; elements: readonly OverviewElement[]; message: string; onDetails: (id: string) => void;
}) {
  const [open, setOpen] = useState(false), trigger = useRef<HTMLButtonElement>(null), pending = useRef<string | null>(null), id = useId();
  useEffect(() => {
    if (open || pending.current === null) return;
    const elementId = pending.current; pending.current = null;
    if (!selection.elementIds.includes(elementId)) return;
    // Existing RuntimeDetails Modal captures this stable origin after the panel unmounts.
    trigger.current?.focus({ preventScroll: true });
    onDetails(elementId);
  }, [open, onDetails, selection.elementIds]);
  return <>
    <button ref={trigger} type="button" className="overview-runtime-safety-trigger" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined}
      onClick={() => setOpen(value => !value)}>Runtime details &amp; safety</button>
    {open && <RuntimeSafetyPanel id={id} origin={trigger} selection={selection} elements={elements} message={message}
      onClose={() => setOpen(false)} onDetails={elementId => { pending.current = elementId; setOpen(false); }} />}
  </>;
}
