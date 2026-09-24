import { useEffect, useRef, useState } from 'react';
import { FontSizeDraftSession } from '../../lib/overviewFontDraft.js';

const noPreview = (_value: number | null) => {};
/** Immediate canvas preview; Enter/blur commits once, Escape discards the current gesture. */
export function FontSizeField({ value, onCommit, onPreview = noPreview }: {
  value: number; onCommit: (value: number) => void; onPreview?: (value: number | null) => void;
}) {
  const [local, setLocal] = useState(String(value));
  const session = useRef(new FontSizeDraftSession(value));
  useEffect(() => {
    setLocal(session.current.reset(value)); onPreview(null);
  }, [value, onPreview]);
  useEffect(() => () => onPreview(null), [onPreview]);
  const commit = () => {
    const result = session.current.finish();
    // Enter followed by blur is one property commit, even before a parent render.
    if (result.commit !== undefined) onCommit(result.commit);
    setLocal(result.text); onPreview(null);
  };
  return <input type="number" min={8} max={96} step={1} value={local} aria-label="Font Size"
    onChange={event => { setLocal(event.target.value); onPreview(session.current.change(event.target.value)); }}
    onBlur={commit} onKeyDown={event => {
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation(); setLocal(session.current.cancel()); onPreview(null);
      } else if (event.key === 'Enter') { event.preventDefault(); commit(); }
    }} />;
}
