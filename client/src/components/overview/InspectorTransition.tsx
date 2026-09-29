import { useEffect, useRef, type ReactNode } from 'react';

/** Stable layout slot, ephemeral fields. Never retains a previous Element's UI. */
export function InspectorTransition({ visible, onReturnFocus, children }: {
  visible: boolean; onReturnFocus: () => void; children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null), focusInside = useRef(false);
  useEffect(() => {
    if (visible || !focusInside.current) return;
    focusInside.current = false;
    // Don't steal focus from another control or a dialog the user deliberately entered.
    if (document.activeElement === document.body || root.current?.contains(document.activeElement)) onReturnFocus();
  }, [visible, onReturnFocus]);
  return <div ref={root} className="overview-inspector-slot" data-visible={visible} aria-hidden={!visible}
    onFocusCapture={() => { focusInside.current = true; }}
    onBlurCapture={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) focusInside.current = false; }}>
    {visible ? children : null}
  </div>;
}
