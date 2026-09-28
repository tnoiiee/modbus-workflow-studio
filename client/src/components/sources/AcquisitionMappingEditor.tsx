import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Modal } from '../ui/Modal.js';
import type { SourceDefinition } from '../../lib/sourceDefinitions.js';
import { acquisitionPath, acquisitionRequest, defaultAcquisition, type MappingResult } from '../../lib/acquisitionApi.js';
import { acquisitionDraft, validateAcquisition, changeAcquisitionField, codecWidth, focusAcquisitionError, FUNCTION_CODES, WIRE_TYPES, BYTE_ORDERS, WORD_ORDERS, type AcquisitionField, type AcquisitionDevice } from '../../lib/acquisitionValidation.js';
import '../../styles/acquisition.css';
type SharedDefinition = Extract<SourceDefinition, { sourceType: 'SHARED_TAG' }>;
/** Configuration form only. Local edit strings never enter the persisted contract until valid. */
export function AcquisitionMappingEditor({ definition, onClose, onSaved }: { definition: SharedDefinition; onClose: () => void; onSaved?: (result: MappingResult) => void }) {
  const defaults = () => acquisitionDraft(defaultAcquisition(definition.sourceId, definition.dataType === 'Boolean'));
  const [draft, setMappingDraft] = useState(defaults);
  const [devices, setDevices] = useState<AcquisitionDevice[]>([]);
  const [loading, setLoading] = useState(true), [pending, setPending] = useState(false);
  const [error, setError] = useState(''), [availability, setAvailability] = useState('UNCONFIGURED');
  const [loaded, setLoaded] = useState(false), [retry, setRetry] = useState(0), [confirmRemove, setConfirmRemove] = useState(false);
  const [saved, setSaved] = useState(false), [notice, setNotice] = useState(''), [impact, setImpact] = useState('');
  const input = useRef<HTMLSelectElement | null>(null), alive = useRef(true), inFlight = useRef(false);
  const fields = useRef<Partial<Record<AcquisitionField, HTMLElement | null>>>({});
  const summary = useRef<HTMLParagraphElement>(null);
  const serverError = useRef<HTMLParagraphElement>(null);
  const formId = useId();
  const path = acquisitionPath(definition.sourceId);
  const supported = definition.dataType !== 'String' && definition.capability !== 'COMMAND_ONLY';
  const validation = validateAcquisition(draft, definition, devices, definition.sourceId);
  const errors = loaded ? validation.errors : {};
  const fieldId = (field: AcquisitionField) => `${formId}-${field}`;
  useEffect(() => {
    const controller = new AbortController(); alive.current = true; setLoading(true); setError('');
    Promise.all([acquisitionRequest<MappingResult>(path, { signal: controller.signal }),
      acquisitionRequest<AcquisitionDevice[]>('/api/devices', { signal: controller.signal })]).then(([result, list]) => {
      if (!alive.current || controller.signal.aborted) return;
      if (result.mapping) setMappingDraft(acquisitionDraft(result.mapping));
      setLoaded(true); setSaved(Boolean(result.mapping)); setAvailability(result.availability); setDevices(list); setLoading(false);
    }).catch(cause => { if (!controller.signal.aborted && alive.current) { setError((cause as Error).message); setLoading(false); } });
    return () => { alive.current = false; controller.abort(); };
  }, [path, retry]);
  useEffect(() => { if (loaded) input.current?.focus(); }, [loaded]);
  useEffect(() => {
    if (error && loaded && !pending) {
      if (!focusAcquisitionError(validation.errors, fields.current)) serverError.current?.focus();
    }
  }, [error, loaded, pending]);
  const change = (field: AcquisitionField, value: string | boolean) => {
    const next = changeAcquisitionField(draft, field, value);
    setMappingDraft(next.draft); setImpact(next.impact); setNotice('');
    // Server errors remain a separate last-Save summary; local field errors are derived afresh.
  };
  const persist = async (remove = false) => {
    if (inFlight.current || loading || !loaded) return;
    if (!remove && !validation.mapping) {
      focusAcquisitionError(validation.errors, fields.current);
      if (validation.firstInvalid === 'sourceId') summary.current?.focus();
      return;
    }
    inFlight.current = true; setPending(true); setError(''); setNotice('');
    try {
      const result = await acquisitionRequest<MappingResult>(path, remove ? { method: 'DELETE' } : {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(validation.mapping),
      });
      if (!alive.current) return;
      if (remove) { setMappingDraft(defaults()); setSaved(false); setAvailability('UNCONFIGURED'); setConfirmRemove(false); onSaved?.({ mapping: null, availability: 'UNCONFIGURED' }); }
      else { onSaved?.(result); onClose(); return; }
      setImpact(''); setNotice(remove ? 'Mapping removed. Definition and bindings are unchanged.' : 'Acquisition configuration saved. No Device was connected by this action.');
    } catch (cause) { if (alive.current) setError((cause as Error).message); }
    finally { inFlight.current = false; if (alive.current) setPending(false); }
  };
  const attributes = (field: AcquisitionField) => ({
    id: fieldId(field), name: field, 'aria-invalid': Boolean(errors[field]),
    'aria-describedby': `${fieldId(field)}-help ${fieldId(field)}-error`,
    ref: (element: HTMLInputElement | HTMLSelectElement | null) => { fields.current[field] = element; if (field === 'deviceId') input.current = element as HTMLSelectElement | null; },
  });
  const field = (key: AcquisitionField, label: string, help: string, control: ReactNode) => <div className="acquisition-field" key={key}>
    <label htmlFor={fieldId(key)}>{label}</label>{control}
    <small id={`${fieldId(key)}-help`}>{help}</small>
    <small id={`${fieldId(key)}-error`} className="acquisition-error" aria-live="polite">{errors[key] ? `Error: ${errors[key]}` : ''}</small>
  </div>;
  const numeric = (key: Exclude<AcquisitionField, 'enabled'>, label: string, help: string, integer = false) => field(key, label, help,
    <input {...attributes(key)} type="text" inputMode={integer ? 'numeric' : 'decimal'} required autoComplete="off" spellCheck={false} value={draft[key]} onChange={e => change(key, e.target.value)} />);
  const select = (key: Exclude<AcquisitionField, 'enabled'>, label: string, options: readonly string[], help: string, incompatible: (option: string) => boolean = () => false) => field(key, label, help,
    <select {...attributes(key)} value={draft[key]} onChange={e => change(key, e.target.value)}>
      {!options.includes(draft[key]) && <option value={draft[key]} disabled>Unavailable value: {draft[key] || '(empty)'}</option>}
      {options.map(option => <option key={option} value={option} disabled={incompatible(option)}>{key === 'functionCode' ? `FC0${option}` : option}{incompatible(option) ? ' — incompatible with Definition' : ''}</option>)}
    </select>);
  const disabled = loading || !loaded || pending || !supported;
  return <div className="acquisition-dialog"><Modal open title={`Acquisition · ${definition.name}`} size="md" initialFocusRef={input}
    onClose={() => { if (!inFlight.current) onClose(); }}
    description="Read-only Shared Tag mapping. No auto-connect, writes or Overview live values."
    footer={<div className="acquisition-actions">
      <button className="btn acquisition-remove" type="button" disabled={loading || pending || !saved} onClick={() => setConfirmRemove(true)}>Remove mapping</button>
      <div><button className="btn" type="button" disabled={pending} onClick={() => { if (!inFlight.current) onClose(); }}>Cancel</button>
      <button className="btn btn--primary" type="submit" form={formId} disabled={disabled}
        aria-disabled={!validation.mapping} aria-describedby={`${formId}-validation`}>{pending ? 'Saving…' : 'Save mapping'}</button></div>
    </div>}>
    <form id={formId} noValidate className="acquisition-form" onSubmit={event => { event.preventDefault(); if (supported) void persist(); }}>
      <div className="acquisition-source"><span><strong>{definition.dataType}</strong> · {definition.capability === 'COMMAND_ONLY' ? 'Command-only Definition' : 'Shared Tag Definition'}</span><span>Configuration: {availability}</span></div>
      {loading && <p role="status">Loading configuration…</p>}
      {!supported && <aside className="acquisition-callout" role="note"><strong>Read-only producer unavailable</strong><p>{definition.dataType === 'String' ? 'General String decoding is not supported.' : 'COMMAND_ONLY mappings cannot produce read-only acquisition samples.'} The Definition remains valid in the Catalog; bindings are unchanged.</p></aside>}
      {!definition.enabled && <p className="acquisition-callout">This Definition is disabled. Its mapping can be saved, but acquisition cannot operate.</p>}
      {error && <p ref={serverError} tabIndex={-1} className="acquisition-error" role="alert">Server/load error (last response): {error}</p>}
      {error && !loaded && <button type="button" disabled={loading} onClick={() => setRetry(n => n + 1)}>Retry configuration</button>}
      {confirmRemove && <div className="acquisition-callout" role="alert"><p>Remove only this acquisition mapping? Definition and saved bindings remain unchanged.</p>
        <button type="button" disabled={pending} onClick={() => setConfirmRemove(false)}>Keep mapping</button>
        <button type="button" disabled={pending} onClick={() => void persist(true)}>Confirm remove mapping</button></div>}
      <fieldset disabled={disabled} className="acquisition-section">
        <legend>Connection &amp; addressing</legend><div className="acquisition-grid">
        {field('deviceId', 'Device', devices.find(d => d.id === draft.deviceId)?.enabled === false ? 'Disabled Device: acquisition cannot operate.' : 'Use an existing Device. Saving never connects it.',
          <select {...attributes('deviceId')} required value={draft.deviceId} onChange={e => change('deviceId', e.target.value)}><option value="">Select Device</option>
            {draft.deviceId && !devices.some(d => d.id === draft.deviceId) && <option value={draft.deviceId} disabled>Missing Device · {draft.deviceId}</option>}
            {devices.map(d => <option key={d.id} value={d.id}>{d.name}{d.enabled ? '' : ' (disabled)'}</option>)}</select>)}
        {numeric('unitId', 'Unit ID', 'Whole number, 0–255.', true)}
        {select('functionCode', 'Function code', FUNCTION_CODES, 'FC01/02: Boolean. FC03/04: Number. Other fields are retained.', option => definition.dataType === 'Boolean' ? Number(option) > 2 : Number(option) <= 2)}
        {numeric('address', 'Zero-based address', '0–65535. Address + Width ≤ 65536.', true)}
        </div>
      </fieldset>
      <fieldset disabled={disabled} className="acquisition-section">
        <legend>Data decoding</legend><div className="acquisition-grid">
        {select('dataType', 'Wire data type', WIRE_TYPES, 'Updates derived Width only. Scale and Offset stay unchanged.', option => (option === 'Boolean') !== (definition.dataType === 'Boolean'))}
        {field('width', 'Width · derived', Number(draft.functionCode) <= 2 ? 'Bits, derived from Wire data type.' : 'Registers, derived from Wire data type.', <>
          <input {...attributes('width')} readOnly value={draft.width} />
          {errors.width && codecWidth(draft.dataType) !== undefined && <button type="button" onClick={() => { change('width', String(codecWidth(draft.dataType))); setImpact(`Width explicitly corrected to ${codecWidth(draft.dataType)} for ${draft.dataType}.`); }}>Use required width ({codecWidth(draft.dataType)})</button>}
        </>)}
        {select('byteOrder', 'Byte order', BYTE_ORDERS, 'Numeric register byte order. No effect on a Boolean bit.')}
        {select('wordOrder', 'Word order', WORD_ORDERS, 'Multi-register word order. No effect on one register or bit.')}
        </div>
        <p className="acquisition-impact" role="status" aria-live="polite">{impact}</p>
      </fieldset>
      <fieldset disabled={disabled} className="acquisition-section">
        <legend>Value &amp; timing</legend><div className="acquisition-grid">
        {numeric('scale', 'Scale', draft.dataType === 'Boolean' ? 'Boolean requires 1. No automatic reset.' : 'Finite multiplier applied to the decoded value.')}
        {numeric('offset', 'Offset', draft.dataType === 'Boolean' ? 'Boolean requires 0. No automatic reset.' : 'Finite adjustment added after Scale.')}
        {numeric('pollIntervalMs', 'Poll interval (ms)', '100–3,600,000. Whole milliseconds.', true)}
        {numeric('staleAfterMs', 'Stale threshold (ms)', '100–86,400,000; at least Poll interval.', true)}
        </div>
      </fieldset>
      <fieldset disabled={disabled} className="acquisition-enabled">
        <legend className="sr-only">Acquisition state</legend>
        <div className="acquisition-setting">
          <input {...attributes('enabled')} type="checkbox" checked={draft.enabled === true} onChange={e => change('enabled', e.target.checked)} />
          <div><label htmlFor={fieldId('enabled')}>Enable server acquisition <span>{draft.enabled === true ? 'On' : 'Off'}</span></label>
            <p id={`${fieldId('enabled')}-help`}>Operates only when the Device is already connected. Never auto-connects. A disabled Definition or a disabled or disconnected Device prevents acquisition.</p>
            <p id={`${fieldId('enabled')}-error`} className="acquisition-error" aria-live="polite">{errors.enabled ? `Error: ${errors.enabled}` : ''}</p>
          </div>
        </div>
      </fieldset>
      <p id={`${formId}-validation`} ref={summary} tabIndex={-1} className="acquisition-feedback" role="status">{loaded && validation.firstInvalid
        ? `${Object.keys(validation.errors).length} field(s) need attention. Save focuses the first invalid field. ${errors.sourceId ?? ''}`
        : notice || 'Configuration only. Server validation remains authoritative on Save.'}</p>
      <details className="acquisition-notes"><summary>Mapping identity &amp; limits</summary><p>Stable sourceId: <code>{definition.sourceId}</code></p><p>Number and Boolean only. Shared Tags deduplicate identical compatible ranges; Workflow and Monitor reads remain independent. Configuration availability is not Definition resolution or live quality.</p></details>
    </form>
  </Modal></div>;
}
