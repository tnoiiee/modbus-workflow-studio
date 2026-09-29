import { useEffect, useId, useRef, useState } from 'react';
import { PresentationNumberSession } from '../../lib/overviewPresentationStyle.js';

/** One local gesture. Preview callbacks never write the draft; only finish commits. */
export function PresentationNumberField({ label, value, min, max, unit, slider = false, onPreview, onCommit }: {
  label: string; value: number; min: number; max: number; unit: string; slider?: boolean;
  onPreview: (value: number | null) => void; onCommit: (value: number) => void;
}) {
  const id = useId(), [local, setLocal] = useState(String(value));
  const session = useRef(new PresentationNumberSession(value, min, max));
  const callbacks = useRef({ onPreview, onCommit }); callbacks.current = { onPreview, onCommit };
  useEffect(() => { setLocal(session.current.reset(value)); callbacks.current.onPreview(null); }, [value]);
  useEffect(() => () => callbacks.current.onPreview(null), []);
  const change = (text: string) => { setLocal(text); callbacks.current.onPreview(session.current.change(text)); };
  const finish = () => {
    const result = session.current.finish();
    if (result.commit !== undefined) callbacks.current.onCommit(result.commit);
    setLocal(result.text); callbacks.current.onPreview(null);
  };
  const cancel = () => { setLocal(session.current.cancel()); callbacks.current.onPreview(null); };
  const key = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancel(); }
    else if (event.key === 'Enter') { event.preventDefault(); finish(); }
  };
  return <div className="element-inspector__number-gesture">
    <label htmlFor={id}>{label} <span className="element-inspector__unit">{unit}</span></label>
    <input id={id} aria-label={label} type="number" min={min} max={max} step={1} value={local}
      onChange={event => change(event.target.value)} onKeyDown={key} onBlur={finish} />
    {slider && <input type="range" aria-label={`${label} slider`} aria-valuetext={`${local} ${unit}`} min={min} max={max} step={1}
      value={Number.isFinite(Number(local)) ? Math.max(min, Math.min(max, Number(local))) : value}
      onChange={event => change(event.target.value)} onKeyDown={key}
      onKeyUp={event => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) finish(); }}
      onPointerUp={finish} onPointerCancel={cancel} onBlur={finish} />}
  </div>;
}
